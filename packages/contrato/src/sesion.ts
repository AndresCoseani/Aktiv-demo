import { z } from "zod";
import { LIMITES, textoRequerido } from "./comunes";

export const rolSchema = z.enum(["coach", "alumno"]);

export const sessionSchema = z.object({
  /** email con el que inició sesión (en la demo, el usuario) */
  username: z.string().min(1),
  role: rolSchema,
  /** nombre para mostrar en el saludo */
  nombre: z.string().min(1).max(LIMITES.nombre),
  /** solo para el rol alumno: a qué alumno corresponde la cuenta */
  alumnoId: z.string().optional(),
  /** id del usuario en Supabase Auth */
  userId: z.string().optional(),
});

/** Ingreso con Supabase: email + contraseña */
export const loginDto = z.object({
  usuario: z.string().trim().min(1, "Escribí tu email").pipe(z.email("Escribí un email válido")),
  clave: z.string().min(1, "Escribí tu contraseña").max(200),
});

/** Ingreso en modo demo: usuario libre (admin / alumno) */
export const loginDemoDto = z.object({
  usuario: textoRequerido(60, "Escribí tu usuario"),
  clave: z.string().min(1, "Escribí tu contraseña").max(200),
});

/** Ejercicio que un profe creó a mano y se suma al catálogo base */
export const ejercicioCustomSchema = z.object({
  id: z.string().min(1).max(64),
  nombre: textoRequerido(LIMITES.nombre, "Escribí el nombre del ejercicio", "El nombre"),
});

export type LoginDto = z.output<typeof loginDto>;
