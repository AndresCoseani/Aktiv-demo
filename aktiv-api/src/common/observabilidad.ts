import { Injectable, Logger, type BeforeApplicationShutdown } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const arranqueId = randomUUID();
const log = new Logger("Disponibilidad");
let ultimoHealth = -Infinity;

function proceso() {
  return { arranqueId, uptimeSeg: Math.floor(process.uptime()), rssMb: Math.round(process.memoryUsage().rss / 1048576) };
}

/** Sin URLs, query strings, cuerpos, cookies ni datos de alumnos. */
export function observarSolicitud(req: Request, res: Response, next: NextFunction) {
  const inicio = performance.now();
  res.setHeader("x-aktiv-boot-id", arranqueId);
  res.once("finish", () => {
    const ms = Math.round(performance.now() - inicio);
    const path = req.path;
    const health = path === "/api/health" || path === "/api/health/supabase";
    const fallo = res.statusCode >= 500;
    const lento = ms >= 5000;
    // Render comprueba salud cada pocos segundos: muestrear éxitos para no inundar logs.
    const mostrarHealth = health && performance.now() - ultimoHealth >= 60000;
    if (!fallo && !lento && !mostrarHealth) return;
    if (mostrarHealth) ultimoHealth = performance.now();
    const evento = JSON.stringify({ evento: "http", ...proceso(), metodo: req.method,
      ruta: health ? path : (typeof req.route?.path === "string" ? req.route.path : "sin_ruta"),
      status: res.statusCode, ms });
    if (fallo || lento) log.warn(evento); else log.log(evento);
  });
  next();
}

/** Solo main instala listeners: los tests que crean varias apps no los acumulan. */
export function observarProceso() {
  log.log(JSON.stringify({ evento: "inicio_proceso", ...proceso(), node: process.version }));
  // Monitor no cambia el comportamiento fatal de Node ni permite seguir tras un crash.
  process.on("uncaughtExceptionMonitor", (error, origen) => {
    log.error(JSON.stringify({ evento: "error_fatal", ...proceso(), origen, tipo: error.name }));
  });
  process.on("exit", (codigo) => {
    log.log(JSON.stringify({ evento: "salida_proceso", ...proceso(), codigo }));
  });
}

@Injectable()
export class RegistroCierre implements BeforeApplicationShutdown {
  beforeApplicationShutdown(signal?: string) {
    // No instalar handlers de señales que interfieran con el cierre de Nest.
    log.warn(JSON.stringify({ evento: "cierre_aplicacion", ...proceso(), signal: signal ?? "cierre_programado" }));
  }
}
