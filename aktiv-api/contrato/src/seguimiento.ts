import { z } from "zod";
import { numeroSemanaSchema } from "./mensual";

export const SENSACIONES = ["Bien", "Regular", "Cansado"] as const;
export const guardarSeguimientoApi = z.object({
  completado: z.boolean(), sensacion: z.enum(SENSACIONES).nullable(), nota: z.string().trim().max(500),
}).strict().refine((r) => r.completado || (r.sensacion === null && r.nota === ""), "Desmarcar el entrenamiento también quita su comentario y sensación");
export const seguimientoSchema = z.object({
  semana: numeroSemanaSchema, completado: z.boolean(), sensacion: z.enum(SENSACIONES).nullable(),
  nota: z.string().max(500), fecha: z.iso.datetime({ offset: true }).nullable(),
});
export const seguimientoRespuesta = z.object({ registro: seguimientoSchema, habilitado: z.boolean() });
export type Seguimiento = z.infer<typeof seguimientoSchema>;
