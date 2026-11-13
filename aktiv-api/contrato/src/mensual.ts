import { distribucionSchema } from "./planificacion";
import { runningSchema } from "./running";
import { z } from "zod";
import { fechaISO, pesoSchema, textoOpcional } from "./comunes";
import { hoyISO, sumarDiasISO } from "./fechas";

/** Tope técnico de tamaño, no una duración de entrenamiento recomendada. */
export const MAX_SEMANAS_PLAN = 104;
export const cantidadSemanasSchema = z.number().int().min(1).max(MAX_SEMANAS_PLAN);
export function semanasDelPlan(cantidad: number) {
  return Array.from({ length: cantidad }, (_, i) => i + 1);
}
export const DIAS_PLAN = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export const diasSesionSchema = z.array(z.number().int().min(1).max(7)).max(7).refine(d => new Set(d).size === d.length, "Día repetido");
const id = z.uuid("Identificador inválido");
export const actividadPlanSchema = z.string().trim().min(1, "Escribí la actividad").max(80).transform((s) => s.replace(/\s+/g, " "));
const inicio = fechaISO.refine((f) => f >= "2000-01-01" && f <= "2100-01-01", "Fecha fuera de rango");
export const numeroSemanaSchema = cantidadSemanasSchema;
export const bloquesSesionSchema = z.array(z.number().int().min(1).max(20)).max(20)
  .refine((bloques) => new Set(bloques).size === bloques.length, "Bloque repetido");
export const actividadesBloquesSchema = z.record(z.string().regex(/^(?:[1-9]|1[0-9]|20)$/), z.enum(["Movilidad", "Activación", "Fuerza"]));
export const ejercicioActivacionSchema = z.object({ id, nombre: textoOpcional(120), indicacion: textoOpcional(300), fase: z.enum(["Movilidad", "Activación"]).optional() }).strict();
export const activacionSesionSchema = z.array(ejercicioActivacionSchema).max(20)
  .refine((ejercicios) => new Set(ejercicios.map((e) => e.id)).size === ejercicios.length, "Ejercicio de activación repetido");
export const celdaSemanalSchema = z.object({
  semana: numeroSemanaSchema,
  prescripcion: textoOpcional(60),
  peso: pesoSchema.nullable(),
  pesoFecha: fechaISO.refine((f) => f >= "2000-01-01" && f <= sumarDiasISO(1), "Fecha de peso inválida").nullable(),
});
export const ejercicioMensualSchema = z.object({
  id, grupo: z.number().int().min(1).max(20), orden: z.number().int(),
  nombre: textoOpcional(120), descanso: textoOpcional(30),
  semanas: z.array(celdaSemanalSchema).max(MAX_SEMANAS_PLAN).refine((s) => new Set(s.map((c) => c.semana)).size === s.length, "Semana repetida"),
});
export const sesionEntrenamientoSchema = z.object({
  franja: z.enum(["Mañana", "Tarde", "Noche", "Sin definir"]).default("Sin definir"),
  id, dias: diasSesionSchema.optional(), dia: z.number().int().min(1).max(7).nullable(), tipo: actividadPlanSchema,
  nombre: textoOpcional(60), calentamiento: textoOpcional(4000), enfriamiento: textoOpcional(4000),
  orden: z.number().int(), ejercicios: z.array(ejercicioMensualSchema),
  bloques: bloquesSesionSchema.default([]),
  actividadesBloques: actividadesBloquesSchema.optional(),
  activacion: activacionSesionSchema.default([]),
});
const planMensualBaseSchema = z.object({
  id, nombre: textoOpcional(120), tipo: actividadPlanSchema, inicio, activo: z.boolean(), orden: z.number().int(),
  semanas: cantidadSemanasSchema.default(4),
  sesiones: z.array(sesionEntrenamientoSchema),
  running: runningSchema.optional(), distribucion: distribucionSchema.optional(),
});
export const planMensualSchema = planMensualBaseSchema.superRefine((plan, ctx) => {
  if (plan.sesiones.some((s) => s.tipo !== plan.tipo)) ctx.addIssue({ code: "custom", message: "Un plan solo puede contener una actividad" });
});
export const planesMensualesRespuesta = z.array(planMensualSchema);
const noVacio = <S extends z.ZodRawShape>(shape: S) => z.object(shape).partial().strict()
  .refine((v) => Object.keys(v).length > 0, "No hay cambios para guardar");
