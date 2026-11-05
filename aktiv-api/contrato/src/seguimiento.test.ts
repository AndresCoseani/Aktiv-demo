import { describe, expect, it } from "vitest";
import { guardarSeguimientoApi } from "./seguimiento";

describe("Seguimiento", () => {
  it("admite completar sin feedback y normaliza el comentario", () => {
    expect(guardarSeguimientoApi.parse({ completado: true, sensacion: null, nota: " bien " }).nota).toBe("bien");
    expect(guardarSeguimientoApi.safeParse({ completado: true, sensacion: null, nota: "" }).success).toBe(true);
  });
  it("rechaza fechas del cliente, sensaciones desconocidas y feedback sin completar", () => {
    const dto = { completado: true, sensacion: "Bien", nota: "" };
    for (const cambio of [{ fecha: "2026-01-01" }, { sensacion: "Excelente" }, { nota: "x".repeat(501) }, { completado: false }]) {
      expect(guardarSeguimientoApi.safeParse({ ...dto, ...cambio }).success).toBe(false);
    }
  });
});
