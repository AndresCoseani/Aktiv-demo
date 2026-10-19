import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { loginDto, type Session } from "@aktiv/contrato";
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
import { Publico } from "./guards";

const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

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
  ) {}

  /** Los tokens viajan solo en cookies httpOnly: JavaScript del navegador no puede leerlos */
  private ponerCookies(res: Response, t: Tokens) {
    const base = { httpOnly: true, secure: this.env.cookieSecure, sameSite: "lax" as const };
    res.cookie(COOKIE_ACCESO, t.accessToken, { ...base, path: "/", maxAge: t.expiraEn * 1000 });
    res.cookie(COOKIE_REFRESCO, t.refreshToken, { ...base, path: "/api/auth", maxAge: TREINTA_DIAS_MS });
  }

  private borrarCookies(res: Response) {
    const base = { httpOnly: true, secure: this.env.cookieSecure, sameSite: "lax" as const };
    res.clearCookie(COOKIE_ACCESO, { ...base, path: "/" });
    res.clearCookie(COOKIE_REFRESCO, { ...base, path: "/api/auth" });
  }

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

  @Get("me")
  me(@Req() req: RequestConUsuario) {
    return { session: sesionDe(req.usuario) };
  }
}
