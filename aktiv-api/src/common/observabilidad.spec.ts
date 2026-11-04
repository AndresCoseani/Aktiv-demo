import { Logger } from "@nestjs/common";
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { arranqueId, observarSolicitud, RegistroCierre } from "./observabilidad";

function pedido(path: string, statusCode: number, ruta?: string) {
  const req = { path, method: "GET", route: ruta ? { path: ruta } : undefined } as Request;
  const res = Object.assign(new EventEmitter(), { statusCode, setHeader: jest.fn() });
  const next = jest.fn();
  observarSolicitud(req, res as unknown as Response, next);
  res.emit("finish");
  expect(next).toHaveBeenCalledTimes(1);
  expect(res.setHeader).toHaveBeenCalledWith("x-aktiv-boot-id", arranqueId);
}

describe("diagnóstico sin datos sensibles", () => {
  afterEach(() => jest.restoreAllMocks());
  it("registra fallos con plantilla y no la URL con datos privados", () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    pedido("/api/alumnos/id-privado?email=privado@example.test", 503, "/api/alumnos/:id");
    const evento = JSON.parse(warn.mock.calls[0][0] as string);
    expect(evento).toMatchObject({ evento: "http", status: 503, ruta: "/api/alumnos/:id", arranqueId });
    expect(evento.rssMb).toBeGreaterThan(0);
    expect(JSON.stringify(evento)).not.toContain("privado");
  });
  it("muestrea health exitoso para no inundar los logs", () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    pedido("/api/health", 200);
    pedido("/api/health", 200);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ ruta: "/api/health", status: 200 });
  });
  it("no genera logs por cada solicitud normal", () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    pedido("/api/alumnos", 200, "/api/alumnos");
    expect(log).not.toHaveBeenCalled();
  });
  it("registra el motivo del cierre mediante el ciclo de vida de Nest", () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    new RegistroCierre().beforeApplicationShutdown("SIGTERM");
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({ evento: "cierre_aplicacion", signal: "SIGTERM", arranqueId });
  });
});
