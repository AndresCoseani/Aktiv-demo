import { z } from "zod";
import { fechaISO, textoOpcional, textoRequerido } from "./comunes";

export const horaClaseSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const horarioBaseSchema = z.object({
  id: z.uuid(), titulo: textoRequerido(80, "Escribí la actividad"),
  dia: z.number().int().min(1).max(7), hora: horaClaseSchema,
  desde: fechaISO.nullable().optional(),
  fin: z.union([horaClaseSchema, z.literal("")]).default(""), lugar: textoOpcional(120).default(""),
}).strict().refine((v) => !v.fin || v.fin > v.hora, "La hora de fin debe ser posterior al inicio");
export const altaHorarioApi = horarioBaseSchema.superRefine((v, ctx) => {
  if (!v.fin) ctx.addIssue({ code: "custom", path: ["fin"], message: "Elegí la hora de fin" });
  if (!v.lugar.trim()) ctx.addIssue({ code: "custom", path: ["lugar"], message: "Escribí el lugar de la clase" });
});
export const parcheHorarioApi = z.object({ activo: z.boolean() }).strict();
export const cambioHorarioApi = z.object({
  fecha: fechaISO, alcance: z.enum(["habitual", "solo_fecha"]),
  titulo: textoRequerido(80, "Escribí la actividad"), hora: horaClaseSchema,
  fin: horaClaseSchema, lugar: textoRequerido(120, "Escribí el lugar de la clase"),
}).strict().refine((v) => v.fin > v.hora, "La hora de fin debe ser posterior al inicio");
// Los horarios anteriores pueden no tener fin/lugar; exigirlos solo en nuevas altas.
export const horarioClaseSchema = horarioBaseSchema.safeExtend({ activo: z.boolean() }).strip();
export const referenciaClaseApi = z.object({ horarioId: z.uuid(), fecha: fechaISO }).strict();
export const confirmarAsistenciaApi = referenciaClaseApi.extend({ horaLlegada: horaClaseSchema });
export const consultaAgendaApi = z.object({ desde: fechaISO, hasta: fechaISO }).strict()
  .refine((v) => v.hasta >= v.desde && (Date.parse(v.hasta) - Date.parse(v.desde)) / 86400000 <= 30, "Consultá hasta 31 días por vez");
export const claseAgendaSchema = z.object({
  horarioId: z.uuid(), fecha: fechaISO, titulo: z.string(), hora: horaClaseSchema,
  fin: z.string(), lugar: z.string(), cancelada: z.boolean(), asistire: z.boolean(),
  horaLlegada: horaClaseSchema.nullable().default(null),
  confirmados: z.array(z.object({ alumnoId: z.uuid(), nombre: z.string(), horaLlegada: horaClaseSchema.nullable().default(null) })),
  personalizada: z.boolean().default(false),
});
export const agendaRespuestaSchema = z.object({ horarios: z.array(horarioClaseSchema), clases: z.array(claseAgendaSchema) });
export type HorarioClase = z.output<typeof horarioClaseSchema>;
export type ClaseAgenda = z.output<typeof claseAgendaSchema>;
export type AgendaRespuesta = z.output<typeof agendaRespuestaSchema>;

export function fechaArgentina(ahora = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}
export function desplazarFecha(fecha: string, dias: number) {
  const fechaUtc = new Date(`${fecha}T12:00:00Z`);
  fechaUtc.setUTCDate(fechaUtc.getUTCDate() + dias);
  return fechaUtc.toISOString().slice(0, 10);
}
export function diaSemanal(fecha: string) { return (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7 + 1; }