export const diasInicialesSchema = z.object({ tipo: actividadPlanSchema, dias: z.number().int().min(1).max(7) }).strict();
export function actividadesIniciales(dias: z.infer<typeof diasInicialesSchema>) {
  return [dias];
}
export const altaMensualApi = planMensualBaseSchema.pick({ id: true, nombre: true, inicio: true, activo: true, semanas: true })
  .extend({ tipo: actividadPlanSchema, diasIniciales: diasInicialesSchema.optional() }).strict().superRefine((plan, ctx) => {
    if (plan.diasIniciales && plan.tipo !== plan.diasIniciales.tipo) ctx.addIssue({ code: "custom", path: ["diasIniciales", "tipo"], message: "Las sesiones deben ser del tipo del plan" });
    if (plan.tipo === "Running") ctx.addIssue({ code: "custom", path: ["tipo"], message: "Running se configura como actividad de la semana, no como tipo de plan." });
  });
// No heredar el default en un PATCH: no mandar duración nunca debe cambiarla.
export const parcheMensualApi = noVacio({ nombre: textoOpcional(120), inicio, semanas: cantidadSemanasSchema, activo: z.literal(false) });
export const altaSesionApi = sesionEntrenamientoSchema.omit({ ejercicios: true, orden: true }).strict();
export const duplicarSesionApi = z.object({
  id, nombre: z.string().trim().min(1, "Escribí un nombre para la copia").max(60),
  dia: z.number().int().min(1).max(7).nullable(), dias: diasSesionSchema.optional(),
}).strict();
export const duplicarPlanApi = z.object({
  id, alumnoId: id, inicio,
  nombre: z.string().trim().min(1, "Escribí un nombre para la copia").max(120),
}).strict();
export const parcheSesionApi = noVacio({ ...sesionEntrenamientoSchema.omit({ id: true, ejercicios: true }).shape, franja: z.enum(["Mañana", "Tarde", "Noche", "Sin definir"]), bloques: bloquesSesionSchema, activacion: activacionSesionSchema });
export const altaEjercicioMensualApi = ejercicioMensualSchema.omit({ semanas: true, orden: true }).strict();
export const parcheEjercicioMensualApi = noVacio(ejercicioMensualSchema.omit({ id: true, semanas: true }).shape);
export const parcheCeldaProfeApi = noVacio(celdaSemanalSchema.omit({ semana: true }).shape);
export const parcheCeldaAlumnoApi = noVacio(celdaSemanalSchema.pick({ peso: true, pesoFecha: true }).shape);
export type PlanMensual = z.infer<typeof planMensualSchema>;
export type SesionEntrenamiento = z.infer<typeof sesionEntrenamientoSchema>;
export type EjercicioMensual = z.infer<typeof ejercicioMensualSchema>;
export type CeldaSemanal = z.infer<typeof celdaSemanalSchema>;
export type EjercicioActivacion = z.infer<typeof ejercicioActivacionSchema>;

/** Vacío hereda la última indicación anterior; nunca hereda el peso. */
export function prescripcionEfectiva(semanas: CeldaSemanal[], semana: number): string {
  return [...semanas].filter((c) => c.semana <= semana && c.prescripcion.trim())
    .sort((a, b) => b.semana - a.semana)[0]?.prescripcion ?? "";
}

/** Semanas de siete días, según la duración elegida; nunca reinicia el ciclo. */
export function semanaDelPlan(inicioPlan: string, fecha = hoyISO(), cantidadSemanas = 4): number | null {
  const dias = Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${inicioPlan}T12:00:00Z`)) / 86400000);
  return dias >= 0 && dias < cantidadSemanas * 7 ? Math.floor(dias / 7) + 1 : null;
}

/** Compatibilidad con sesiones anteriores a la asignación múltiple. */
export function diasDeSesion(s: { dia: number | null; dias?: number[] }): number[] { return s.dias ?? (s.dia === null ? [] : [s.dia]); }
