import { MensualesService } from "./mensuales.module";
import type { SupabaseService } from "../supabase/supabase.service";
import type { Usuario } from "../common/tipos";

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const u = { id: id(1), token: "token-del-usuario", rol: "coach", email: "profe@test.local", nombre: "Profe" } as Usuario;

/** Doble de PostgREST para verificar filtros, paginado y cuerpos sin una base externa. */
function entorno(filas: Record<string, Record<string, unknown>[]> = {}) {
  const paginas: { tabla: string; desde: number }[] = [];
  const parches: { tabla: string; cuerpo: unknown; filtros: Record<string, unknown> }[] = [];
  const db = { from: jest.fn((tabla: string) => {
    const filtros: Record<string, unknown> = {};
    let cuerpo: unknown;
    const orden: string[] = [];
    const leer = () => (filas[tabla] ?? []).filter((r) => Object.entries(filtros).every(([k, v]) => Array.isArray(v) ? v.includes(r[k]) : v === r[k]))
      .sort((a, b) => { for (const k of orden) { const c = String(a[k]).localeCompare(String(b[k])); if (c) return c; } return 0; });
    const q: Record<string, unknown> = {
      select: jest.fn(() => q),
      eq: jest.fn((k: string, v: unknown) => { filtros[k] = v; return q; }),
      in: jest.fn((k: string, v: unknown[]) => { filtros[k] = v; return q; }),
      order: jest.fn((k: string) => { orden.push(k); return q; }),
      update: jest.fn((v: unknown) => { cuerpo = v; return q; }),
      limit: jest.fn(async () => ({ error: null, data: leer().slice(0, 1) })),
      range: jest.fn(async (desde: number, hasta: number) => {
        paginas.push({ tabla, desde }); return { error: null, data: leer().slice(desde, hasta + 1) };
      }),
      maybeSingle: jest.fn(async () => ({ error: null, data: leer()[0] ?? null })),
      then: (resolve: (r: unknown) => unknown) => {
        parches.push({ tabla, cuerpo, filtros }); return Promise.resolve({ error: null, data: leer() }).then(resolve);
      },
    };
    return q;
  }), rpc: jest.fn(async () => ({ error: null, data: id(3) })) };
  const supa = { delUsuario: jest.fn(() => db) };
  return { servicio: new MensualesService(supa as unknown as SupabaseService), db, supa, paginas, parches };
}

