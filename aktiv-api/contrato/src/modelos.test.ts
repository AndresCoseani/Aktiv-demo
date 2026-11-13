import { asignarModeloApi, crearModeloApi, planModeloSchema } from "./modelos";
import { describe, expect, it } from "vitest";

const uuid = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("planes modelo", () => {
  it("requiere que el modelo tenga un solo tipo de actividad", () => {
    const base = { id: uuid(1), nombre: "Fuerza base", tipo: "Fuerza", semanas: 4, diasIniciales: { tipo: "Fuerza", dias: 3 } };
    expect(crearModeloApi.safeParse(base).success).toBe(true);
    expect(crearModeloApi.safeParse({ ...base, diasIniciales: { tipo: "Running", dias: 3 } }).success).toBe(false);
    expect(crearModeloApi.safeParse({ ...base, tipo: "Running", diasIniciales: { tipo: "Running", dias: 3 } }).success).toBe(false);
  });

  it("acepta indicaciones de Running como complemento semanal de un modelo de rutina", () => {
    expect(planModeloSchema.safeParse({ id: uuid(1), nombre: "Fuerza base", tipo: "Fuerza", semanas: 4, sesiones: [], revision: 0, running: { 1: { miercoles: "Rodaje suave", sugerencias: "Ritmo cómodo" } }, distribucion: { base: { 3: [{ tipo: "Running" }] } } }).success).toBe(true);
  });

  it("valida una sesión por día y asigna cada sesión a un solo día", () => {
    const base = { id: uuid(1), nombre: "Fuerza base", alumnoId: uuid(2), inicio: "2026-11-12", semanas: 4 };
    expect(asignarModeloApi.parse({ ...base, asignaciones: [{ dia: 1, sesionId: uuid(3) }] }).asignaciones).toEqual([{ dia: 1, sesionId: uuid(3) }]);
    expect(asignarModeloApi.safeParse({ ...base, asignaciones: [{ dia: 1, sesionId: uuid(3) }, { dia: 1, sesionId: uuid(4) }] }).success).toBe(false);
    expect(asignarModeloApi.safeParse({ ...base, asignaciones: [{ dia: 1, sesionId: uuid(3) }, { dia: 2, sesionId: uuid(3) }] }).success).toBe(false);
    expect(asignarModeloApi.safeParse({ ...base, asignaciones: [{ dia: 8, sesionId: uuid(3) }] }).success).toBe(false);
  });
});
