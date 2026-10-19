import { z } from "zod";
import { estadoLesionSchema, nivelSchema, semanaSchema } from "@aktiv/contrato";

/**
 * Forma exacta de cada tabla de Supabase (snake_case), tal como la devuelve
 * la API. Validan que la base y el código estén de acuerdo: si una migración
 * agrega o cambia una columna y no se actualiza esto, falla al cargar con un
 * mensaje claro en vez de mostrar datos rotos.
 */

const id = z.string();
const fecha = z.string();
const num = z.coerce.number();

export const filaAlumnoSchema = z.object({
  id,
  coach_id: id,
  user_id: id.nullable(),
  nombre: z.string(),
  email: z.string(),
  telefono: z.string(),
  objetivo: z.string(),
  nivel: nivelSchema,
  activo: z.boolean(),
  proximo_pago: fecha.nullable(),
  alta_en: fecha,
  plan_activo_id: id.nullable(),
  semana: semanaSchema,
  notas_profe: z.string(),
  notas_alumno: z.string(),
});

export const filaPlanSchema = z.object({
  id,
  alumno_id: id,
  nombre: z.string(),
  orden: z.number().int(),
});

export const filaPlanEjercicioSchema = z.object({
  id,
  plan_id: id,
  orden: z.number().int(),
  nombre: z.string(),
  series: z.number().int(),
  repeticiones: z.string(),
  peso: z.string().nullable(),
  peso_fecha: fecha.nullable(),
});

export const filaFichaSchema = z.object({
  alumno_id: id,
  fecha_nacimiento: fecha.nullable(),
  lugar_nacimiento: z.string(),
  enfermedades: z.string(),
  cert_ruta: z.string().nullable(),
  cert_nombre: z.string().nullable(),
  cert_tipo: z.string().nullable(),
  cert_tamano: num.nullable(),
  cert_subido_en: fecha.nullable(),
  cert_vencimiento: fecha.nullable(),
  contacto_nombre: z.string(),
  contacto_parentesco: z.string(),
  contacto_telefono: z.string(),
});

export const filaLesionSchema = z.object({
  id,
  alumno_id: id,
  descripcion: z.string(),
  fecha: fecha.nullable(),
  estado: estadoLesionSchema,
});

export const filaMarcaSchema = z.object({
  id,
  alumno_id: id,
  distancia_km: num,
  tiempo_seg: num,
  fecha,
  carrera: z.string(),
});

export const filaCarreraSchema = z.object({
  id,
  coach_id: id,
  nombre: z.string(),
  fecha,
  lugar: z.string(),
  distancias_km: z.array(num),
  notas: z.string(),
});

export const filaInscripcionSchema = z.object({
  id,
  alumno_id: id,
  carrera_id: id,
  distancia_km: num,
  objetivo_seg: num.nullable(),
  resultado_seg: num.nullable(),
});

export const filaEjercicioCustomSchema = z.object({
  id,
  coach_id: id,
  nombre: z.string(),
});

export type FilaAlumno = z.infer<typeof filaAlumnoSchema>;
export type FilaPlan = z.infer<typeof filaPlanSchema>;
export type FilaPlanEjercicio = z.infer<typeof filaPlanEjercicioSchema>;
export type FilaFicha = z.infer<typeof filaFichaSchema>;
export type FilaLesion = z.infer<typeof filaLesionSchema>;
export type FilaMarca = z.infer<typeof filaMarcaSchema>;
export type FilaCarrera = z.infer<typeof filaCarreraSchema>;
export type FilaInscripcion = z.infer<typeof filaInscripcionSchema>;
export type FilaEjercicioCustom = z.infer<typeof filaEjercicioCustomSchema>;
