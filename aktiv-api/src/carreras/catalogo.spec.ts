import { CarrerasService } from "./carreras.module";
import type { SupabaseService } from "../supabase/supabase.service";
import type { Usuario } from "../common/tipos";

const usuario: Usuario = { id: "profe", token: "token-profe", rol: "coach", email: "profe@test.local", nombre: "Profe" };
function entorno(filas: { id: string; nombre: string }[]) {
  const q: Record<"select" | "eq" | "order" | "range" | "insert", jest.Mock> = { select: jest.fn(() => q), eq: jest.fn(() => q), order: jest.fn(() => q), range: jest.fn(async (desde: number, hasta: number) => ({ data: filas.slice(desde, hasta + 1), error: null })), insert: jest.fn(async (_dto: unknown) => ({ error: null })) };
  const supa = { delUsuario: jest.fn(() => ({ from: jest.fn(() => q) })) };
  return { servicio: new CarrerasService(supa as unknown as SupabaseService), q, supa };
}
describe("catálogo: normalización de nombres", () => {
  it("rechaza variantes de espacios, mayúsculas y separadores antes de insertar", async () => {
    const e = entorno([{ id: "anterior", nombre: "Hip Trust" }]);
    await expect(e.servicio.crearEjercicioCustom(usuario, { id: "nuevo", nombre: "HIP_TRUST", categoria: "Fuerza" })).rejects.toMatchObject({ status: 409 });
    expect(e.q.insert).not.toHaveBeenCalled();
    expect(e.q.eq).toHaveBeenCalledWith("coach_id", usuario.id);
    expect(e.supa.delUsuario).toHaveBeenCalledWith(usuario.token);
  });
  it("busca duplicados más allá de la primera página", async () => {
    const e = entorno([...Array.from({ length: 500 }, (_, i) => ({ id: String(i), nombre: `Ejercicio ${i}` })), { id: "ultimo", nombre: "Hiptrust" }]);
    await expect(e.servicio.crearEjercicioCustom(usuario, { id: "nuevo", nombre: "Hip Trust", categoria: "Fuerza" })).rejects.toMatchObject({ status: 409 });
    expect(e.q.range).toHaveBeenCalledWith(500, 999);
  });
  it("guarda un nombre legible, sin forzar minúsculas o perder siglas", async () => {
    const e = entorno([]);
    await e.servicio.crearEjercicioCustom(usuario, { id: "nuevo", nombre: " TRX__Remo ", categoria: "Fuerza" });
    expect(e.q.insert).toHaveBeenCalledWith({ id: "nuevo", coach_id: usuario.id, nombre: "TRX Remo", categoria: "Fuerza" });
  });
});
