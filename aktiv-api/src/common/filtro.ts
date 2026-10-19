import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { ThrottlerException } from "@nestjs/throttler";
import type { RequestConUsuario } from "./tipos";

/**
 * Filtro global: toda respuesta de error sale con el mismo formato y sin
 * detalles internos (nada de stack traces ni mensajes de la base).
 */
@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly log = new Logger("Errores");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestConUsuario>();
    const requestId = req.id;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let codigo = "error_interno";
    let mensaje = "Ocurrió un error. Probá de nuevo.";
    let detalles: Record<string, string> | undefined;

    if (exception instanceof ThrottlerException) {
      statusCode = HttpStatus.TOO_MANY_REQUESTS;
      codigo = "demasiadas_solicitudes";
      mensaje = "Demasiados pedidos. Esperá un momento.";
    } else if (this.errorDeMiddleware(exception)) {
      // errores 4xx del parser de Express (cuerpo muy grande, JSON roto…)
      const e = exception as { status: number; type?: string };
      statusCode = e.status;
      if (e.type === "entity.too.large") {
        codigo = "cuerpo_demasiado_grande";
        mensaje = "El pedido es demasiado grande.";
      } else if (e.type === "entity.parse.failed") {
        codigo = "json_invalido";
        mensaje = "El cuerpo del pedido no es un JSON válido.";
      } else {
        codigo = `http_${statusCode}`;
        mensaje = this.mensajeHttp(statusCode);
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const cuerpo = exception.getResponse();
      if (typeof cuerpo === "object" && cuerpo !== null && "codigo" in cuerpo) {
        const c = cuerpo as { codigo: string; mensaje: string; detalles?: Record<string, string> };
        codigo = c.codigo;
        mensaje = c.mensaje;
        detalles = c.detalles;
      } else if (statusCode === 400 && /json/i.test(String((cuerpo as { message?: unknown })?.message ?? ""))) {
        // Nest envuelve el error del parser de JSON en un BadRequestException
        codigo = "json_invalido";
        mensaje = "El cuerpo del pedido no es un JSON válido.";
      } else {
        codigo = `http_${statusCode}`;
        mensaje = this.mensajeHttp(statusCode);
      }
    }

    if (statusCode >= 500) {
      // el detalle real queda solo en el log del servidor
      const e = exception instanceof Error ? exception : new Error(String(exception));
      this.log.error(`[${requestId}] ${req.method} ${req.url} → ${statusCode}: ${e.message}`, e.stack);
    }

    res.status(statusCode).json({ statusCode, codigo, mensaje, ...(detalles ? { detalles } : {}), requestId });
  }

  private errorDeMiddleware(e: unknown): boolean {
    if (typeof e !== "object" || e === null || e instanceof HttpException) return false;
    const status = (e as { status?: unknown }).status;
    return typeof status === "number" && status >= 400 && status < 500;
  }

  private mensajeHttp(status: number) {
    switch (status) {
      case 400:
        return "Pedido inválido.";
      case 404:
        return "No existe.";
      case 413:
        return "El archivo o el pedido es demasiado grande.";
      case 415:
        return "Tipo de contenido no permitido.";
      default:
        return "Ocurrió un error. Probá de nuevo.";
    }
  }
}
