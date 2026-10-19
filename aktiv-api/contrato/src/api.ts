import { z } from "zod";
import { alumnoSchema, crearAlumnoDto, actualizarAlumnoDto } from "./alumno";
import { carreraSchema, crearCarreraDto, inscripcionSchema } from "./carrera";
import {
  distanciaKmSchema,
  fechaISO,
  tiempoSegSchema,
} from "./comunes";
import { fichaMedicaSchema, lesionSchema } from "./ficha";
import { marcaSchema } from "./marca";
import { ejercicioSchema, planSchema } from "./plan";
import { ejercicioCustomSchema, sessionSchema } from "./sesion";
import { sumarDiasISO } from "./fechas";

/**
 * DTOs de la API (cuerpos de cada endpoint).
 *
 * Los usa el frontend para armar los pedidos y NestJS para validarlos.
 * Todos son ESTRICTOS: una clave que no está en el esquema se rechaza (400),
 * así no se cuela ningún campo que no se haya previsto (por ejemplo coach_id).
 *
 * Los ids de las altas los genera el cliente (UUID) para que la interfaz pueda
 * mostrar el dato al instante; el servidor los acepta o responde 409 si ya existen.
 */

export const uuidSchema = z.uuid("Identificador inválido");

/** hasta mañana: tolera la diferencia de zona horaria entre el navegador y el servidor */
const fechaHastaManana = fechaISO.refine((f) => f <= sumarDiasISO(1), "La fecha no puede ser futura");

/* ───────────── Alumnos ───────────── */

export const altaAlumnoApi = crearAlumnoDto.extend({ id: uuidSchema }).strict();

/** Lo que puede editar el profe */
export const parcheAlumnoProfeApi = actualizarAlumnoDto.strict();

/** Lo único que puede editar el alumno en su propia fila */
export const parcheAlumnoAlumnoApi = alumnoSchema.pick({ notasAlumno: true }).partial().strict();

export const CAMPOS_ALUMNO_EDITABLES_POR_ALUMNO = ["notasAlumno"] as const;

/* ───────────── Ficha médica ───────────── */

/** El certificado y las lesiones tienen sus propios endpoints */
export const parcheFichaApi = fichaMedicaSchema
  .pick({ fechaNacimiento: true, lugarNacimiento: true, enfermedades: true, contacto: true })
  .partial()
  .strict();

export const altaLesionApi = lesionSchema.extend({ id: uuidSchema }).strict();
export const parcheLesionApi = lesionSchema.omit({ id: true }).partial().strict();

/** Solo el vencimiento se edita; el archivo se sube y se borra con sus endpoints */
export const parcheCertificadoApi = z
  .object({ vencimiento: fechaISO.nullable() })
  .strict();

/* ───────────── Marcas ───────────── */

export const altaMarcaApi = marcaSchema
  .omit({ id: true })
  .extend({ id: uuidSchema, fecha: fechaHastaManana })
  .strict();
export const parcheMarcaApi = marcaSchema
  .omit({ id: true })
  .extend({ fecha: fechaHastaManana })
  .partial()
  .strict();

/* ───────────── Planes y ejercicios ───────────── */

/** `tipo` y `activo` son opcionales: sin tipo es "Running" y sin activo queda inactivo */
export const altaPlanApi = planSchema
  .pick({ nombre: true, tipo: true, activo: true })
  .partial({ tipo: true, activo: true })
  .extend({ id: uuidSchema })
  .strict();
/** El tipo no se cambia después de crear el plan; activar uno desactiva el de su mismo tipo */
export const parchePlanApi = planSchema.pick({ nombre: true, activo: true }).partial().strict();

/** `bloque` y `descanso` son opcionales: sin bloque queda en "Entrenamiento" y sin descanso, vacío */
export const altaEjercicioApi = ejercicioSchema
  .extend({ id: uuidSchema })
  .partial({ bloque: true, descanso: true })
  .strict();
/** Lo que puede editar el profe de un ejercicio */
export const parcheEjercicioProfeApi = ejercicioSchema.omit({ id: true }).partial().strict();
/** Lo único que puede editar el alumno de un ejercicio */
export const parcheEjercicioAlumnoApi = ejercicioSchema
  .pick({ peso: true, pesoFecha: true })
  .partial()
  .strict();

