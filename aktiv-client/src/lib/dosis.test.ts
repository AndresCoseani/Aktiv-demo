import { describe, expect, it } from "vitest";
import { separarDosis, separarIndicacion, unirDosis, unirIndicacion } from "./dosis";

describe("adaptador de dosis del editor de días", () => {
  it("mantiene indicaciones libres y combinaciones existentes", () => {
    for (const texto of ['3×8+8"', '4X8', '3 x 10 por lado', '30 segundos suaves', '', '2×(8 + 8)', '3×', '2-3×8']) {
      const d = separarDosis(texto);
      expect(separarDosis(unirDosis(d.series, d.repeticiones))).toEqual(d);
    }
    expect(separarDosis("Rotaciones controladas")).toEqual({series:"",repeticiones:"Rotaciones controladas"});
  });
  it("guarda descanso de movilidad sin perder la indicación", () => {
    const texto = unirIndicacion("2", "8 por lado", "45 s");
    expect(separarIndicacion(texto)).toEqual({series:"2",repeticiones:"8 por lado",descanso:"45 s"});
    expect(separarIndicacion("Pausa: 2 segundos").repeticiones).toBe("Pausa: 2 segundos");
  });
});
