import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { ErrorApi, noAutenticado, sinPermiso } from "../common/errores";
import type { Rol, Usuario } from "../common/tipos";
import { SupabaseService } from "../supabase/supabase.service";

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  /** segundos hasta que vence el access token */
  expiraEn: number;
};

type EntradaCache = { usuario: Usuario; vence: number };

/** Cuánto tiempo se recuerda un token ya validado (evita una llamada a Supabase por request) */
const TTL_CACHE_MS = 30_000;
const MAX_CACHE = 2_000;

@Injectable()
export class AuthService {
  private readonly cache = new Map<string, EntradaCache>();
  /** intentos fallidos de login: clave → marcas de tiempo (ventana de 1 minuto) */
  private readonly fallos = new Map<string, number[]>();

  constructor(
    private readonly supa: SupabaseService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /* ───────────── límite de intentos de login ───────────── */

  private fallosRecientes(clave: string) {
    const ahora = Date.now();
    const lista = (this.fallos.get(clave) ?? []).filter((t) => ahora - t < 60_000);
    this.fallos.set(clave, lista);
    return lista;
  }

  verificarLimiteLogin(ip: string, email: string) {
    const porCuenta = this.fallosRecientes(`${ip}|${email.toLowerCase()}`).length;
    const porIp = this.fallosRecientes(`${ip}|*`).length;
    if (porCuenta >= this.env.LOGIN_FALLOS_POR_MIN || porIp >= this.env.LOGIN_FALLOS_POR_MIN * 4) {
      throw new ErrorApi(
        HttpStatus.TOO_MANY_REQUESTS,
        "demasiados_intentos",
        "Demasiados intentos. Esperá un minuto y probá de nuevo.",
      );
    }
  }

  /** Intentos fallidos con enlaces de invitación inventados o vencidos (por IP) */
  verificarLimiteToken(ip: string) {
    if (this.fallosRecientes(`${ip}|token`).length >= this.env.LOGIN_FALLOS_POR_MIN * 2) {
      throw new ErrorApi(
        HttpStatus.TOO_MANY_REQUESTS,
        "demasiados_intentos",
        "Demasiados intentos. Esperá un minuto y probá de nuevo.",
      );
    }
  }

  registrarFalloToken(ip: string) {
    this.fallosRecientes(`${ip}|token`).push(Date.now());
  }

  private registrarFallo(ip: string, email: string) {
    this.fallosRecientes(`${ip}|${email.toLowerCase()}`).push(Date.now());
    this.fallosRecientes(`${ip}|*`).push(Date.now());
    if (this.fallos.size > MAX_CACHE * 5) this.fallos.clear();
  }

  private limpiarFallos(ip: string, email: string) {
    this.fallos.delete(`${ip}|${email.toLowerCase()}`);
  }

  /* ───────────── sesión ───────────── */

  async login(email: string, clave: string, ip: string): Promise<{ usuario: Usuario; tokens: Tokens }> {
    this.verificarLimiteLogin(ip, email);
    const { data, error } = await this.supa.anonimo().auth.signInWithPassword({ email, password: clave });
    if (error || !data.session) {
      // mismo mensaje para "no existe" y "clave incorrecta": no se revela qué cuentas existen
      if (error && (error.status === 429 || error.code === "over_request_rate_limit")) {
        throw new ErrorApi(HttpStatus.TOO_MANY_REQUESTS, "demasiados_intentos", "Demasiados intentos. Probá en un rato.");
      }
      this.registrarFallo(ip, email);
      throw noAutenticado("credenciales_invalidas", "Email o contraseña incorrectos.");
    }
    this.limpiarFallos(ip, email);
    const tokens: Tokens = {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiraEn: data.session.expires_in,
    };
    const usuario = await this.cargarUsuario(data.session.access_token, data.user.id, data.user.email ?? email);
    return { usuario, tokens };
  }

  async refrescar(refreshToken: string): Promise<{ usuario: Usuario; tokens: Tokens }> {
    const { data, error } = await this.supa.anonimo().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      throw noAutenticado("sesion_vencida", "Tu sesión venció. Iniciá sesión de nuevo.");
    }
    const tokens: Tokens = {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiraEn: data.session.expires_in,
    };
    const usuario = await this.cargarUsuario(data.session.access_token, data.user.id, data.user.email ?? "");
    return { usuario, tokens };
  }

  /**
   * Cambia la contraseña de quien tiene la sesión iniciada. Pide la actual (también protege de
   * una sesión abierta en una compu ajena) y cuenta los errores como intentos de login.
   * La contraseña nueva se escribe con el propio token del usuario: no hace falta la clave de servidor.
   */
  async cambiarClave(u: Usuario, accessToken: string, actual: string, nueva: string, ip: string) {
    this.verificarLimiteLogin(ip, u.email);
    if (actual === nueva) {
      throw new ErrorApi(HttpStatus.UNPROCESSABLE_ENTITY, "clave_igual", "La contraseña nueva tiene que ser distinta de la actual.");
    }
    const { error } = await this.supa.anonimo().auth.signInWithPassword({ email: u.email, password: actual });
    if (error) {
      this.registrarFallo(ip, u.email);
      // 422 y no 401: un 401 haría que el navegador crea que se cerró la sesión
      throw new ErrorApi(HttpStatus.UNPROCESSABLE_ENTITY, "clave_actual_incorrecta", "La contraseña actual no es correcta.");
    }
    this.limpiarFallos(ip, u.email);
    const r = await fetch(`${this.env.SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: this.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: nueva }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) {
      throw new ErrorApi(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "clave_rechazada",
        "Esa contraseña no se aceptó. Elegí una más larga o menos común.",
      );
    }
  }

  /** Revoca la sesión en Supabase (mejor esfuerzo; las cookies se borran igual) */
  async cerrarSesion(accessToken: string | undefined) {
    if (!accessToken) return;
    this.cache.delete(accessToken);
    try {
      await fetch(`${this.env.SUPABASE_URL}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: { apikey: this.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(3_000),
      });
    } catch {
      // si Supabase no responde, el token vence solo
    }
  }

  /** Valida un access token y devuelve el usuario con su rol (con caché corta) */
  async usuarioDesdeToken(token: string): Promise<Usuario> {
    const hit = this.cache.get(token);
    if (hit && hit.vence > Date.now()) return hit.usuario;

    const { data, error } = await this.supa.anonimo().auth.getUser(token);
    if (error || !data.user) {
      const vencido = /expired/i.test(error?.message ?? "");
      throw noAutenticado(
        vencido ? "token_vencido" : "token_invalido",
        vencido ? "Tu sesión venció." : "Tu sesión no es válida. Iniciá sesión de nuevo.",
      );
    }
    const usuario = await this.cargarUsuario(token, data.user.id, data.user.email ?? "");
    if (this.cache.size >= MAX_CACHE) this.cache.clear();
    this.cache.set(token, { usuario, vence: Date.now() + TTL_CACHE_MS });
    return usuario;
  }

  private async cargarUsuario(token: string, id: string, email: string): Promise<Usuario> {
    const { data, error } = await this.supa
      .delUsuario(token)
      .from("profiles")
      .select("rol, nombre, email")
      .eq("id", id)
      .maybeSingle();
    if (error) throw noAutenticado("token_invalido", "Tu sesión no es válida. Iniciá sesión de nuevo.");
    if (!data) throw sinPermiso("Tu cuenta todavía no está habilitada. Hablá con tu profe.");
    return { id, email: data.email ?? email, rol: data.rol as Rol, nombre: data.nombre, token };
  }
}