export const CAMPOS_EJERCICIO_EDITABLES_POR_ALUMNO = ["peso", "pesoFecha"] as const;

/* ───────────── Carreras e inscripciones ───────────── */

export const altaCarreraApi = crearCarreraDto.extend({ id: uuidSchema }).strict();
export const parcheCarreraApi = crearCarreraDto.partial().strict();

export const altaInscripcionApi = z
  .object({
    id: uuidSchema,
    carreraId: uuidSchema,
    distanciaKm: distanciaKmSchema,
    objetivoSeg: tiempoSegSchema.nullable(),
  })
  .strict();

/** Lo que se puede editar de una inscripción (lo mismo para el profe y para el alumno dueño) */
export const parcheInscripcionProfeApi = z
  .object({
    distanciaKm: distanciaKmSchema,
    objetivoSeg: tiempoSegSchema.nullable(),
    resultadoSeg: tiempoSegSchema.nullable(),
  })
  .partial()
  .strict();


/* ───────────── Catálogo ───────────── */

export const altaEjercicioCustomApi = ejercicioCustomSchema.extend({ id: uuidSchema }).strict();

/** Renombrar un ejercicio del profe o cambiarle la categoría */
export const parcheEjercicioCustomApi = ejercicioCustomSchema
  .pick({ nombre: true, categoria: true })
  .partial()
  .strict();

/* ───────────── Invitaciones ───────────── */

/** Contraseña que elige el alumno al aceptar la invitación (más exigente que el mínimo de Supabase) */
export const claveNuevaSchema = z
  .string()
  .min(8, "La contraseña tiene que tener al menos 8 caracteres")
  .max(128, "La contraseña es demasiado larga");

/** Token del enlace del mail: aleatorio, solo caracteres seguros para una URL */
export const tokenInvitacionSchema = z
  .string()
  .min(20, "El enlace no es válido")
  .max(100, "El enlace no es válido")
  .regex(/^[A-Za-z0-9_-]+$/, "El enlace no es válido");

export const aceptarInvitacionApi = z
  .object({ token: tokenInvitacionSchema, clave: claveNuevaSchema })
  .strict();

/** Invitar no lleva datos: el email sale del alumno (o de su cuenta si ya existe) */
export const invitarAlumnoApi = z.object({}).strict();

export const invitacionEnviadaSchema = z.object({
  enviadoA: z.string(),
  expiraEn: z.string(),
});

/** Entregar el acceso sin mail: la API genera una contraseña aleatoria y se la muestra UNA vez al profe */
export const credencialesEntregadasSchema = z.object({
  email: z.string(),
  clave: z.string(),
});

/** Cambio de contraseña de quien tiene la sesión iniciada (profe o alumno) */
export const cambiarClaveApi = z
  .object({
    claveActual: z.string().min(1, "Escribí tu contraseña actual").max(200),
    claveNueva: claveNuevaSchema,
  })
  .strict();

/** Lo que ve quien abre el enlace antes de elegir su contraseña */
export const invitacionConsultaSchema = z.object({
  nombre: z.string(),
  email: z.string(),
  profe: z.string(),
});

/* ───────────── Respuestas ───────────── */

/** Todo lo que el usuario puede ver, en una sola respuesta (GET /datos) */
export const datosApiSchema = z.object({
  session: sessionSchema,
  alumnos: z.array(alumnoSchema),
  carreras: z.array(carreraSchema),
  inscripciones: z.array(inscripcionSchema),
  ejerciciosCustom: z.array(ejercicioCustomSchema),
});

/** Cuerpo de los errores de la API */
export const errorApiSchema = z.object({
  statusCode: z.number(),
  codigo: z.string(),
  mensaje: z.string(),
  detalles: z.record(z.string(), z.string()).optional(),
  requestId: z.string().optional(),
});

export type DatosApi = z.output<typeof datosApiSchema>;
export type CredencialesEntregadas = z.output<typeof credencialesEntregadasSchema>;
export type InvitacionEnviada = z.output<typeof invitacionEnviadaSchema>;
export type InvitacionConsulta = z.output<typeof invitacionConsultaSchema>;
export type ErrorApi = z.output<typeof errorApiSchema>;
