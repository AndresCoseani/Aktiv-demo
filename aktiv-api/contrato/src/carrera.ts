import { z } from "zod";
import {
  LIMITES,
  distanciaKmSchema,
  fechaISO,
  idSchema,
  textoOpcional,
  textoRequerido,
  tiempoSegSchema,
} from "./comunes";

const mismaDistancia = (a: number, b: number) => Math.abs(a - b) < 0.001;

/** Carrera del calendario del profe: se carga una vez y después se asignan alumnos */
export const carreraSchema = z.object({
  id: idSchema,
  nombre: textoRequerido(LIMITES.nombreCarrera, "Escribí el nombre de la carrera", "El nombre"),
  fecha: fechaISO,
  lugar: textoOpcional(LIMITES.lugar, "La ubicación"),
  /** distancias que se pueden correr en esa carrera */
  distanciasKm: z
    .array(distanciaKmSchema)
    .min(1, "Elegí al menos una distancia disponible.")
    .max(LIMITES.distanciasPorCarrera, `Máximo ${LIMITES.distanciasPorCarrera} distancias por carrera`)
    .refine(
      (kms) => kms.every((k, i) => kms.findIndex((o) => mismaDistancia(o, k)) === i),
      "Hay distancias repetidas",
    ),
  notas: textoOpcional(LIMITES.notasCarrera, "Las notas"),
  /** profe dueño (id interno de Supabase) */
  coachId: z.string().optional(),
});

/** Un alumno anotado en una carrera, con la distancia que va a correr */
export const inscripcionSchema = z.object({
  id: idSchema,
  alumnoId: idSchema,
  carreraId: idSchema,
  distanciaKm: distanciaKmSchema,
  /** tiempo que quiere hacer */
  objetivoSeg: tiempoSegSchema.nullable(),
  /** tiempo real, una vez corrida */
  resultadoSeg: tiempoSegSchema.nullable(),
});

/* ───────────── DTOs ───────────── */

/** Alta o edición de una carrera del calendario */
export const crearCarreraDto = carreraSchema.omit({ id: true, coachId: true });

/**
 * Asignar un alumno a una carrera: la distancia tiene que ser una de las que
 * ofrece esa carrera. Se arma con las distancias de la carrera elegida.
 */
export const inscribirAlumnoDto = (distanciasDisponibles: number[]) =>
  z.object({
    distanciaKm: distanciaKmSchema.refine(
      (km) => distanciasDisponibles.some((d) => mismaDistancia(d, km)),
      "Esa distancia no está disponible en la carrera",
    ),
    objetivoSeg: tiempoSegSchema.nullable(),
  });

/** Tiempo oficial de una carrera ya corrida */
export const registrarResultadoDto = z.object({
  resultadoSeg: tiempoSegSchema,
  sumarAMarcas: z.boolean(),
});

export type CrearCarreraDto = z.output<typeof crearCarreraDto>;
export type RegistrarResultadoDto = z.output<typeof registrarResultadoDto>;
