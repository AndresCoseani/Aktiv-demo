/**
 * Los tipos del dominio se infieren de los esquemas Zod (src/lib/schemas):
 * esa es la fuente única de verdad. Este archivo solo los re-exporta para que
 * el resto de la app importe desde un lugar corto y estable.
 */
export type {
  Alumno,
  CategoriaEjercicio,
  Carrera,
  Certificado,
  ContactoFamiliar,
  DiaEntrenamiento,
  Ejercicio,
  EjercicioCustom,
  EstadoLesion,
  FichaMedica,
  Inscripcion,
  Lesion,
  Marca,
  Nivel,
  Plan,
  Role,
  Session,
} from "./schemas";
