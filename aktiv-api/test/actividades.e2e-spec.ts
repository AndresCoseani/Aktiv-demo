import type { NestExpressApplication } from "@nestjs/platform-express";
import { Entorno, Sesion, levantarApi, uuid } from "./helpers";

describe("Actividades libres y planes simultáneos", () => {
  const env = new Entorno(); let app: NestExpressApplication, A: Sesion, B: Sesion, S: Sesion, alumno: string, otro: string;
  const primero = uuid(), segundo = uuid();
  beforeAll(async () => {
    app = await levantarApi();
    const a = await env.usuario("actividad-profe", "coach"), b = await env.usuario("actividad-otro", "coach"), s = await env.usuario("actividad-alumno", "alumno");
    alumno = await env.alumno(a, "Alumno actividades", s); otro = await env.alumno(b, "Ajeno actividades");
    A = await new Sesion(app).entrar(a.email); B = await new Sesion(app).entrar(b.email); S = await new Sesion(app).entrar(s.email);
  });
  afterAll(async () => { await env.limpiar(); if (app) await app.close(); });
  it("crea actividades normalizadas y propias, sin acceso del alumno", async () => {
    expect((await A.post("/api/actividades-plan", { nombre: "  Movilidad   suave  " })).body).toEqual({ nombre: "Movilidad suave" });
    expect((await A.post("/api/actividades-plan", { nombre: "movilidad suave" })).body).toEqual({ nombre: "Movilidad suave" });
    expect((await A.get("/api/actividades-plan")).body).toEqual(expect.arrayContaining(["Fuerza", "Running", "Movilidad suave"]));
    expect((await B.get("/api/actividades-plan")).body).not.toContain("Movilidad suave");
    expect((await S.get("/api/actividades-plan")).status).toBe(403);
    expect((await S.post("/api/actividades-plan", { nombre: "No" })).status).toBe(403);
    expect((await A.post("/api/actividades-plan", { nombre: " " })).status).toBe(400);
  });
  it("crea planes libres y mixtos, mantiene varios activos y persiste su contenido", async () => {
    const base = { inicio: "2026-11-01", semanas: 6, activo: true };
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { ...base, id: primero, nombre: "Mixto", diasIniciales: [{ tipo: "Fuerza", dias: 1 }, { tipo: "Movilidad suave", dias: 1 }] })).status).toBe(201);
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { ...base, id: segundo, nombre: "Running", diasIniciales: [{ tipo: "Running", dias: 2 }] })).status).toBe(201);
    const planes = (await S.get(`/api/alumnos/${alumno}/planes-mensuales`)).body;
    expect(planes.filter((p: { activo: boolean }) => p.activo)).toHaveLength(2);
    expect(planes.find((p: { id: string }) => p.id === primero).sesiones.map((s: { tipo: string }) => s.tipo)).toEqual(["Fuerza", "Movilidad suave"]);
    expect((await A.patch(`/api/planes-mensuales/${primero}`, { activo: false })).status).toBe(200);
    const despues = (await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body;
    expect(despues.find((p: { id: string }) => p.id === primero)).toMatchObject({ activo: false, sesiones: expect.any(Array) });
    expect(despues.find((p: { id: string }) => p.id === segundo).activo).toBe(true);
    expect((await A.patch(`/api/planes-mensuales/${primero}`, { activo: true })).status).toBe(200);
    expect((await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body.filter((p: { activo: boolean }) => p.activo)).toHaveLength(2);
  });
  it("valida cantidades, actividades repetidas y propietario antes de crear", async () => {
    const base = { id: uuid(), inicio: "2026-11-01", semanas: 4, activo: false, nombre: "Inválido" };
    for (const diasIniciales of [[], [{ tipo: "Movilidad", dias: 0 }], [{ tipo: "Fuerza", dias: 1 }, { tipo: "fuerza", dias: 1 }]]) {
      expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { ...base, diasIniciales })).status).toBe(400);
    }
    expect((await A.post(`/api/alumnos/${otro}/planes-mensuales`, { ...base, diasIniciales: [{ tipo: "Movilidad", dias: 1 }] })).status).toBe(404);
    expect((await env.admin.from("planes_mensuales").select("id").eq("id", base.id)).data).toEqual([]);
  });
  it("modelos de actividades propias se asignan sin alterar los activos", async () => {
    const modelo = uuid(), copia = uuid();
    const r = await A.post("/api/planes-modelo", { id: modelo, nombre: "Solo movilidad", semanas: 4, diasIniciales: [{ tipo: "Movilidad suave", dias: 2 }] });
    expect(r.status).toBe(201); expect(r.body.sesiones).toHaveLength(2);
    expect((await A.post(`/api/planes-modelo/${modelo}/asignar`, { id: copia, alumnoId: alumno, nombre: "Movilidad", inicio: "2026-11-01" })).status).toBe(201);
    const planes = (await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body;
    expect(planes.filter((p: { activo: boolean }) => p.activo)).toHaveLength(2);
    expect(planes.find((p: { id: string }) => p.id === copia)).toMatchObject({ activo: false, sesiones: [expect.objectContaining({ tipo: "Movilidad suave" }), expect.objectContaining({ tipo: "Movilidad suave" })] });
  });
});
