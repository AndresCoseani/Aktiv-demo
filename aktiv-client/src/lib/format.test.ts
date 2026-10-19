import { describe, expect, it } from "vitest";
import {
  diasHasta,
  edadDesde,
  formatRitmo,
  formatTiempo,
  hoyISO,
  parseISO,
  parseTiempo,
  sumarDias,
  sumarMeses,
  toISO,
} from "./format";

describe("tiempos de carrera", () => {
  it("interpreta mm:ss y h:mm:ss", () => {
    expect(parseTiempo("24:35")).toBe(24 * 60 + 35);
    expect(parseTiempo("1:45:10")).toBe(3600 + 45 * 60 + 10);
    expect(parseTiempo(" 52:00 ")).toBe(3120);
  });

  it("rechaza lo que no es un tiempo", () => {
    for (const v of ["", "abc", "25", "1:2:3:4", "12:60", "61:00:61", "00:00", "-5:00", "1.5:00"]) {
      expect(parseTiempo(v)).toBeNull();
    }
  });

  it("formatTiempo y parseTiempo son inversas", () => {
    for (const seg of [59, 61, 1500, 3599, 3600, 3661, 12_345]) {
      expect(parseTiempo(formatTiempo(seg))).toBe(seg);
    }
  });

  it("calcula el ritmo en min/km", () => {
    expect(formatRitmo(1500, 5)).toBe("5:00");
    expect(formatRitmo(3100, 10)).toBe("5:10");
    expect(formatRitmo(100, 0)).toBe("—");
  });
});

describe("fechas", () => {
  it("parseISO usa hora local (no corre un día)", () => {
    const d = parseISO("2026-10-18");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 18]);
  });

  it("toISO y parseISO son inversas", () => {
    expect(toISO(parseISO("2026-02-28"))).toBe("2026-02-28");
  });

  it("calcula días hasta una fecha", () => {
    expect(diasHasta(hoyISO())).toBe(0);
    expect(diasHasta(sumarDias(5))).toBe(5);
    expect(diasHasta(sumarDias(-3))).toBe(-3);
  });

  it("suma meses de calendario y no se pasa de fin de mes", () => {
    expect(sumarMeses(1, parseISO("2026-10-19"))).toBe("2026-11-19");
    expect(sumarMeses(1, parseISO("2026-12-31"))).toBe("2027-01-31");
    expect(sumarMeses(1, parseISO("2026-01-31"))).toBe("2026-02-28");
    expect(sumarMeses(1, parseISO("2028-01-31"))).toBe("2028-02-29"); // bisiesto
    expect(sumarMeses(12, parseISO("2026-03-15"))).toBe("2027-03-15");
  });

  it("calcula la edad cumplida", () => {
    const hoy = new Date();
    const cumpleHaceTreinta = `${hoy.getFullYear() - 30}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    expect(edadDesde(cumpleHaceTreinta)).toBe(30);
    expect(edadDesde(sumarDias(-1, parseISO(cumpleHaceTreinta)))).toBe(30);
    expect(edadDesde(sumarDias(1, parseISO(cumpleHaceTreinta)))).toBe(29);
  });
});
