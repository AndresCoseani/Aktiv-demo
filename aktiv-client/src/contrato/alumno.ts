import { z } from "zod";
import {
  LIMITES,
  emailOpcional,
  fechaISO,
  idSchema,
  telefonoSchema,
  textoOpcional,
  textoRequerido,
} from "./comunes";
import { fichaMedicaSchema } from "./ficha";
import { marcaSchema } from "./marca";
import { planSchema } from "./plan";

export const nivelSchema = z.enum(["Principiante", "Intermedio", "Avanzado"]);
/** DNI sin puntos ni espacios. Vacío para conservar alumnos anteriores sin documento. */
export const dniSchema = z.union([z.literal(""), z.string().regex(/^\d{7,8}$/, "Escribí el DNI con 7 u 8 números, sin puntos")]);
export const normalizarDni = (valor: string) => valor.replace(/[.\s-]/g, "");

/** qué toca un día de la semana (correr, fuerza, las dos o descanso) */
export const diaEntrenamientoSchema = z.object({
  correr: z.boolean(),
  fuerza: z.boolean(),
});

/** 7 días, de lunes (0) a domingo (6) */
export const semanaSchema = z.array(diaEntrenamientoSchema).length(7, "La semana tiene 7 días");

/**
 * Estado del acceso de un alumno al sistema (lo calcula la API, no se edita):
 *  - sin_cuenta         todavía no se le mandó la invitación
 *  - invitado           tiene cuenta y un enlace pendiente de usar
 *  - invitacion_vencida el enlace venció sin usarse
 *  - activo             ya creó su contraseña y puede entrar
 */
export const estadoAccesoSchema = z.enum(["sin_cuenta", "invitado", "invitacion_vencida", "activo"]);

export const accesoSchema = z.object({
  estado: estadoAccesoSchema,
  /** ISO de cuándo vence la invitación pendiente, si la hay */
  expiraEn: z.string().nullable(),
});

export const alumnoSchema = z.object({
  id: idSchema,
  nombre: textoRequerido(LIMITES.nombre, "Escribí el nombre del alumno", "El nombre"),
  email: emailOpcional,
  dni: dniSchema.default(""),
  telefono: telefonoSchema,
  objetivo: textoOpcional(LIMITES.objetivo, "El objetivo"),
  nivel: nivelSchema,
  activo: z.boolean(),
  /** null si no tiene un pago programado */
  proximoPago: fechaISO.nullable(),
  altaEn: fechaISO,
  planes: z.array(planSchema),
  semana: semanaSchema,
  ficha: fichaMedicaSchema,
  marcas: z.array(marcaSchema),
  /** ids internos de Supabase (profe dueño y cuenta del alumno); no se usan en la demo */
  coachId: z.string().optional(),
  userId: z.string().nullable().optional(),
  /** acceso de la cuenta del alumno; solo lo informa la API */
  acceso: accesoSchema.optional(),
  /** lesiones y apuntes privados del profe */
  notasProfe: textoOpcional(LIMITES.notas, "Las notas"),
  /** notas que escribe el propio alumno */
  notasAlumno: textoOpcional(LIMITES.notas, "Las notas"),
});

/* ───────────── DTOs ───────────── */

/** Alta de alumno (lo que pide el formulario) */
export const crearAlumnoDto = alumnoSchema.pick({
  dni: true,
  nombre: true,
  email: true,
  telefono: true,
  objetivo: true,
  nivel: true,
});

/** Cambios que el profe puede hacer sobre un alumno */
export const actualizarAlumnoDto = alumnoSchema
  .pick({
    dni: true,
    nombre: true,
    email: true,
    telefono: true,
    objetivo: true,
    nivel: true,
    activo: true,
    proximoPago: true,
    semana: true,
    notasProfe: true,
    notasAlumno: true,
  })
  .partial().extend({ dni: dniSchema.optional() });

export type CrearAlumnoDto = z.output<typeof crearAlumnoDto>;
export type ActualizarAlumnoDto = z.output<typeof actualizarAlumnoDto>;
