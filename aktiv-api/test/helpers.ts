import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { crearApp } from "../src/app.factory";
import { cargarEnv } from "../src/config/env";
import type { Mail, MailSaliente } from "../src/mail/mail.service";

/** Header que exige la API en los pedidos que modifican datos (anti-CSRF) */
export const H = { "x-requested-with": "aktiv" };

export const PASS = "Prueba-e2e-2026";

/** Lee test/.env.test (process.loadEnvFile no anda dentro del sandbox de Jest) */
function leerArchivoEnv() {
  const ruta = join(__dirname, ".env.test");
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    if (linea.trim().startsWith("#")) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function entornoDeTest() {
  leerArchivoEnv();
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltan variables en test/.env.test (ver .env.test.example)");
  }
  // estos tests crean y borran usuarios: nunca contra una base remota
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
    throw new Error("Los tests e2e solo corren contra una base local (127.0.0.1).");
  }
  return { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY };
}

/** Mail en memoria: los tests leen lo que "se mandó" (incluido el enlace) sin Resend */
export class MailMemoria implements Mail {
  enviados: MailSaliente[] = [];
  /** si se pone, el próximo envío falla (simula Resend caído) */
  fallar = false;

  async enviar(m: MailSaliente) {
    if (this.fallar) throw new Error("Resend caído");
    this.enviados.push(m);
  }

  /** Token del último enlace enviado */
  ultimoToken() {
    const m = /\/invitacion\?token=([A-Za-z0-9_-]+)/.exec(this.enviados.at(-1)?.texto ?? "");
    if (!m) throw new Error("No hay enlace en el último mail");
    return m[1];
  }
}

export async function levantarApi(extra: Record<string, string> = {}, opciones: { mail?: Mail } = {}) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = entornoDeTest();
  const env = cargarEnv({
    NODE_ENV: "test",
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    WEB_ORIGIN: "http://localhost:3000",
    RATE_LIMIT_PER_MIN: "100000",
    LOGIN_FALLOS_POR_MIN: "5",
    ...extra,
  });
  const app = await crearApp(env, opciones);
  await app.init();
  return app;
}

export type UsuarioTest = { id: string; email: string; nombre: string };

export class Entorno {
  readonly admin: SupabaseClient;
  readonly usuarios: UsuarioTest[] = [];
  readonly alumnos: string[] = [];
  readonly carreras: string[] = [];
  readonly archivos: string[] = [];

  constructor() {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = entornoDeTest();
    this.admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async usuario(nombre: string, rol: "coach" | "alumno"): Promise<UsuarioTest> {
    const email = `e2e-${nombre}-${randomUUID().slice(0, 8)}@test.local`;
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password: PASS,
      email_confirm: true,
    });
    if (error) throw error;
    const { error: e2 } = await this.admin.from("profiles").insert({ id: data.user.id, rol, nombre, email });
    if (e2) throw e2;
    const u = { id: data.user.id, email, nombre };
    this.usuarios.push(u);
    return u;
  }

  /** Alumno de un profe, opcionalmente vinculado a una cuenta (eso no se puede hacer por la API) */
  async alumno(coach: UsuarioTest, nombre: string, cuenta?: UsuarioTest) {
    const { data, error } = await this.admin
      .from("alumnos")
      .insert({ coach_id: coach.id, user_id: cuenta?.id ?? null, nombre })
      .select()
      .single();
    if (error) throw error;
    this.alumnos.push(data.id);
    return data.id as string;
  }

  /** Borra las cuentas creadas por la API cuyo email empieza con el prefijo */
  async limpiarCuentasCon(prefijo: string) {
    for (let pagina = 1; pagina <= 5; pagina++) {
      const { data } = await this.admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
      for (const u of data?.users ?? []) {
        if (u.email?.startsWith(prefijo)) {
          await this.admin.from("alumnos").delete().eq("user_id", u.id);
          await this.admin.auth.admin.deleteUser(u.id);
        }
      }
      if ((data?.users.length ?? 0) < 200) break;
    }
  }

  async limpiar() {
    if (this.archivos.length) await this.admin.storage.from("certificados").remove(this.archivos);
    // los archivos subidos por la API quedan en la carpeta de cada alumno
    for (const id of this.alumnos) {
      const { data } = await this.admin.storage.from("certificados").list(id);
      if (data?.length) await this.admin.storage.from("certificados").remove(data.map((f) => `${id}/${f.name}`));
    }
    if (this.carreras.length) await this.admin.from("carreras").delete().in("id", this.carreras);
    // los alumnos creados por la API también se borran al final
    await this.admin.from("alumnos").delete().in(
      "coach_id",
      this.usuarios.map((u) => u.id),
    );
    for (const u of this.usuarios) await this.admin.auth.admin.deleteUser(u.id);
  }
}

/** Cliente HTTP con cookies (como un navegador) que agrega el header anti-CSRF */
export class Sesion {
  readonly http: ReturnType<typeof request.agent>;

  constructor(app: NestExpressApplication) {
    this.http = request.agent(app.getHttpServer());
  }

  login(email: string, clave = PASS) {
    return this.http.post("/api/auth/login").set(H).send({ usuario: email, clave });
  }
  async entrar(email: string) {
    const r = await this.login(email);
    if (r.status !== 200) throw new Error(`No se pudo iniciar sesión: ${r.status} ${JSON.stringify(r.body)}`);
    return this;
  }
  get(url: string) {
    return this.http.get(url);
  }
  post(url: string, body?: unknown) {
    return this.http.post(url).set(H).send(body as object);
  }
  patch(url: string, body?: unknown) {
    return this.http.patch(url).set(H).send(body as object);
  }
  delete(url: string) {
    return this.http.delete(url).set(H);
  }
}

export const uuid = () => randomUUID();

export const ALUMNO_VALIDO = (id: string = uuid()) => ({
  id,
  nombre: "Alumno de prueba",
  email: "alumno@mail.com",
  telefono: "+54 11 5555-0000",
  objetivo: "10K",
  nivel: "Intermedio",
});
