import type { NestExpressApplication } from "@nestjs/platform-express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Entorno, Sesion, levantarApi, uuid, entornoDeTest, PASS } from "./helpers";
import { prescripcionEfectiva } from "@aktiv/contrato";

describe("Planes mensuales (Supabase local)", () => {
  const env = new Entorno();
  let app: NestExpressApplication;
  let A: Sesion; let B: Sesion; let S: Sesion;
  let alumno: string;
  const plan = uuid(); const sesion = uuid(); const ejercicio = uuid();
  let dbAlumno: SupabaseClient;
  beforeAll(async () => {
    app = await levantarApi();
    const profe = await env.usuario("mensual-profe", "coach");
    const otro = await env.usuario("mensual-otro", "coach");
    const cuenta = await env.usuario("mensual-alumno", "alumno");
    alumno = await env.alumno(profe, "Alumno mensual", cuenta);
    A = await new Sesion(app).entrar(profe.email);
    B = await new Sesion(app).entrar(otro.email);
    S = await new Sesion(app).entrar(cuenta.email);
    const e = entornoDeTest();
    dbAlumno = createClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const r = await dbAlumno.auth.signInWithPassword({ email: cuenta.email, password: PASS });
    if (r.error) throw r.error;
  });
  afterAll(async () => { await env.limpiar(); if (app) await app.close(); });

  it("crea un plan, sesiones con calendario opcional y cuatro celdas por ejercicio", async () => {
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { id: plan, nombre: "Noviembre", inicio: "2026-11-02", activo: true })).status).toBe(201);
    for (const [id, tipo] of [[sesion, "Fuerza"], [uuid(), "Running"]]) {
      expect((await A.post(`/api/planes-mensuales/${plan}/sesiones`, { id, dia: tipo === "Fuerza" ? null : 1, tipo, nombre: tipo, calentamiento: "1. Activación\n2. Movilidad", enfriamiento: "Estirar" })).status).toBe(201);
    }
    expect((await A.post(`/api/sesiones/${sesion}/ejercicios`, { id: ejercicio, nombre: "Zumo", grupo: 1, descanso: "60 s" })).status).toBe(201);
    const r = await A.get(`/api/alumnos/${alumno}/planes-mensuales`);
    expect(r.status).toBe(200);
    expect(r.body[0].sesiones).toHaveLength(2);
    expect(r.body[0].sesiones.find((s: { id: string }) => s.id === sesion).dia).toBeNull();
    expect(r.body[0].sesiones.find((s: { id: string }) => s.id === sesion).ejercicios[0].semanas).toHaveLength(4);
  });
  it("persiste progresión y pesos independientes y resuelve herencia", async () => {
    expect((await A.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/1`, { prescripcion: "4×8" })).status).toBe(200);
    expect((await A.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/3`, { prescripcion: "5×8" })).status).toBe(200);
    expect((await S.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/2`, { peso: "12,5", pesoFecha: "2026-01-01" })).status).toBe(200);
    const r = await S.get(`/api/alumnos/${alumno}/planes-mensuales`);
    const semanas = r.body[0].sesiones.find((s: { id: string }) => s.id === sesion).ejercicios[0].semanas;
    expect([1, 2, 3, 4].map((s) => prescripcionEfectiva(semanas, s))).toEqual(["4×8", "4×8", "5×8", "5×8"]);
    expect(semanas.find((s: { semana: number }) => s.semana === 1).peso).toBeNull();
    expect(semanas.find((s: { semana: number }) => s.semana === 2).peso).toBe("12,5");
    expect((await S.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/2`, { peso: null, pesoFecha: null })).status).toBe(200);
  });
  it("rechaza campos ajenos, semanas inválidas y modificaciones del alumno", async () => {
    expect((await S.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/1`, { prescripcion: "9×9" })).status).toBe(403);
    expect((await S.patch(`/api/sesiones/${sesion}`, { nombre: "Cambio" })).status).toBe(403);
    expect((await S.delete(`/api/sesion-ejercicios/${ejercicio}`)).status).toBe(403);
    expect((await A.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/105`, { peso: "10" })).status).toBe(400);
    expect((await A.patch(`/api/planes-mensuales/${plan}`, { alumno_id: uuid() })).status).toBe(400);
    expect((await A.patch(`/api/planes-mensuales/${plan}`, {})).status).toBe(400);
  });
  it("aísla los recursos de otro profesor sin revelar su existencia", async () => {
    expect((await B.get(`/api/alumnos/${alumno}/planes-mensuales`)).status).toBe(404);
    expect((await B.patch(`/api/planes-mensuales/${plan}`, { nombre: "Ajeno" })).status).toBe(404);
    expect((await B.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/1`, { peso: "10" })).status).toBe(404);
  });
  it("RLS y trigger protegen la prescripción incluso sin pasar por la API", async () => {
    const r = await dbAlumno.from("ejercicio_semanas").update({ prescripcion: "99×99" }).eq("ejercicio_id", ejercicio).eq("semana", 1);
    expect(r.error?.code).toBe("42501");
    const crear = await dbAlumno.from("sesiones").insert({ plan_id: plan, dia: 2, tipo: "Fuerza" });
    expect(crear.error?.code).toBe("42501");
    const rango = await env.admin.from("ejercicio_semanas").update({ semana: 5 }).eq("ejercicio_id", ejercicio).eq("semana", 1);
    expect(rango.error?.code).toBe("23514");
  });
  it("extiende a seis semanas y protege los datos al intentar acortar", async () => {
    expect((await A.patch(`/api/planes-mensuales/${plan}`, { semanas: 6 })).status).toBe(200);
    const r = await A.get(`/api/alumnos/${alumno}/planes-mensuales`);
    expect(r.body[0].semanas).toBe(6);
    expect(r.body[0].sesiones.find((s: { id: string }) => s.id === sesion).ejercicios[0].semanas).toHaveLength(6);
    expect((await S.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/6`, { peso: "15" })).status).toBe(200);
    expect((await A.patch(`/api/planes-mensuales/${plan}`, { semanas: 4 })).status).toBe(422);
    expect((await A.patch(`/api/planes-mensuales/${plan}`, { nombre: "Seis semanas" })).status).toBe(200);
    expect((await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body[0].semanas).toBe(6);
  });
  it("activar otro mes desactiva el anterior; borrar sesión borra sus ejercicios y pesos", async () => {
    const siguiente = uuid();
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { id: siguiente, nombre: "Diciembre", inicio: "2026-12-01", activo: true })).status).toBe(201);
    const r = await A.get(`/api/alumnos/${alumno}/planes-mensuales`);
    expect(r.body.filter((p: { activo: boolean }) => p.activo)).toHaveLength(1);
    expect(r.body.find((p: { id: string }) => p.id === siguiente).activo).toBe(true);
    expect((await A.delete(`/api/sesiones/${sesion}`)).status).toBe(204);
    const c = await env.admin.from("ejercicio_semanas").select("*").eq("ejercicio_id", ejercicio);
    expect(c.error).toBeNull(); expect(c.data).toEqual([]);
  });
});
