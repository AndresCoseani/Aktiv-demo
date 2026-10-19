import { z } from "zod";
import {
  LIMITES,
  fechaISO,
  idSchema,
  pesoSchema,
  textoOpcional,
} from "./comunes";

export const categoriaEjercicioSchema = z.enum([
  "Series y ritmo",
  "Técnica de carrera",
  "Fuerza",
  "Movilidad",
]);

/** Parte de la sesión a la que pertenece un ejercicio, en el orden en que se hacen */
export const bloqueSchema = z.enum(["Calentamiento", "Entrenamiento", "Enfriamiento"]);

export const ejercicioSchema = z.object({
  id: idSchema,
  /** nombre del ejercicio del catálogo; vacío mientras no se eligió */
  nombre: textoOpcional(LIMITES.nombre, "El nombre del ejercicio"),
  series: z
    .number("Series inválidas")
    .int("Las series tienen que ser un número entero")
    .min(LIMITES.series.min, "Las series no pueden ser negativas")
    .max(LIMITES.series.max, `Máximo ${LIMITES.series.max} series`),
  /** en qué parte de la sesión se hace */
  bloque: bloqueSchema,
  /** texto libre: "12", "400 m", "30 min" */
  repeticiones: textoOpcional(LIMITES.repeticiones, "Las repeticiones"),
  /** descanso entre series, texto libre: "60 s", "2 min" (vacío = sin indicar) */
  descanso: textoOpcional(LIMITES.descanso, "El descanso"),
  /** kg usados; solo en ejercicios de fuerza y core */
  peso: pesoSchema.optional(),
  /** ISO del último registro de peso */
  pesoFecha: fechaISO.optional(),
});

/** Un plan es de running o de fuerza; el alumno ve el plan ACTIVO de cada tipo */
export const tipoPlanSchema = z.enum(["Running", "Fuerza"]);

export const planSchema = z.object({
  id: idSchema,
  nombre: textoOpcional(LIMITES.nombre, "El nombre del plan"),
  tipo: tipoPlanSchema,
  /** el que ve el alumno; como mucho uno por tipo (la base lo garantiza) */
  activo: z.boolean(),
  ejercicios: z.array(ejercicioSchema),
});

/* ───────────── DTOs ───────────── */

/** Alta de plan (el nombre puede venir vacío: la UI pone "Plan N") */
export const crearPlanDto = planSchema.pick({ nombre: true, tipo: true });

/** Cambios sobre un ejercicio de un plan (el profe) o su peso (el alumno) */
export const actualizarEjercicioDto = ejercicioSchema.omit({ id: true }).partial();

export type Bloque = z.infer<typeof bloqueSchema>;
export type TipoPlan = z.infer<typeof tipoPlanSchema>;
export type CrearPlanDto = z.output<typeof crearPlanDto>;
export type ActualizarEjercicioDto = z.output<typeof actualizarEjercicioDto>;
