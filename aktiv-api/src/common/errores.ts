import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Errores de la API con un formato único:
 *   { statusCode, codigo, mensaje, detalles?, requestId }
 * `codigo` es estable (el frontend puede decidir por él); `mensaje` está en
 * español y es seguro mostrarlo. Nunca se filtran detalles internos.
 */
export class ErrorApi extends HttpException {
  /** Solo para diagnóstico del servidor. Nunca se serializa en la respuesta HTTP. */
  codigoDb?: string;
  constructor(
    status: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: Record<string, string>,
  ) {
    super({ codigo, mensaje, detalles }, status);
    this.message = mensaje;
  }
}

export const noAutenticado = (codigo = "no_autenticado", mensaje = "Tenés que iniciar sesión.") =>
  new ErrorApi(HttpStatus.UNAUTHORIZED, codigo, mensaje);

export const sinPermiso = (mensaje = "No tenés permiso para hacer esto.") =>
  new ErrorApi(HttpStatus.FORBIDDEN, "sin_permiso", mensaje);

export const noEncontrado = (que = "El recurso") =>
  new ErrorApi(HttpStatus.NOT_FOUND, "no_encontrado", `${que} no existe o no tenés acceso.`);

export const reglaDeNegocio = (codigo: string, mensaje: string) =>
  new ErrorApi(HttpStatus.UNPROCESSABLE_ENTITY, codigo, mensaje);

export type ErrorDb = { code?: string; message: string; details?: string; hint?: string };

/**
 * Traduce un error de PostgREST/Postgres a un error de la API.
 * Los mensajes de los triggers propios (P0001) son seguros y están en español.
 */
export function errorDeDb(e: ErrorDb): HttpException {
  const error = traducirErrorDeDb(e);
  if (error instanceof ErrorApi && e.code && /^[A-Z0-9]{1,16}$/.test(e.code)) error.codigoDb = e.code;
  return error;
}

