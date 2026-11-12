import { describe, expect, it } from "vitest";
import { actividadesBloquesSchema, diasDeSesion, diasSesionSchema, diasInicialesSchema, actividadesIniciales, prescripcionEfectiva, semanaDelPlan, semanasDelPlan, parcheCeldaAlumnoApi, parcheMensualApi, parcheSesionApi, altaMensualApi, altaSesionApi, duplicarSesionApi, duplicarPlanApi, planMensualSchema, type CeldaSemanal } from "./mensual";
const celdas = ["4×8", "", "5×8", ""].map((prescripcion, i): CeldaSemanal => ({ semana: i + 1, prescripcion, peso: String(i + 10), pesoFecha: null }));
describe("plan mensual", () => {
  it("copia planes con destino y fecha válidos sin permitir activar ni sobrescribir contenido", () => {
    const dto = { id: "a0000000-0000-4000-8000-000000000099", alumnoId: "a0000000-0000-4000-8000-000000000098", nombre: " Copia ", inicio: "2026-12-01" };
    expect(duplicarPlanApi.parse(dto).nombre).toBe("Copia");
    for (const campos of [{ nombre: " " }, { alumnoId: "otro" }, { inicio: "2026-02-30" }, { activo: true }, { semanas: 4 }, { sesiones: [] }]) {
      expect(duplicarPlanApi.safeParse({ ...dto, ...campos }).success).toBe(false);
    }
  });
  it("valida la copia sin aceptar pesos, contenido ni cambio de tipo/plan", () => {
    const dto = { id: "a0000000-0000-4000-8000-000000000099", nombre: " Copia ", dia: null };
    expect(duplicarSesionApi.parse(dto)).toEqual({ ...dto, nombre: "Copia" });
    for (const campos of [{ nombre: " " }, { dia: 8 }, { tipo: "Running" }, { plan_id: dto.id }, { ejercicios: [] }, { peso: "12" }]) {
      expect(duplicarSesionApi.safeParse({ ...dto, ...campos }).success).toBe(false);
    }
  });
  it("combina texto y activación sin inyectar listas al editar otro campo", () => {
    const activacion = [{ id: "a0000000-0000-4000-8000-000000000001", nombre: "Rolo", indicacion: "1 min por grupo muscular" }];
    expect(parcheSesionApi.parse({ calentamiento: "Una serie", activacion })).toEqual({ calentamiento: "Una serie", activacion });
    expect(parcheSesionApi.parse({ nombre: "Día 1" })).toEqual({ nombre: "Día 1" });
    expect(parcheSesionApi.safeParse({ activacion: [...activacion, ...activacion] }).success).toBe(false);
    expect(parcheSesionApi.safeParse({ activacion: [{ ...activacion[0], indicacion: "x".repeat(301) }] }).success).toBe(false);
  });
  it("separa fases sin reclasificar ejercicios anteriores y rechaza fases desconocidas", () => {
    const e = { id: "a0000000-0000-4000-8000-000000000001", nombre: "Tobillo", indicacion: "10 rep" };
    expect(parcheSesionApi.parse({ activacion: [e] }).activacion![0].fase).toBeUndefined();
    for (const fase of ["Movilidad", "Activación"]) expect(parcheSesionApi.safeParse({ activacion: [{ ...e, fase }] }).success).toBe(true);
    expect(parcheSesionApi.safeParse({ activacion: [{ ...e, fase: "Otra" }] }).success).toBe(false);
  });
  it("guarda bloques vacíos en orden sin agregarlos a parches de otros campos", () => {
    expect(parcheSesionApi.parse({ bloques: [7, 1] })).toEqual({ bloques: [7, 1] });
    expect(parcheSesionApi.parse({ nombre: "Fuerza A" })).toEqual({ nombre: "Fuerza A" });
    expect(parcheSesionApi.safeParse({ bloques: [1, 1] }).success).toBe(false);
    expect(parcheSesionApi.safeParse({ bloques: [21] }).success).toBe(false);
  });
  it("solo permite un tipo de entrenamiento por plan", () => {
    const base = { id: "a0000000-0000-4000-8000-000000000001", nombre: "Base", tipo: "Fuerza", inicio: "2026-11-02", activo: false, semanas: 6 };
    expect(altaMensualApi.parse({ ...base, diasIniciales: { tipo: "Fuerza", dias: 3 } }).tipo).toBe("Fuerza");
    expect(altaMensualApi.safeParse({ ...base, tipo: "Running", diasIniciales: { tipo: "Running", dias: 3 } }).success).toBe(false);
    expect(altaMensualApi.safeParse({ ...base, diasIniciales: { tipo: "Running", dias: 3 }, tipo: "Fuerza" }).success).toBe(false);
    for (const diasIniciales of [{ tipo: "Fuerza", dias: 0 }, { tipo: "Fuerza", dias: 8 }, { tipo: "Fuerza", dias: 1.5 }]) {
      expect(altaMensualApi.safeParse({ ...base, diasIniciales }).success).toBe(false);
    }
  });
  it("acepta Running semanal dentro de un plan de Fuerza existente", () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    expect(planMensualSchema.safeParse({ id, nombre: "Base", tipo: "Fuerza", inicio: "2026-11-02", activo: false, orden: 0, semanas: 4, sesiones: [], distribucion: { base: { 2: [{ tipo: "Running" }] } }, running: { 1: { martes: "Series y afloje", sugerencias: "Hidratarse" } } }).success).toBe(true);
  });
  it("hereda la última prescripción sin mirar semanas futuras ni modificar pesos", () => {
    expect([1, 2, 3, 4].map((s) => prescripcionEfectiva(celdas, s))).toEqual(["4×8", "4×8", "5×8", "5×8"]);
    expect(prescripcionEfectiva([...celdas].reverse(), 2)).toBe("4×8");
    expect(celdas[1].peso).toBe("11");
    expect(celdas[1].prescripcion).toBe("");
    expect(prescripcionEfectiva(celdas.slice(2), 1)).toBe("");
  });
  it("calcula cuatro semanas de siete días sin reiniciar el mes", () => {
    for (const [fecha, semana] of [["2026-11-01", null], ["2026-11-02", 1], ["2026-11-08", 1], ["2026-11-09", 2], ["2026-11-29", 4], ["2026-11-30", null]] as const) {
      expect(semanaDelPlan("2026-11-02", fecha)).toBe(semana);
    }
  });
  it("permite seis, ocho o más semanas y no termina al día 28", () => {
    expect(semanasDelPlan(6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(semanaDelPlan("2026-11-02", "2026-11-30", 6)).toBe(5);
    expect(semanaDelPlan("2026-11-02", "2026-12-13", 6)).toBe(6);
    expect(semanaDelPlan("2026-11-02", "2026-12-14", 6)).toBeNull();
    expect(semanaDelPlan("2026-11-02", "2026-12-14", 8)).toBe(7);
    expect(semanaDelPlan("2026-11-02", "2027-01-24", 12)).toBe(12);
  });
  it("no permite activar por PATCH; la activación requiere el flujo de confirmación", () => {
    expect(parcheMensualApi.parse({ nombre: "Base 10K" })).toEqual({ nombre: "Base 10K" });
    expect(parcheMensualApi.parse({ activo: false })).toEqual({ activo: false });
    expect(parcheMensualApi.safeParse({ activo: true }).success).toBe(false);
    expect(parcheMensualApi.safeParse({ semanas: 0 }).success).toBe(false);
    expect(altaMensualApi.parse({ id: "a0000000-0000-4000-8000-000000000001", nombre: "Base", tipo: "Fuerza", inicio: "2026-11-02", activo: false, semanas: 6 }).semanas).toBe(6);
  });
  it("el alumno no puede mandar prescripciones ni parches vacíos", () => {
    expect(parcheCeldaAlumnoApi.safeParse({ prescripcion: "9×9" }).success).toBe(false);
    expect(parcheCeldaAlumnoApi.safeParse({}).success).toBe(false);
    expect(parcheCeldaAlumnoApi.safeParse({ peso: "12,5", pesoFecha: "2026-01-01" }).success).toBe(true);
  });
  it("rechaza días y tipos fuera de rango", () => {
    const base = { id: "a0000000-0000-4000-8000-000000000001", dia: 1, tipo: "Fuerza", nombre: "A", calentamiento: "", enfriamiento: "" };
    expect(altaSesionApi.safeParse(base).success).toBe(true);
    expect(altaSesionApi.safeParse({ ...base, dia: null }).success).toBe(true);
    expect(altaSesionApi.safeParse({ ...base, dia: 0 }).success).toBe(false);
    expect(altaSesionApi.safeParse({ ...base, tipo: "Movilidad" }).success).toBe(true);
    expect(altaSesionApi.safeParse({ ...base, tipo: " " }).success).toBe(false);
    expect(altaSesionApi.safeParse({ ...base, tipo: "x".repeat(81) }).success).toBe(false);
  });
  it("admite una actividad libre por plan y normaliza su nombre", () => {
    expect(actividadesIniciales(diasInicialesSchema.parse({ tipo: " Fuerza ", dias: 1 }))).toEqual([{ tipo: "Fuerza", dias: 1 }]);
    expect(diasInicialesSchema.parse({ tipo: " Movilidad   suave ", dias: 2 })).toEqual({ tipo: "Movilidad suave", dias: 2 });
    for (const dato of [{ tipo: " ", dias: 1 }, { tipo: "A", dias: 0 }, { tipo: "A", dias: 8 }]) expect(diasInicialesSchema.safeParse(dato).success).toBe(false);
  });
});

describe("asignación múltiple de días",()=>{
 it("conserva sesiones anteriores y permite quitar todos los días",()=>{expect(diasDeSesion({dia:3})).toEqual([3]);expect(diasDeSesion({dia:1,dias:[]})).toEqual([]);expect(diasDeSesion({dia:1,dias:[1,3,5]})).toEqual([1,3,5]);});
 it("rechaza días inválidos o repetidos",()=>{for(const d of [[0],[8],[1,1],[1.5],[null]])expect(diasSesionSchema.safeParse(d).success).toBe(false);expect(parcheSesionApi.parse({dias:[1,3,5],dia:1}).dias).toEqual([1,3,5]);});
});

describe("actividades de los bloques",()=>{
 it("acepta grupos 1 a 20 y conserva el PATCH anterior sin valores implícitos",()=>{
  expect(actividadesBloquesSchema.parse({1:"Movilidad",2:"Activación",20:"Fuerza"})).toEqual({1:"Movilidad",2:"Activación",20:"Fuerza"});
  for(const valor of [{0:"Fuerza"},{21:"Fuerza"},{"01":"Fuerza"},{1:"Otra"},{1:null},[]])expect(actividadesBloquesSchema.safeParse(valor).success).toBe(false);
  expect(parcheSesionApi.parse({nombre:"Anterior"})).toEqual({nombre:"Anterior"});
 });
});