describe("Planes mensuales: servicio", () => {
  it("acepta reintentar un ejercicio ya creado dentro de la misma sesión", async () => {
    const e=entorno({sesiones:[{id:id(4)}],sesion_ejercicios:[{id:id(5),sesion_id:id(4),nombre:"Anterior",grupo:1,descanso:"60 s"}]});
    await expect(e.servicio.crear(u,"ejercicio",id(4),{id:id(5),nombre:"Anterior",grupo:1,descanso:"60 s"})).resolves.toEqual({id:id(5)});
    expect(e.db.from).toHaveBeenCalledWith("sesion_ejercicios");
  });
  it("rechaza un identificador existente con contenido distinto", async () => {
    const e=entorno({sesiones:[{id:id(4)}],sesion_ejercicios:[{id:id(5),sesion_id:id(4),nombre:"Anterior",grupo:1,descanso:"60 s"}]});
    await expect(e.servicio.crear(u,"ejercicio",id(4),{id:id(5),nombre:"Otro",grupo:1,descanso:"60 s"})).rejects.toMatchObject({status:409});
  });
  it("crea el plan con sus días usando una única operación como el usuario", async () => {
    const e = entorno({ alumnos: [{ id: id(2), coach_id: u.id, user_id: null }] });
    const dto = { id: id(3), nombre: "Base", tipo: "Fuerza", inicio: "2026-11-02", semanas: 6, activo: false, diasIniciales: { tipo: "Fuerza", dias: 3 } };
    await e.servicio.crear(u, "plan", id(2), dto);
    const { diasIniciales, ...campos } = dto;
    expect(e.db.rpc).toHaveBeenCalledWith("crear_plan_con_actividades", { p_plan: { ...campos, alumno_id: id(2), orden: 0 }, p_actividades: [diasIniciales] });
    expect(e.supa.delUsuario).toHaveBeenCalledWith(u.token);
  });
  it.each([1, null])("mapea y ordena sesiones con día %s, grupos y pesos sin materializar herencia", async (dia) => {
    const e = entorno({
      alumnos: [{ id: id(2), coach_id: u.id, user_id: null }],
      planes_mensuales: [{ id: id(3), alumno_id: id(2), nombre: "Mes", tipo: "Fuerza", inicio: "2026-11-02", activo: true, orden: 0 }],
      sesiones: [{ id: id(4), plan_id: id(3), dia, tipo: "Fuerza", nombre: "A", orden: 0, calentamiento: "Activación", enfriamiento: "Estirar" }],
      sesion_ejercicios: [2, 1].map((n) => ({ id: id(10 + n), sesion_id: id(4), nombre: `Ejercicio ${n}`, orden: n, grupo: n, descanso: "60 s" })),
      ejercicio_semanas: [{ ejercicio_id: id(11), semana: 1, prescripcion: "4×8", peso: null, peso_fecha: null }, { ejercicio_id: id(11), semana: 2, prescripcion: "", peso: "12,5", peso_fecha: "2026-01-01" }],
    });
    const r = await e.servicio.cargar(u, id(2));
    expect(e.supa.delUsuario).toHaveBeenCalledWith(u.token);
    expect(r[0].sesiones[0].dia).toBe(dia);
    expect(r[0].sesiones[0].ejercicios.map((x) => x.grupo)).toEqual([1, 2]);
    expect(r[0].sesiones[0].ejercicios[0].semanas[1]).toEqual({ semana: 2, prescripcion: "", peso: "12,5", pesoFecha: "2026-01-01" });
  });
  it("pagina más de 500 sesiones sin truncarlas", async () => {
    const e = entorno({
      alumnos: [{ id: id(2), coach_id: u.id, user_id: null }],
      planes_mensuales: Array.from({ length: 20 }, (_, i) => ({ id: id(100 + i), alumno_id: id(2), nombre: "Mes", tipo: "Running", inicio: "2026-11-02", activo: i === 0, orden: i })),
      sesiones: Array.from({ length: 520 }, (_, i) => ({ id: id(1000 + i), plan_id: id(100 + Math.floor(i / 26)), dia: i % 7 + 1, tipo: "Running", nombre: "Rodaje", orden: i, calentamiento: "", enfriamiento: "" })),
    });
    const r = await e.servicio.cargar(u, id(2));
    expect(r.flatMap((p) => p.sesiones)).toHaveLength(520);
    expect(e.paginas).toContainEqual({ tabla: "sesiones", desde: 500 });
  });
  it("un alumno ajeno o inexistente se rechaza antes de leer planes", async () => {
    const e = entorno();
    await expect(e.servicio.cargar(u, id(2))).rejects.toMatchObject({ status: 404 });
    expect(e.db.from).toHaveBeenCalledTimes(1);
  });
  it("filtra por ejercicio Y semana y permite borrar peso y fecha con null", async () => {
    const e = entorno({ ejercicio_semanas: [{ ejercicio_id: id(5), semana: 2 }] });
    await e.servicio.celda({ ...u, rol: "alumno" }, id(5), 2, { peso: null, pesoFecha: null });
    expect(e.parches[0]).toEqual({ tabla: "ejercicio_semanas", cuerpo: { peso: null, peso_fecha: null }, filtros: { ejercicio_id: id(5), semana: 2 } });
  });
  it("rechaza campos extra del alumno antes de consultar la base", async () => {
    const e = entorno();
    await expect(e.servicio.celda({ ...u, rol: "alumno" }, id(5), 1, { prescripcion: "9×9" })).rejects.toMatchObject({ status: 403 });
    expect(e.db.from).not.toHaveBeenCalled();
  });
});
