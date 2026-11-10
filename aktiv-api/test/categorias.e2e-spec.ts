import type { NestExpressApplication } from "@nestjs/platform-express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Entorno, Sesion, levantarApi, entornoDeTest, uuid, PASS } from "./helpers";

describe("Categorías de ejercicios (Supabase local)", () => {
  const env = new Entorno();
  let app: NestExpressApplication;
  let coach: Sesion, otro: Sesion, alumno: Sesion;
  let dbCoach: SupabaseClient, dbAlumno: SupabaseClient;
  let coachId: string;
  beforeAll(async () => {
    app = await levantarApi();
    const a = await env.usuario("categorias-a", "coach"), b = await env.usuario("categorias-b", "coach"), s = await env.usuario("categorias-alumno", "alumno");
    coachId = a.id;
    await env.alumno(a, "Alumno de categorías", s);
    coach = await new Sesion(app).entrar(a.email); otro = await new Sesion(app).entrar(b.email); alumno = await new Sesion(app).entrar(s.email);
    const conf = entornoDeTest();
    async function db(email: string) {
      const c = createClient(conf.SUPABASE_URL, conf.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const r = await c.auth.signInWithPassword({ email, password: PASS }); if (r.error) throw r.error;
      return c;
    }
    dbCoach = await db(a.email); dbAlumno = await db(s.email);
  });
  afterAll(async () => { await env.limpiar(); if (app) await app.close(); });
  it("crea una categoría propia, normaliza duplicados y conserva categorías sin ejercicios", async () => {
    expect((await coach.post("/api/catalogo/categorias", { nombre: "  Equilibrio   dinámico " })).body).toEqual({ nombre: "Equilibrio dinámico" });
    expect((await coach.post("/api/catalogo/categorias", { nombre: "EQUILIBRIO_DINAMICO" })).body).toEqual({ nombre: "Equilibrio dinámico" });
    const datos = await coach.get("/api/datos");
    expect(datos.status).toBe(200); expect(datos.body.categoriasEjercicio).toContain("Equilibrio dinámico");
    expect(datos.body.categoriasEjercicio.filter((c: string) => /Equilibrio/.test(c))).toHaveLength(1);
    expect((await alumno.get("/api/datos")).body.categoriasEjercicio).toContain("Equilibrio dinámico");
    expect((await otro.get("/api/datos")).body.categoriasEjercicio).not.toContain("Equilibrio dinámico");
    expect((await coach.post("/api/catalogo/ejercicios", { id: uuid(), nombre: "Equilibrio en un pie", categoria: "Equilibrio dinámico" })).status).toBe(201);
  });
  it("solo el profesor dueño puede crear: API y RLS rechazan al alumno", async () => {
    expect((await alumno.post("/api/catalogo/categorias", { nombre: "Prohibida" })).status).toBe(403);
    expect((await dbAlumno.rpc("crear_categoria_ejercicio", { nombre_nuevo: "Prohibida" })).error?.code).toBe("42501");
    expect((await dbAlumno.from("categorias_ejercicio").insert({ coach_id: coachId, nombre: "Prohibida" })).error?.code).toBe("42501");
    expect((await dbCoach.from("categorias_ejercicio").insert({ coach_id: uuid(), nombre: "Otro dueño" })).error?.code).toBe("42501");
    expect((await coach.post("/api/catalogo/categorias", { nombre: " " })).status).toBe(400);
    expect((await coach.post("/api/catalogo/categorias", { nombre: "x".repeat(81) })).status).toBe(400);
  });
  it("carga más de mil categorías sin truncar la respuesta", async () => {
    const r = await env.admin.from("categorias_ejercicio").insert(Array.from({ length: 1001 }, (_, i) => ({ coach_id: coachId, nombre: `Categoría ${String(i).padStart(4, "0")}` })));
    expect(r.error).toBeNull();
    const datos = await coach.get("/api/datos");
    expect(datos.status).toBe(200); expect(datos.body.categoriasEjercicio).toContain("Categoría 1000");
    expect(datos.body.categoriasEjercicio.length).toBeGreaterThan(1000);
  });
});
