import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Errores de la API con un formato único:
 *   { statusCode, codigo, mensaje, detalles?, requestId }
 * `codigo` es estable (el frontend puede decidir por él); `mensaje` está en
 * español y es seguro mostrarlo. Nunca se filtran detalles internos.
 */
export class ErrorApi extends HttpException {
  constructor(
    status: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: Record<string, string>,
  ) {
    super({ codigo, mensaje, detalles }, status);
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
  switch (e.code) {
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
