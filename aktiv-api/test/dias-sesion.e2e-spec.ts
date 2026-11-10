import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PlanMensual } from "@aktiv/contrato";
import { Entorno, Sesion, levantarApi, uuid } from "./helpers";

describe("Una sesión en varios días", () => {
  const env = new Entorno();
  let app: NestExpressApplication, A: Sesion, B: Sesion, S: Sesion, alumno: string, sesion: string;
  const plan = uuid(), modelo = uuid();
  const leer = async () => ((await S.get(`/api/alumnos/${alumno}/planes-mensuales`)).body as PlanMensual[]).find(p => p.id === plan)!;
  beforeAll(async () => {
    app = await levantarApi();
    const a = await env.usuario("dias-profe", "coach"), b = await env.usuario("dias-ajeno", "coach"), s = await env.usuario("dias-alumno", "alumno");
    alumno = await env.alumno(a, "Alumno de prueba", s);
    A = await new Sesion(app).entrar(a.email); B = await new Sesion(app).entrar(b.email); S = await new Sesion(app).entrar(s.email);
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { id: plan, nombre: "Varios días", inicio: "2026-11-01", semanas: 4, activo: true, diasIniciales: { fuerza: 1, running: 0 } })).status).toBe(201);
    sesion = (await leer()).sesiones[0].id;
  });
  afterAll(async () => { await env.limpiar(); if (app) await app.close(); });
  it("guarda y limpia la asignación sin duplicar la sesión", async () => {
    expect((await A.patch(`/api/sesiones/${sesion}`, { dias: [5, 1, 3], dia: 1 })).status).toBe(200);
    expect((await leer()).sesiones).toHaveLength(1);
    expect((await leer()).sesiones[0]).toMatchObject({ dia: 1, dias: [1, 3, 5] });
    expect((await A.patch(`/api/sesiones/${sesion}`, { dias: [], dia: null })).status).toBe(200);
    expect((await leer()).sesiones[0]).toMatchObject({ dia: null, dias: [] });
    await A.patch(`/api/sesiones/${sesion}`, { dias: [1, 3, 5], dia: 1 });
  });
  it("rechaza días inválidos y protege al alumno y a otros profesores", async () => {
    for (const dias of [[0], [8], [1, 1]]) expect((await A.patch(`/api/sesiones/${sesion}`, { dias })).status).toBe(400);
    expect((await S.patch(`/api/sesiones/${sesion}`, { dias: [] })).status).toBe(403);
    expect((await B.patch(`/api/sesiones/${sesion}`, { dias: [] })).status).toBe(404);
    expect((await leer()).sesiones[0].dias).toEqual([1, 3, 5]);
  });
  it("conserva los días al duplicar planes y asignar modelos", async () => {
    const copia = uuid(), asignado = uuid();
    expect((await A.post(`/api/planes-mensuales/${plan}/duplicar`, { id: copia, alumnoId: alumno, nombre: "Copia", inicio: "2026-12-01" })).status).toBe(201);
    expect((await A.post(`/api/planes-modelo/desde-plan/${plan}`, { id: modelo, nombre: "Modelo" })).status).toBe(201);
    expect((await A.get(`/api/planes-modelo/${modelo}`)).body.sesiones[0].dias).toEqual([1, 3, 5]);
    expect((await A.post(`/api/planes-modelo/${modelo}/asignar`, { id: asignado, alumnoId: alumno, nombre: "Asignado", inicio: "2026-12-01" })).status).toBe(201);
    const lista = (await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body as PlanMensual[];
    for (const id of [copia, asignado]) expect(lista.find(p => p.id === id)!.sesiones[0].dias).toEqual([1, 3, 5]);
  });
  it("edita la selección de un modelo sin alterar sus copias asignadas",async()=>{
    const ruta=`/api/planes-modelo/${modelo}`;
    const id=(await A.get(ruta)).body.sesiones[0].id;
    expect((await A.post(ruta+"/contenido",{metodo:"PATCH",ruta:`/sesiones/${id}`,datos:{dias:[4,2]}})).status).toBe(201);
    expect((await A.get(ruta)).body.sesiones[0]).toMatchObject({dias:[2,4],dia:2});
    expect((await A.post(ruta+"/contenido",{metodo:"PATCH",ruta:`/sesiones/${id}`,datos:{dias:[]}})).status).toBe(201);
    expect((await A.get(ruta)).body.sesiones[0]).toMatchObject({dias:[],dia:null});
    expect((await leer()).sesiones[0].dias).toEqual([1,3,5]);
  });
  it("valida también escrituras directas y conserva clientes de un solo día", async () => {
    for(const dias of [[0],[8],[1,1],[null]]) { const r=await env.admin.from("sesiones").update({dias}).eq("id",sesion);expect(r.error?.code).toBe("23514"); }
    expect((await env.admin.from("sesiones").update({dia:2}).eq("id",sesion)).error).toBeNull();expect((await leer()).sesiones[0].dias).toEqual([2]);
    await A.patch(`/api/sesiones/${sesion}`,{dias:[1,3,5],dia:1});
  });
  it("duplica una rutina con una selección independiente", async () => {
    const id = uuid();
    expect((await A.post(`/api/sesiones/${sesion}/duplicar`, { id, nombre: "Copia independiente", dia: 2, dias: [2, 4] })).status).toBe(201);
    expect((await leer()).sesiones.find(s => s.id === id)!.dias).toEqual([2, 4]);
    expect((await leer()).sesiones.find(s => s.id === sesion)!.dias).toEqual([1, 3, 5]);
  });
});
