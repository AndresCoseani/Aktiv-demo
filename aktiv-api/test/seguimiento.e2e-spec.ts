import type { NestExpressApplication } from "@nestjs/platform-express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Entorno, Sesion, levantarApi, entornoDeTest, uuid, PASS } from "./helpers";

describe("Seguimiento de entrenamientos (Supabase local)", () => {
  const env = new Entorno();
  let app: NestExpressApplication;
  let A: Sesion; let B: Sesion; let S: Sesion; let Otro: Sesion;
  let alumno: string; let dbAlumno: SupabaseClient; let dbCoach: SupabaseClient;
  const plan = uuid(), sesion = uuid(), segunda = uuid();
  const ruta = (semana = 1) => `/api/sesiones/${sesion}/seguimiento/${semana}`;
  const completado = { completado: true, sensacion: "Bien", nota: "Buena sesión" };
  beforeAll(async () => {
    app = await levantarApi();
    const profe = await env.usuario("seguimiento-profe", "coach");
    const ajeno = await env.usuario("seguimiento-ajeno", "coach");
    const cuenta = await env.usuario("seguimiento-alumno", "alumno");
    const otra = await env.usuario("seguimiento-otra", "alumno");
    alumno = await env.alumno(profe, "Alumno seguimiento", cuenta);
    await env.alumno(profe, "Otro alumno", otra);
    A = await new Sesion(app).entrar(profe.email); B = await new Sesion(app).entrar(ajeno.email);
    S = await new Sesion(app).entrar(cuenta.email); Otro = await new Sesion(app).entrar(otra.email);
    const e = entornoDeTest();
    dbAlumno = createClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    dbCoach = createClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    expect((await dbAlumno.auth.signInWithPassword({ email: cuenta.email, password: PASS })).error).toBeNull();
    expect((await dbCoach.auth.signInWithPassword({ email: profe.email, password: PASS })).error).toBeNull();
    const inicio = new Date(); inicio.setUTCDate(inicio.getUTCDate() - 21);
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { id: plan, nombre: "Seguimiento", tipo: "Fuerza", inicio: inicio.toISOString().slice(0, 10), semanas: 6, activo: true })).status).toBe(201);
    for (const id of [sesion, segunda]) expect((await A.post(`/api/planes-mensuales/${plan}/sesiones`, { id, dia: 1, tipo: "Fuerza", nombre: "Entrenamiento", calentamiento: "", enfriamiento: "" })).status).toBe(201);
  });
  afterAll(async () => { await env.limpiar(); if (app) await app.close(); });

  it("guarda por sesión/semana, conserva la fecha al editar y permite consultar al profe", async () => {
    const vacio = await S.get(ruta());
    expect(vacio.status).toBe(200);
    expect(vacio.body).toEqual({ registro: { semana: 1, completado: false, sensacion: null, nota: "", fecha: null }, habilitado: true });
    const alta = await S.patch(ruta(), completado);
    expect(alta.status).toBe(200); expect(alta.body.registro).toMatchObject({ semana: 1, ...completado });
    expect(alta.body.registro.fecha).toBeTruthy();
    expect((await S.patch(ruta(), { ...completado, nota: "Actualizada" })).body.registro.fecha).toBe(alta.body.registro.fecha);
    const lectura = await A.get(ruta());
    expect(lectura.body.habilitado).toBe(false); expect(lectura.body.registro.nota).toBe("Actualizada");
    expect((await S.get(ruta(2))).body.registro.completado).toBe(false);
    expect((await S.get(`/api/sesiones/${segunda}/seguimiento/1`)).body.registro.completado).toBe(false);
  });
  it("aísla alumnos y profesores tanto en API como en RLS", async () => {
    expect((await B.get(ruta())).status).toBe(404);
    expect((await Otro.get(ruta())).status).toBe(404);
    expect((await Otro.patch(ruta(), completado)).status).toBe(404);
    expect((await A.patch(ruta(), completado)).status).toBe(403);
    expect((await dbCoach.from("seguimientos_sesion").update({ nota: "No debe" }).eq("sesion_id", sesion).select()).data).toEqual([]);
    expect((await dbCoach.from("seguimientos_sesion").insert({ sesion_id: segunda, semana: 1, ...completado })).error?.code).toBe("42501");
    expect((await dbAlumno.from("seguimientos_sesion").update({ sesion_id: segunda }).eq("sesion_id", sesion)).error?.code).toBe("42501");
    expect((await S.patch(ruta(), { ...completado, fecha: "2000-01-01" })).status).toBe(400);
    const directa = await dbAlumno.from("seguimientos_sesion").update({ fecha: "2000-01-01T00:00:00Z" }).eq("sesion_id", sesion).select("fecha").single();
    expect(directa.error).toBeNull(); expect(directa.data!.fecha.startsWith("2000")).toBe(false);
  });
  it("rechaza semanas futuras, fuera de rango y planes inactivos", async () => {
    expect((await S.get(ruta(6))).body.habilitado).toBe(false);
    expect((await S.patch(ruta(6), completado)).status).toBe(422);
    expect((await S.patch(ruta(7), completado)).status).toBe(422);
    expect((await S.get(ruta(7))).status).toBe(404);
    expect((await S.patch(ruta(0), completado)).status).toBe(400);
    expect((await A.patch(`/api/planes-mensuales/${plan}`, { activo: false })).status).toBe(200);
    expect((await S.patch(ruta(), completado)).status).toBe(403);
    expect((await A.post(`/api/planes-mensuales/${plan}/activar`, {})).status).toBe(201);
  });
  it("no copia el seguimiento al duplicar y protege semanas completadas al acortar", async () => {
    expect((await S.patch(ruta(3), completado)).status).toBe(200);
    expect((await A.patch(`/api/planes-mensuales/${plan}`, { semanas: 2 })).status).toBe(422);
    const copia = uuid();
    expect((await A.post(`/api/planes-mensuales/${plan}/duplicar`, { id: copia, alumnoId: alumno, nombre: "Copia sin seguimiento", inicio: "2026-11-02" })).status).toBe(201);
    const dias = await env.admin.from("sesiones").select("id").eq("plan_id", copia);
    expect((await env.admin.from("seguimientos_sesion").select("*").in("sesion_id", dias.data!.map((d) => d.id))).data).toEqual([]);
    const desmarcado = await S.patch(ruta(3), { completado: false, sensacion: null, nota: "" });
    expect(desmarcado.status).toBe(200); expect(desmarcado.body.registro.fecha).toBeNull();
    expect((await A.patch(`/api/planes-mensuales/${plan}`, { semanas: 2 })).status).toBe(200);
    expect((await env.admin.from("seguimientos_sesion").select("*").eq("sesion_id", sesion).eq("semana", 3)).data).toEqual([]);
    expect((await A.delete(`/api/planes-mensuales/${plan}`)).status).toBe(204);
    expect((await env.admin.from("seguimientos_sesion").select("*").eq("sesion_id", sesion)).data).toEqual([]);
  });
});
