import type { Response } from "express";
import type { Env } from "../config/env";
import { COOKIE_ACCESO, COOKIE_REFRESCO } from "../common/tipos";
import type { Tokens } from "./auth.service";

const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

/** Los tokens viajan solo en cookies httpOnly: JavaScript del navegador no puede leerlos */
export function ponerCookies(res: Response, env: Env, t: Tokens) {
  const base = { httpOnly: true, secure: env.cookieSecure, sameSite: "lax" as const };
  res.cookie(COOKIE_ACCESO, t.accessToken, { ...base, path: "/", maxAge: t.expiraEn * 1000 });
  res.cookie(COOKIE_REFRESCO, t.refreshToken, { ...base, path: "/api/auth", maxAge: TREINTA_DIAS_MS });
}

export function borrarCookies(res: Response, env: Env) {
  const base = { httpOnly: true, secure: env.cookieSecure, sameSite: "lax" as const };
  res.clearCookie(COOKIE_ACCESO, { ...base, path: "/" });
  res.clearCookie(COOKIE_REFRESCO, { ...base, path: "/api/auth" });
}
