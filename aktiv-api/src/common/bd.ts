import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorApi, lanzarSiError, noEncontrado, sinPermiso } from "./errores";
import type { RequestConUsuario, Rol, Usuario } from "./tipos";
import { validarOLanzar } from "./zod.pipe";
import type { z } from "zod";

/** Inyecta el usuario autenticado en el handler: `@UsuarioActual() u: Usuario` */
export const UsuarioActual = createParamDecorator((_: unknown, ctx: ExecutionContext): Usuario => {
  return ctx.switchToHttp().getRequest<RequestConUsuario>().usuario;
});

/**
 * Comprueba que el alumno existe y el usuario lo puede ver (RLS). Devuelve 404
 * tanto si no existe como si es de otro profe: no se revela cuáles existen.
 */
export async function asegurarAlumno(db: SupabaseClient, alumnoId: string) {
  const { data, error } = await db
    .from("alumnos")
    .select("id, coach_id, user_id")
    .eq("id", alumnoId)
    .maybeSingle();
  lanzarSiError(error);
  if (!data) throw noEncontrado("El alumno");
  return data as { id: string; coach_id: string; user_id: string | null };
}

/** UPDATE de una fila; 404 si no se tocó ninguna (no existe o no es tuya) */
export async function actualizarUno(
  db: SupabaseClient,
  tabla: string,
  columnaClave: string,
  valor: string,
  columnas: Record<string, unknown>,
  que: string,
) {
  const { data, error } = await db.from(tabla).update(columnas).eq(columnaClave, valor).select(columnaClave);
  lanzarSiError(error);
  if (!data?.length) throw noEncontrado(que);
}

/** DELETE de una fila; 404 si no se borró ninguna */
export async function borrarUno(db: SupabaseClient, tabla: string, valor: string, que: string) {
  const { data, error } = await db.from(tabla).delete().eq("id", valor).select("id");
  lanzarSiError(error);
  if (!data?.length) throw noEncontrado(que);
}

/**
 * Parche con permisos por rol: el profe puede editar lo que define su esquema;
 * el alumno, solo los campos de su lista. Un campo fuera de la lista es 403
 * (no 400): es un intento de editar algo que no le corresponde.
 */
export function parchePorRol<P extends z.ZodType, A extends z.ZodType>(
  usuario: Usuario,
  body: unknown,
  opciones: { profe: P; alumno: A; camposAlumno: readonly string[] },
): z.output<P> | z.output<A> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ErrorApi(400, "datos_invalidos", "El cuerpo tiene que ser un objeto.");
  }
  const claves = Object.keys(body);
  if (claves.length === 0) throw new ErrorApi(400, "sin_cambios", "No hay cambios para guardar.");

  if (usuario.rol === ("alumno" satisfies Rol)) {
    const prohibidas = claves.filter((c) => !opciones.camposAlumno.includes(c));
    if (prohibidas.length) {
      throw sinPermiso(`Solo podés editar: ${opciones.camposAlumno.join(", ")}.`);
    }
    return validarOLanzar(opciones.alumno, body);
  }
  return validarOLanzar(opciones.profe, body);
}

export const RESPUESTA_ID = (id: string) => ({ id });
