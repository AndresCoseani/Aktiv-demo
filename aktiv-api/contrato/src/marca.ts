import { z } from "zod";
import {
  LIMITES,
  distanciaKmSchema,
  fechaISO,
  fechaNoFutura,
  idSchema,
  textoOpcional,
  tiempoSegSchema,
} from "./comunes";

/** Mejor tiempo en una distancia, con el día y la carrera donde se hizo */
export const marcaSchema = z.object({
  id: idSchema,
  distanciaKm: distanciaKmSchema,
  tiempoSeg: tiempoSegSchema,
  fecha: fechaISO,
  carrera: textoOpcional(LIMITES.nombreCarrera, "El nombre de la carrera"),
});

/** Lo que se guarda al crear una marca (la fecha no puede ser futura) */
export const nuevaMarcaSchema = marcaSchema.omit({ id: true }).extend({ fecha: fechaNoFutura });

export type NuevaMarca = z.output<typeof nuevaMarcaSchema>;
