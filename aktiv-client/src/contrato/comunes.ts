import { z } from "zod";
import { hoyISO } from "./fechas";

/**
 * Contrato de datos de Aktiv — piezas comunes.
 *
 * Los esquemas de esta carpeta son la FUENTE ÚNICA de verdad:
 *   - de ellos salen los tipos de TypeScript (z.infer),
 *   - validan lo que escribe el usuario en los formularios (DTOs de entrada),
 *   - validan lo que vuelve de la base de datos.
 *
 * Los mismos límites están repetidos como CHECK constraints en
 * supabase/migrations: como el navegador habla directo con Supabase, la base es
 * la defensa real y estos esquemas son la primera barrera (y dan buenos mensajes).
 * Si cambiás un límite, cambialo en los dos lados.
 */

// mensajes de Zod en español
z.config(z.locales.es());

export const LIMITES = {
  nombre: 120,
  nombreCarrera: 160,
  email: 254,
  telefono: 30,
  objetivo: 120,
  lugar: 160,
  notas: 10_000,
  notasCarrera: 2_000,
  enfermedades: 2_000,
  lesion: 1_000,
  parentesco: 60,
  repeticiones: 30,
  descanso: 30,
  peso: 10,
  series: { min: 0, max: 99 },
  certificadoNombre: 200,
  certificadoRuta: 500,
  certificadoBytes: 5 * 1024 * 1024,
  tiempoMaxSeg: 24 * 60 * 60,
  distanciaMaxKm: 1000,
  distanciasPorCarrera: 10,
  anioMinimoNacimiento: 1900,
} as const;

export const CERTIFICADO_TIPOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/* ───────────── Primitivas ───────────── */

/** id: UUID en Supabase, cualquier texto en la demo; la base exige UUID */
export const idSchema = z.string().min(1, "Falta el identificador").max(64);

/** yyyy-mm-dd, que exista de verdad en el calendario */
export const fechaISO = z.iso.date("Fecha inválida");

/** no puede ser posterior a hoy (para fechas de cosas que ya pasaron) */
export const fechaNoFutura = fechaISO.refine((f) => f <= hoyISO(), "La fecha no puede ser futura");

/**
 * Ojo: los esquemas de entidad NO recortan (trim) los textos: se aplican mientras
 * alguien escribe y un trim le comería los espacios y saltos de línea. Los
 * formularios recortan al enviar; la base valida con length(trim(...)).
 */
export const textoOpcional = (max: number, que = "El texto") =>
  z.string().max(max, `${que} no puede superar los ${max} caracteres`);

export const textoRequerido = (max: number, mensaje: string, que = "El texto") =>
  z
    .string()
    .max(max, `${que} no puede superar los ${max} caracteres`)
    .refine((s) => s.trim().length > 0, mensaje);

export const emailOpcional = z.union([
  z.literal(""),
  z.string().max(LIMITES.email, "El email es demasiado largo").pipe(z.email("Email inválido")),
]);

export const telefonoSchema = z
  .string()
  .max(LIMITES.telefono, `El teléfono no puede superar los ${LIMITES.telefono} caracteres`)
  .regex(/^[0-9+()\s.-]*$/, "El teléfono solo puede llevar números, espacios y + ( ) . -");

export const tiempoSegSchema = z
  .number("Tiempo inválido")
  .int("Tiempo inválido")
  .positive("El tiempo tiene que ser mayor a cero")
  .max(LIMITES.tiempoMaxSeg, "El tiempo no puede superar las 24 horas");

export const distanciaKmSchema = z
  .number("Distancia inválida")
  .positive("La distancia tiene que ser mayor a cero")
  .max(LIMITES.distanciaMaxKm, `La distancia no puede superar ${LIMITES.distanciaMaxKm} km`);

/** kg con coma o punto: "12", "12,5" */
export const pesoSchema = z
  .string()
  .max(LIMITES.peso, "Peso demasiado largo")
  .regex(/^\d*[.,]?\d*$/, "El peso tiene que ser un número");

/* ───────────── Validación para formularios ───────────── */

export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campos: Record<string, string> };

/**
 * Valida y devuelve el primer mensaje de error (para mostrar en el form)
 * y el mensaje por campo (para marcar cada input).
 */
export function validar<S extends z.ZodType>(
  schema: S,
  entrada: unknown,
): Resultado<z.output<S>> {
  const r = schema.safeParse(entrada);
  if (r.success) return { ok: true, datos: r.data };
  const campos: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const clave = issue.path.join(".");
    campos[clave] ??= issue.message;
  }
  return {
    ok: false,
    error: r.error.issues[0]?.message ?? "Datos inválidos",
    campos,
  };
}
