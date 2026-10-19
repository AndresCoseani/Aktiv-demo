import { z } from "zod";
import {
  CERTIFICADO_TIPOS,
  LIMITES,
  fechaISO,
  fechaNoFutura,
  idSchema,
  telefonoSchema,
  textoOpcional,
  textoRequerido,
} from "./comunes";

export const estadoLesionSchema = z.enum(["activa", "recuperada"]);

export const lesionSchema = z.object({
  id: idSchema,
  descripcion: textoRequerido(LIMITES.lesion, "Describí la lesión", "La descripción"),
  /** cuándo ocurrió, si se sabe */
  fecha: fechaISO.nullable(),
  estado: estadoLesionSchema,
});

export const certificadoSchema = z.object({
  nombre: textoRequerido(LIMITES.certificadoNombre, "Falta el nombre del archivo"),
  tipo: z.enum(CERTIFICADO_TIPOS, "Subí un PDF o una imagen (JPG, PNG o WebP)."),
  tamano: z
    .number()
    .int()
    .positive("El archivo está vacío")
    .max(LIMITES.certificadoBytes, "El archivo pesa más de 5 MB."),
  subidoEn: fechaISO,
  /** hasta cuándo es válido */
  vencimiento: fechaISO.nullable(),
  /**
   * ruta en el storage (Supabase, máx. ${LIMITES.certificadoRuta} caracteres en la base)
   * o data URL (demo, por eso el tope alto acá)
   */
  ruta: z.string().min(1).max(4_000_000),
});

/** Contacto familiar o de emergencia: todo opcional */
export const contactoFamiliarSchema = z.object({
  nombre: textoOpcional(LIMITES.nombre, "El nombre"),
  parentesco: textoOpcional(LIMITES.parentesco, "El parentesco"),
  telefono: telefonoSchema,
});

export const fichaMedicaSchema = z.object({
  fechaNacimiento: fechaISO
    .refine((f) => f >= `${LIMITES.anioMinimoNacimiento}-01-01`, "Fecha de nacimiento inválida")
    .nullable(),
  lugarNacimiento: textoOpcional(LIMITES.lugar, "El lugar de nacimiento"),
  enfermedades: textoOpcional(LIMITES.enfermedades, "El texto de enfermedades"),
  lesiones: z.array(lesionSchema),
  certificado: certificadoSchema.nullable(),
  contacto: contactoFamiliarSchema,
});

/* ───────────── DTOs ───────────── */

/** Cambios parciales sobre la ficha (cada campo se guarda a medida que se escribe) */
export const actualizarFichaDto = fichaMedicaSchema.partial();

/** Alta/edición de una lesión desde el formulario */
export const crearLesionDto = z.object({
  descripcion: lesionSchema.shape.descripcion,
  /** "" = no sé la fecha */
  fecha: z.union([z.literal("").transform(() => null), fechaNoFutura]),
  estado: estadoLesionSchema,
});

/** Metadatos del archivo antes de subirlo (se validan antes de tocar el storage) */
export const subirCertificadoDto = z.object({
  tipo: certificadoSchema.shape.tipo,
  tamano: certificadoSchema.shape.tamano,
  vencimiento: fechaISO.nullable(),
});

export type ActualizarFichaDto = z.output<typeof actualizarFichaDto>;
export type CrearLesionDto = z.output<typeof crearLesionDto>;
export type SubirCertificadoDto = z.output<typeof subirCertificadoDto>;
