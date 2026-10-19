/**
 * Contrato de datos de Aktiv.
 *
 * Un esquema Zod por entidad (fuente única de verdad):
 *   entidad  → tipo de TypeScript (z.infer) y validación de lo que vuelve de la base
 *   DTO      → lo que se acepta al crear/editar, validado en los formularios
 *   filas    → forma exacta de cada tabla de Supabase (snake_case) y su mapeo
 *
 * Reglas:
 *   - Un campo nuevo se agrega acá, en una migración (con su CHECK) y en el mapeo
 *     (mapeo.ts). El test de ida y vuelta (mapeo.test.ts) avisa si falta algo.
 *   - Los límites de LIMITES se repiten como CHECK en supabase/migrations.
 */
import type { z } from "zod";
import type { alumnoSchema, nivelSchema, diaEntrenamientoSchema } from "./alumno";
import type { carreraSchema, inscripcionSchema } from "./carrera";
import type {
  certificadoSchema,
  contactoFamiliarSchema,
  estadoLesionSchema,
  fichaMedicaSchema,
  lesionSchema,
} from "./ficha";
import type { marcaSchema } from "./marca";
import type { categoriaEjercicioSchema, ejercicioSchema, planSchema } from "./plan";
import type { ejercicioCustomSchema, rolSchema, sessionSchema } from "./sesion";

export * from "./fechas";
export * from "./comunes";
export * from "./alumno";
export * from "./carrera";
export * from "./ficha";
export * from "./marca";
export * from "./plan";
export * from "./sesion";
export * from "./api";

/* ───────────── Tipos de dominio (inferidos de los esquemas) ───────────── */

export type Role = z.infer<typeof rolSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Nivel = z.infer<typeof nivelSchema>;
export type CategoriaEjercicio = z.infer<typeof categoriaEjercicioSchema>;
export type Ejercicio = z.infer<typeof ejercicioSchema>;
export type Plan = z.infer<typeof planSchema>;
export type EstadoLesion = z.infer<typeof estadoLesionSchema>;
export type Lesion = z.infer<typeof lesionSchema>;
export type Certificado = z.infer<typeof certificadoSchema>;
export type ContactoFamiliar = z.infer<typeof contactoFamiliarSchema>;
export type FichaMedica = z.infer<typeof fichaMedicaSchema>;
export type Marca = z.infer<typeof marcaSchema>;
export type Carrera = z.infer<typeof carreraSchema>;
export type Inscripcion = z.infer<typeof inscripcionSchema>;
export type DiaEntrenamiento = z.infer<typeof diaEntrenamientoSchema>;
export type Alumno = z.infer<typeof alumnoSchema>;
export type EjercicioCustom = z.infer<typeof ejercicioCustomSchema>;
