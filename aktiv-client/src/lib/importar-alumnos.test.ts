import { describe, expect, it } from "vitest";
import { leerCsv, revisarImportacion, sugerirColumnas } from "./importar-alumnos";
describe("importación revisable de alumnos", () => {
  it("lee CSV con BOM, comas, saltos y comillas escapadas", () => {
    const filas = leerCsv('\uFEFFNombre completo,Email,DNI\r\n"Ana, \"\"A\"\"\nPérez",ana@example.test,12.345.678\r\n');
    expect(filas[1]).toEqual(['Ana, "A"\nPérez', "ana@example.test", "12.345.678"]);
  });
  it("lee separadores regionales y combina nombre/apellido", () => {
    const filas = leerCsv("Nombre;Apellido;Dirección de correo electrónico;DNI\nAna;Pérez;ANA@example.test;12.345.678");
    const r = revisarImportacion(filas, sugerirColumnas(filas[0]), []);
    expect(r[0].datos).toMatchObject({ nombre: "Ana Pérez", email: "ana@example.test", dni: "12345678" });
    expect(r[0].error).toBe("");
  });
  it("marca duplicados existentes y dentro del archivo sin modificar datos", () => {
    const filas = leerCsv("Nombre,Email,DNI\nAna,ana@example.test,12345678\nAna2,ANA@example.test,12345679\nSol,sol@example.test,23456789");
    const r = revisarImportacion(filas, sugerirColumnas(filas[0]), [{ dni: "23456789", email: "" }]);
    expect(r.map((a) => Boolean(a.error))).toEqual([false, true, true]);
  });
  it("rechaza archivos incompletos y marca columnas faltantes", () => {
    expect(() => leerCsv('Nombre,Email\n"Ana,ana@example.test')).toThrow(/comillas/);
    const filas = leerCsv("Nombre,Email,DNI\nAna,ana@example.test");
    expect(revisarImportacion(filas, sugerirColumnas(filas[0]), [])[0].error).toContain("columnas");
    expect(() => leerCsv("Nombre\n" + "Ana\n".repeat(201))).toThrow(/200/);
  });
});
