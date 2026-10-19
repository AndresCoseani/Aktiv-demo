import type { Request } from "express";

export type Rol = "coach" | "alumno";

/** El usuario autenticado de la request */
export type Usuario = {
  id: string;
  email: string;
  rol: Rol;
  nombre: string;
  /** access token de Supabase: con él se accede a la base como este usuario (RLS) */
  token: string;
};

export type RequestConUsuario = Request & { usuario: Usuario; id?: string };

export const COOKIE_ACCESO = "aktiv_at";
export const COOKIE_REFRESCO = "aktiv_rt";
