import { describe, expect, it } from "vitest";
import { claveEjercicio, limpiarNombreEjercicio } from "@aktiv/contrato";
import { catalogoCompleto, categoriaDe, categoriasDelCatalogo } from "./dominio";

describe("identidad de nombres de ejercicios", () => {
  it("combina categorías propias vacías y del catálogo sin duplicar equivalentes", () => {
    const categorias = categoriasDelCatalogo([{ nombre: "Apoyo", categoria: "Equilibrio" }], ["Agilidad", "EQUILIBRIO", "agilidad"]);
    expect(categorias.filter((c) => claveEjercicio(c) === "equilibrio")).toHaveLength(1);
    expect(categorias.filter((c) => claveEjercicio(c) === "agilidad")).toHaveLength(1);
    expect(categorias).toContain("Fuerza");
  });
  it("no ofrece sugerencias fijas fuera del catálogo de la base", () => {
    expect(catalogoCompleto([])).toEqual([]);
    expect(categoriaDe("Sentadilla búlgara", [])).toBe("Personalizado");
  });
  it("compara variantes sin convertir el nombre visible en un identificador", () => {
    const variantes = ["Hiptrust", "Hip Trust", " HIP_TRUST ", "hip-trust"];
    expect(new Set(variantes.map(claveEjercicio)).size).toBe(1);
    expect(limpiarNombreEjercicio("  Hip__Trust  ")).toBe("Hip Trust");
    expect(limpiarNombreEjercicio("TRX Remo")).toBe("TRX Remo");
  });
  it("ignora tildes pero no inventa equivalencias entre errores de escritura", () => {
    expect(claveEjercicio("Elevación")).toBe(claveEjercicio("elevacion"));
    expect(claveEjercicio("Hip trust")).not.toBe(claveEjercicio("Hip thrust"));
  });
  it("ofrece una opción por nombre equivalente y reconoce la categoría", () => {
    const custom = [{ nombre: "Hiptrust", categoria: "Fuerza" as const }, { nombre: "Hip Trust", categoria: "Fuerza" as const }];
    expect(catalogoCompleto(custom).filter((e) => claveEjercicio(e.nombre) === "hiptrust")).toHaveLength(1);
    expect(categoriaDe("HIP_TRUST", custom)).toBe("Fuerza");
  });
});
