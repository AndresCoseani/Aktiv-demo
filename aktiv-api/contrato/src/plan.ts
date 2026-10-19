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

export const ejercicioSchema = z.object({
  id: idSchema,
  /** nombre del ejercicio del catálogo; vacío mientras no se eligió */
  nombre: textoOpcional(LIMITES.nombre, "El nombre del ejercicio"),
  series: z
    .number("Series inválidas")
    .int("Las series tienen que ser un número entero")
    .min(LIMITES.series.min, "Las series no pueden ser negativas")
    .max(LIMITES.series.max, `Máximo ${LIMITES.series.max} series`),
  /** texto libre: "12", "400 m", "30 min" */
  repeticiones: textoOpcional(LIMITES.repeticiones, "Las repeticiones"),
  /** kg usados; solo en ejercicios de fuerza y core */
  peso: pesoSchema.optional(),
  /** ISO del último registro de peso */
  pesoFecha: fechaISO.optional(),
});

export const planSchema = z.object({
  id: idSchema,
  nombre: textoOpcional(LIMITES.nombre, "El nombre del plan"),
  ejercicios: z.array(ejercicioSchema),
});

/* ───────────── DTOs ───────────── */

/** Alta de plan (el nombre puede venir vacío: la UI pone "Plan N") */
export const crearPlanDto = planSchema.pick({ nombre: true });

/** Cambios sobre un ejercicio de un plan (el profe) o su peso (el alumno) */
export const actualizarEjercicioDto = ejercicioSchema.omit({ id: true }).partial();

export type CrearPlanDto = z.output<typeof crearPlanDto>;
export type ActualizarEjercicioDto = z.output<typeof actualizarEjercicioDto>;
