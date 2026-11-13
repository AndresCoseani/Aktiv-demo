import { distribucionSchema } from "./planificacion";
import { runningSchema } from "./running";
import { z } from "zod";
import { actividadPlanSchema, cantidadSemanasSchema, diasInicialesSchema, duplicarPlanApi, sesionEntrenamientoSchema } from "./mensual";

const nombre = z.string().trim().min(1, "Escribí un nombre").max(120);
export const planModeloSchema = z.object({
  id: z.uuid(), nombre, tipo: actividadPlanSchema, semanas: cantidadSemanasSchema, running: runningSchema.optional(), distribucion: distribucionSchema.optional(),
  sesiones: z.array(sesionEntrenamientoSchema).max(28), revision: z.number().int().nonnegative(),
}).superRefine((modelo, ctx) => {
  if (modelo.sesiones.some((s) => s.tipo !== modelo.tipo)) ctx.addIssue({ code: "custom", message: "Un modelo solo puede contener una actividad" });
  const ids = new Set<string>();
  for (const s of modelo.sesiones) {
    for (const id of [s.id, ...s.ejercicios.map((e) => e.id), ...s.activacion.map((e) => e.id)]) {
      if (ids.has(id)) ctx.addIssue({ code: "custom", message: "Hay identificadores repetidos en el modelo" });
      ids.add(id);
    }
    if (s.ejercicios.length > 500) ctx.addIssue({ code: "custom", message: "Máximo 500 ejercicios por entrenamiento" });
    for (const e of s.ejercicios) {
      if (e.semanas.length !== modelo.semanas || e.semanas.some((c) => c.semana > modelo.semanas || c.peso !== null || c.pesoFecha !== null)) ctx.addIssue({ code: "custom", message: "El modelo debe contener todas sus semanas, sin pesos personales" });
    }
  }
});
export const nombreModeloApi = z.object({ id: z.uuid(), nombre }).strict();
export const crearModeloApi = nombreModeloApi.extend({ tipo: actividadPlanSchema, semanas: cantidadSemanasSchema, diasIniciales: diasInicialesSchema }).strict().superRefine((modelo, ctx) => {
  if (modelo.tipo !== modelo.diasIniciales.tipo) ctx.addIssue({ code: "custom", path: ["diasIniciales", "tipo"], message: "Las sesiones deben ser del tipo del modelo" });
  if (modelo.tipo === "Running") ctx.addIssue({ code: "custom", path: ["tipo"], message: "Running se configura como actividad de la semana, no como tipo de modelo." });
});
export const editarModeloApi = z.object({ nombre: nombre.optional(), semanas: cantidadSemanasSchema.optional() }).strict().refine((v) => Object.keys(v).length > 0, "No hay cambios");
export const asignacionModeloSchema = z.object({ dia: z.number().int().min(1).max(7), sesionId: z.uuid() }).strict();
export const asignarModeloApi = duplicarPlanApi.extend({ semanas: cantidadSemanasSchema.optional(), asignaciones: z.array(asignacionModeloSchema).max(7).default([]) })
  .superRefine((dto, ctx) => {
    if (new Set(dto.asignaciones.map((a) => a.dia)).size !== dto.asignaciones.length) ctx.addIssue({ code: "custom", path: ["asignaciones"], message: "Elegí una sesión por día" });
    if (new Set(dto.asignaciones.map((a) => a.sesionId)).size !== dto.asignaciones.length) ctx.addIssue({ code: "custom", path: ["asignaciones"], message: "Una sesión no se puede asignar a varios días" });
  });
export const operacionModeloApi = z.object({ metodo: z.enum(["POST", "PATCH", "DELETE"]), ruta: z.string().min(1).max(180), datos: z.unknown().optional() }).strict();
export type PlanModelo = z.infer<typeof planModeloSchema>;
export const resumenModeloSchema = z.object({ id: z.uuid(), nombre, tipo: actividadPlanSchema, semanas: cantidadSemanasSchema, dias: z.number().int().nonnegative() });
export type ResumenModelo = z.infer<typeof resumenModeloSchema>;
export type OperacionModelo = z.infer<typeof operacionModeloApi>;
