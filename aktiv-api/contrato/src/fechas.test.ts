import { afterEach, describe, expect, it, vi } from "vitest";
import { hoyISO, sumarDiasISO, toISO } from "./fechas";
import { fechaArgentina } from "./agenda";

afterEach(() => vi.useRealTimers());
describe("Fecha de Aktiv en Argentina", () => {
  it.each([
    ["2026-11-10T01:33:00Z", "2026-11-09"],
    ["2026-11-10T02:59:59Z", "2026-11-09"],
    ["2026-11-10T03:00:00Z", "2026-11-10"],
    ["2027-01-01T01:00:00Z", "2026-12-31"],
  ])("%s corresponde al día %s", (instante, fecha) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(instante));
    expect(hoyISO()).toBe(fecha);
    expect(fechaArgentina()).toBe(fecha);
  });
  it("suma días desde la fecha argentina, aunque UTC ya esté en el siguiente año", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2027-01-01T01:00:00Z"));
    expect(sumarDiasISO(0)).toBe("2026-12-31");
    expect(sumarDiasISO(1)).toBe("2027-01-01");
    expect(sumarDiasISO(-1)).toBe("2026-12-30");
  });
  it("conserva las fechas de calendario construidas localmente", () => {
    expect(toISO(new Date(2026, 10, 9))).toBe("2026-11-09");
  });
});
