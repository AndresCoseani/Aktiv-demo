import { describe, expect, it } from "vitest";
import { fechaParaMostrar, fechaDesdeTexto, errorFechaTexto } from "./fecha-input";

describe("fechas de formularios en español", () => {
  it("muestra primero día, después mes y año y conserva el ISO al enviar", () => {
    expect(fechaParaMostrar("2026-11-02")).toBe("02/11/2026");
    expect(fechaDesdeTexto("02/11/2026")).toBe("2026-11-02");
    expect(fechaDesdeTexto("2/1/2026")).toBe("2026-01-02");
    expect(fechaParaMostrar("")).toBe("");
  });
  it("rechaza fechas inexistentes y respeta años bisiestos", () => {
    expect(fechaDesdeTexto("31/02/2026")).toBeNull();
    expect(fechaDesdeTexto("29/02/2028")).toBe("2028-02-29");
    expect(fechaDesdeTexto("11/30/2026")).toBeNull();
    expect(fechaDesdeTexto("02/11")).toBeNull();
  });
  it("mantiene límites de fechas y deja vaciar los campos opcionales", () => {
    expect(errorFechaTexto("01/01/1999", "2000-01-01")).toContain("01/01/2000");
    expect(errorFechaTexto("01/01/2101", undefined, "2100-01-01")).toContain("01/01/2100");
    expect(errorFechaTexto("02/11/2026", "2000-01-01", "2100-01-01")).toBe("");
    expect(errorFechaTexto("", "2000-01-01")).toBe("");
  });
});
