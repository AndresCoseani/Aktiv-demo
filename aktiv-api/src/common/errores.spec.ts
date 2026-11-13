import { ErrorApi, errorDeDb } from "./errores";

describe("diagnóstico seguro de errores de base", () => {
  it("identifica las migraciones de fases y objetivo de texto sin filtrar filas", () => {
    expect(errorDeDb({ code: "PGRST204", message: "Could not find the 'objetivo' column of 'inscripciones'" }).message).toContain("46");
    expect(errorDeDb({ code: "23514", message: 'violates check constraint "sesiones_activacion_valida"', details: "fila privada" }).message).toContain("45");
  });
  it("indica cuando falta permitir Running en la distribución semanal", () => {
    const r = errorDeDb({ code: "23514", message: "La distribución debe usar solo la actividad del plan" });
    expect(r.getStatus()).toBe(503);
    expect(r.getResponse()).toMatchObject({ codigo: "planificacion_running_migracion_pendiente", mensaje: expect.stringContaining("20261128000000") });
  });
  it("limita la migración 44 al alta de categorías sin bloquear el resto de la app", () => {
    expect(errorDeDb({ code: "PGRST202", message: "Could not find public.crear_categoria_ejercicio in the schema cache" }).getResponse()).toMatchObject({ codigo: "categorias_esquema_desactualizado", mensaje: expect.stringContaining("migración 44") });
  });
  it("orienta al diagnóstico de Lucas sin confundir caché con migración faltante", () => {
    const r = errorDeDb({ code: "PGRST204", message: "Could not find the 'dni' column of 'alumnos' in the schema cache" });
    expect(r.getStatus()).toBe(503);
    expect(r.message).toContain("verificar_actualizacion_lucas.sql");
    expect(r.message).not.toContain("Aplicá la migración");
  });
  it("identifica la función de creación con días pendiente", () => {
    expect(errorDeDb({ code: "PGRST202", message: "Could not find public.crear_plan_con_dias in the schema cache" }).getResponse())
      .toMatchObject({ mensaje: expect.stringContaining("migración 32") });
  });
  it("identifica la migración pendiente de día opcional sin revelar la fila", () => {
    const r = errorDeDb({ code: "23502", message: 'null value in column "dia" of relation "sesiones" violates not-null constraint', details: "fila privada" });
    expect(r.getStatus()).toBe(503);
    expect(r.getResponse()).toMatchObject({ codigo: "sesiones_esquema_desactualizado", mensaje: expect.stringContaining("migración 31") });
    expect(JSON.stringify(r.getResponse())).not.toContain("fila privada");
  });
  it("identifica una migración de duración pendiente desde PostgREST", () => {
    const r = errorDeDb({ code: "PGRST204", message: "Could not find the 'semanas' column of 'planes_mensuales' in the schema cache" });
    expect(r.getStatus()).toBe(503);
    expect(r.getResponse()).toMatchObject({ codigo: "planes_esquema_desactualizado", mensaje: expect.stringContaining("recargar_esquema.sql") });
    expect(r.message).not.toContain("Aplicá la migración");
    expect((r as ErrorApi).codigoDb).toBe("PGRST204");
    expect(r.getResponse()).not.toHaveProperty("codigoDb");
  });
  it("identifica también la columna ausente de Postgres", () => {
    expect(errorDeDb({ code: "42703", message: 'column "semanas" of relation "planes_mensuales" does not exist' }).getResponse())
      .toMatchObject({ codigo: "planes_esquema_desactualizado" });
  });
  it("no confunde la caché de bloques con una migración sin aplicar", () => {
    const r = errorDeDb({ code: "PGRST204", message: "Could not find the 'bloques' column of 'sesiones' in the schema cache" });
    expect(r.getStatus()).toBe(503);
    expect(r.getResponse()).toMatchObject({ codigo: "sesiones_esquema_desactualizado", mensaje: expect.stringContaining("mismo proyecto") });
    expect(r.message).not.toContain("migración 33");
  });
  it("no atribuye errores desconocidos a una migración ni filtra datos", () => {
    const r = errorDeDb({ code: "XX000", message: "Texto privado que no debe aparecer", details: "Datos sensibles" });
    expect(r.getStatus()).toBe(500);
    expect(r.getResponse()).toEqual({ codigo: "error_interno", mensaje: "Ocurrió un error. Probá de nuevo.", detalles: undefined });
    expect(r.message).not.toContain("Texto privado");
    expect((r as ErrorApi).codigoDb).toBe("XX000");
  });
  it("avisa cuando falta una tabla y conserva los errores de permisos", () => {
    expect(errorDeDb({ code: "PGRST205", message: "tabla ausente" }).getStatus()).toBe(503);
    expect(errorDeDb({ code: "42501", message: "denied" }).getStatus()).toBe(403);
  });
});
