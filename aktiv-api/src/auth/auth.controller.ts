import { Body, Controller, Get, HttpCode, Post, Req, Res, Param } from "@nestjs/common";
import type { Response } from "express";
import { cambiarClaveApi, recuperarClaveApi, restablecerClaveApi, loginDto, type Session } from "@aktiv/contrato";
import { Inject } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { noAutenticado } from "../common/errores";
import {
  COOKIE_ACCESO,
  COOKIE_REFRESCO,
  type RequestConUsuario,
  type Usuario,
} from "../common/tipos";
import { validarOLanzar } from "../common/zod.pipe";
import { AuthService, type Tokens } from "./auth.service";
import { borrarCookies, ponerCookies } from "./cookies";
import { Publico, Roles } from "./guards";
import { RegistroService } from "./registro.service";
import { registroAlumnoApi, confirmarRegistroApi, uuidSchema } from "@aktiv/contrato";
import { Throttle } from "@nestjs/throttler";

export function sesionDe(u: Usuario, alumnoId?: string): Session {
  return {
    username: u.email,
    role: u.rol,
    nombre: u.nombre,
    userId: u.id,
    ...(alumnoId ? { alumnoId } : {}),
  };
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
    private readonly registro: RegistroService,
  ) {}

  private ponerCookies(res: Response, t: Tokens) {
    ponerCookies(res, this.env, t);
  }

  private borrarCookies(res: Response) {
    borrarCookies(res, this.env);
  }
  @Publico() @Get("registro")
  async estadoRegistro() { return { habilitado: Boolean(await this.registro.profesor()) }; }

  @Publico() @Post("registro") @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async registrar(@Body() body: unknown) { await this.registro.registrar(validarOLanzar(registroAlumnoApi, body)); }

  @Publico() @Post("confirmar-registro") @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmarRegistro(@Body() body: unknown) { await this.registro.completar(validarOLanzar(confirmarRegistroApi, body).token); }

  @Roles("coach") @Get("solicitudes-alta")
  pendientes(@Req() req: RequestConUsuario) { return this.registro.pendientes(req.usuario.token); }

  @Roles("coach") @Post("solicitudes-alta/:id/aprobar")
  aprobar(@Req() req: RequestConUsuario,@Param("id") id: string) { return this.registro.aprobar(req.usuario.token,validarOLanzar(uuidSchema,id)); }

  @Publico()
  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: RequestConUsuario, @Res({ passthrough: true }) res: Response) {
    const { usuario: email, clave } = validarOLanzar(loginDto, body);
    const { usuario, tokens } = await this.auth.login(email, clave, req.ip ?? "desconocida");
    this.ponerCookies(res, tokens);
    return { session: sesionDe(usuario) };
  }

  /** Renueva el access token con el refresh token (cookie) */
  @Publico()
  @Post("refresh")
  @HttpCode(200)
  async refrescar(@Req() req: RequestConUsuario, @Res({ passthrough: true }) res: Response) {
    const refresco = req.cookies?.[COOKIE_REFRESCO] as string | undefined;
    if (!refresco) throw noAutenticado("sin_sesion");
    try {
      const { usuario, tokens } = await this.auth.refrescar(refresco);
      this.ponerCookies(res, tokens);
      return { session: sesionDe(usuario) };
    } catch (e) {
      this.borrarCookies(res);
      throw e;
    }
  }

  @Publico()
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: RequestConUsuario, @Res({ passthrough: true }) res: Response) {
    await this.auth.cerrarSesion(req.cookies?.[COOKIE_ACCESO] as string | undefined);
    this.borrarCookies(res);
  }

  /** Cambiar la propia contraseña (profe o alumno) */
  @Publico()
  @Post("recuperar-clave")
  @HttpCode(204)
  async recuperar(@Body() body: unknown, @Req() req: RequestConUsuario) {
    const { email } = validarOLanzar(recuperarClaveApi, body);
    await this.auth.recuperarClave(email, req.ip ?? "desconocida");
  }

  @Publico()
  @Post("restablecer-clave")
  @HttpCode(204)
  async restablecer(@Body() body: unknown) {
    const { token, claveNueva } = validarOLanzar(restablecerClaveApi, body);
    await this.auth.restablecerClave(token, claveNueva);
  }

  @Post("clave")
  @HttpCode(204)
  async cambiarClave(@Body() body: unknown, @Req() req: RequestConUsuario) {
    const { claveActual, claveNueva } = validarOLanzar(cambiarClaveApi, body);
    const token = req.cookies?.[COOKIE_ACCESO] as string;
    await this.auth.cambiarClave(req.usuario, token, claveActual, claveNueva, req.ip ?? "desconocida");
  }

  @Get("me")
  me(@Req() req: RequestConUsuario) {
    return { session: sesionDe(req.usuario) };
  }
}
