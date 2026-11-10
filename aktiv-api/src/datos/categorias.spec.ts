import { cargarCategorias } from "./categorias";
import type { SupabaseService } from "../supabase/supabase.service";

function db(respuestas: unknown[]) {
  const range = jest.fn(); respuestas.forEach((r) => range.mockResolvedValueOnce(r));
  const q = { select: () => q, order: () => q, range };
  return { cliente: { from: jest.fn(() => q) } as unknown as ReturnType<SupabaseService["delUsuario"]>, range };
}
describe("categorías opcionales durante la actualización del esquema", () => {
  it("conserva el catálogo existente si solo falta la tabla nueva", async () => {
    const e = db([{ data: null, error: { code: "PGRST205", message: "Could not find public.categorias_ejercicio in schema cache" } }]);
    expect(await cargarCategorias(e.cliente, [{ categoria: "Fuerza" }, { categoria: "Fuerza" }, { categoria: "Movilidad" }])).toEqual(["Fuerza", "Movilidad"]);
    expect(e.range).toHaveBeenCalledTimes(1);
  });
  it("no oculta fallos de permisos ni caídas de la base", async () => {
    for (const error of [{ code: "42501", message: "permission denied categorias_ejercicio" }, { code: "PGRST000", message: "Connection refused" }, { code: "42P01", message: "relation alumnos does not exist" }]) {
      await expect(cargarCategorias(db([{ data: null, error }]).cliente, [])).rejects.toBeDefined();
    }
  });
  it("pagina el catálogo completo", async () => {
    const e = db([{ data: Array.from({ length: 500 }, (_, i) => ({ nombre: `Cat ${i}` })), error: null }, { data: [{ nombre: "Última" }], error: null }]);
    const nombres = await cargarCategorias(e.cliente, []);
    expect(nombres).toHaveLength(501); expect(nombres.at(-1)).toBe("Última");
    expect(e.range).toHaveBeenLastCalledWith(500, 999);
  });
});