function traducirErrorDeDb(e: ErrorDb): HttpException {
  if (e.code === "23514" && /La distribución debe usar solo la actividad del plan/.test(e.message)) {
    return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "planificacion_running_migracion_pendiente", "Falta aplicar la migración 20261128000000 para permitir Running en la planificación semanal.");
  }
  if (["PGRST202","PGRST205","42P01","42883"].includes(e.code??"") && /\b(solicitudes_alta|completar_registro_alumno|aprobar_registro_alumno)\b/.test(e.message)) return new ErrorApi(503,"registro_esquema_desactualizado","Falta aplicar la migración 49 para habilitar las solicitudes de alta.");
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(e.code ?? "") && /\b(actividades_plan|crear_plan_con_actividades)\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "actividades_esquema_desactualizado", "Falta aplicar la migración 48 para habilitar actividades libres y planes simultáneos.");
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(e.code ?? "") && /\b(planes_modelo|asignar_plan_modelo)\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "modelos_esquema_desactualizado", "Para habilitar la biblioteca de planes falta aplicar la migración 47. Los planes de los alumnos siguen disponibles.");
  if (["PGRST204", "42703"].includes(e.code ?? "") && /\bobjetivo\b/.test(e.message) && /\binscripciones\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "objetivo_esquema_desactualizado", "Para guardar objetivos de texto falta aplicar la migración 46.");
  if (e.code === "23514" && /\bsesiones_activacion_valida\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "fases_esquema_desactualizado", "Revisá la migración 45 para guardar movilidad y activación por separado.");
  if (/\b(distribucion|asignar_dia_plan|copiar_semana_plan)\b/.test(e.message) && ["PGRST202","PGRST204","42703"].includes(e.code??"")) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE,"planificacion_esquema_desactualizado","Falta aplicar la migración 54 para habilitar la planificación unificada. Tus planes anteriores se conservan.");
  if (/\b(dias|duplicar_sesion_dias)\b/.test(e.message) && ["PGRST202","PGRST204","42703"].includes(e.code ?? "")) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE,"dias_esquema_desactualizado","Falta aplicar la migración 52 para asignar una rutina a varios días. Tus entrenamientos anteriores se conservan.");
  if (/\b(guardar_running|running)\b/.test(e.message) && ["PGRST202","PGRST204","42703"].includes(e.code ?? "")) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE,"running_esquema_desactualizado","Falta aplicar la migración 51 de Running. Tus datos anteriores se conservan.");
  if (/\b(crear_categoria_ejercicio|categorias_ejercicio)\b/.test(e.message) && ["PGRST202", "PGRST205", "42P01", "42883"].includes(e.code ?? "")) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "categorias_esquema_desactualizado", "Para crear categorías nuevas falta aplicar la migración 44. Tus ejercicios y planes actuales siguen disponibles.");
  if (/\bseguimientos_sesion\b/.test(e.message) && ["PGRST205", "42P01"].includes(e.code ?? "")) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "seguimiento_esquema_desactualizado", "Falta habilitar el seguimiento. Aplicá la migración 43 y reintentá.");
  switch (e.code) {
    case "PGRST202":
    case "42883":
      if (/\bduplicar_plan\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "planes_esquema_desactualizado", "Falta habilitar la copia de planes. Aplicá la migración 42 y reintentá.");
      if (/\bduplicar_sesion\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "sesiones_esquema_desactualizado", "Falta habilitar la copia de días. Aplicá la migración 41 y reintentá.");
      if (/\bconfirmar_llegada_clase\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "agenda_esquema_desactualizado", "Falta habilitar la hora de llegada. Aplic? la migraci?n 40 y reintent?.");
      if (/\bguardar_cambio_horario\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "agenda_esquema_desactualizado", "Falta habilitar los cambios de horario. Aplicá la migración 39 después de la 38 y reintentá.");
      if (/\bcrear_plan_con_dias\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "planes_esquema_desactualizado", "Falta habilitar la creación del plan con sus días. Aplicá la migración 32 después de la 31 y reintentá.");
      return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "esquema_desactualizado", "Falta actualizar una función de la base. Revisá las migraciones pendientes.");
    case "23502":
      if (/\bdia\b/.test(e.message) && /\bsesiones\b/.test(e.message)) {
        return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "sesiones_esquema_desactualizado", "Falta habilitar entrenamientos sin día fijo. Aplicá la migración 31 y reintentá.");
      }
      return new ErrorApi(HttpStatus.UNPROCESSABLE_ENTITY, "campo_requerido", "Falta completar un campo obligatorio.");
    case "PGRST204": // columna ausente del schema cache de PostgREST
      if (/\b(dni|franja)\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "lucas_esquema_desactualizado", "Supabase no reconoce los nuevos campos. Revisá verificar_actualizacion_lucas.sql; si da todo true, recargá el esquema y verificá el proyecto configurado en la API.");
      return new ErrorApi(
        HttpStatus.SERVICE_UNAVAILABLE,
        /\bsesiones\b/.test(e.message) ? "sesiones_esquema_desactualizado" : /\bplanes_mensuales\b/.test(e.message) ? "planes_esquema_desactualizado" : "esquema_desactualizado",
        "Supabase no reconoce una columna de esta versión. Revisá verificar_planes.sql; si da todo true, recargá la caché con recargar_esquema.sql y verificá que la API use ese mismo proyecto.",
      );
    case "42703": // columna ausente en Postgres
      if (/\b(dni|franja)\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "lucas_esquema_desactualizado", "La API no encuentra los nuevos campos. Ejecutá verificar_actualizacion_lucas.sql en el proyecto configurado en la API y revisá la migración 36.");
      if (/\bactivacion\b/.test(e.message) && /\bsesiones\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "sesiones_esquema_desactualizado", "Falta habilitar los ejercicios de entrada en calor. Aplicá la migración 35 y reintentá.");
      if (/\bbloques\b/.test(e.message) && /\bsesiones\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "sesiones_esquema_desactualizado", "Falta habilitar los bloques de ejercicios. Aplicá la migración 33 y reintentá.");
      if (/\bsemanas\b/.test(e.message) && /\bplanes_mensuales\b/.test(e.message)) {
        return new ErrorApi(
          HttpStatus.SERVICE_UNAVAILABLE,
          "planes_esquema_desactualizado",
          "La base de datos todavía no tiene la duración configurable de los planes. Aplicá la migración 30 (después de la 29) y reintentá.",
        );
      }
      return new ErrorApi(
        HttpStatus.SERVICE_UNAVAILABLE,
        "esquema_desactualizado",
        "La base de datos no está actualizada para esta versión. Revisá las migraciones pendientes.",
      );
    case "PGRST205": // tabla ausente del schema cache
    case "42P01": // tabla ausente en Postgres
      if (/\bcambios_horario_clase\b/.test(e.message)) return new ErrorApi(HttpStatus.SERVICE_UNAVAILABLE, "agenda_esquema_desactualizado", "Falta habilitar los cambios de horario. Revisá verificar_actualizacion_lucas.sql y aplicá la migración 39 después de la 38.");
      return new ErrorApi(
        HttpStatus.SERVICE_UNAVAILABLE,
        "esquema_desactualizado",
        "Faltan tablas de esta versión en la base de datos. Revisá las migraciones pendientes.",
      );
    case "P0002":
      return noEncontrado();
    case "42501": // RLS o trigger de permisos
      return sinPermiso();
    case "23505":
      return new ErrorApi(HttpStatus.CONFLICT, "ya_existe", "Ese dato ya existe.");
    case "23503":
      return new ErrorApi(HttpStatus.CONFLICT, "referencia_invalida", "Hay un dato relacionado que no existe.");
    case "23514":
    case "22001":
    case "22003":
    case "23502":
      return new ErrorApi(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "datos_no_validos",
        "Los datos no cumplen las reglas del sistema.",
      );
    case "22P02":
    case "22007":
    case "22008":
      return new ErrorApi(HttpStatus.BAD_REQUEST, "dato_invalido", "Hay un dato con formato inválido.");
    case "P0001":
      return reglaDeNegocio("regla_de_negocio", e.message);
    case "PGRST116":
      return noEncontrado();
    case "PGRST301":
    case "PGRST303":
      return noAutenticado("token_invalido", "Tu sesión no es válida. Iniciá sesión de nuevo.");
    default:
      return new ErrorApi(HttpStatus.INTERNAL_SERVER_ERROR, "error_interno", "Ocurrió un error. Probá de nuevo.");
  }
}

/** Lanza el error traducido si la consulta falló */
export function lanzarSiError(error: ErrorDb | null | undefined): void {
  if (error) throw errorDeDb(error);
}

/** Asegura que hay un dato (una consulta `.single()` puede devolver null sin error) */
export function existe<T>(dato: T | null | undefined, que = "El recurso"): T {
  if (dato === null || dato === undefined) throw noEncontrado(que);
  return dato;
}
