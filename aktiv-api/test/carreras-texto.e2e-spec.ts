import type { NestExpressApplication } from "@nestjs/platform-express";
import { Entorno, Sesion, levantarApi, uuid } from "./helpers";

describe("Carreras: objetivos libres y edición de distancias", () => {
  const env = new Entorno(); let app: NestExpressApplication;
  let A: Sesion, B: Sesion, S: Sesion, alumno: string;
  const carrera = uuid(), inscripcion = uuid();
  beforeAll(async () => {
    app = await levantarApi();
    const a = await env.usuario("carreras-texto", "coach"), b = await env.usuario("carreras-ajeno", "coach"), s = await env.usuario("carreras-alumno", "alumno");
    alumno = await env.alumno(a, "Alumno carreras", s);
    A = await new Sesion(app).entrar(a.email); B = await new Sesion(app).entrar(b.email); S = await new Sesion(app).entrar(s.email);
    expect((await A.post("/api/carreras", { id: carrera, nombre: "Carrera de prueba", fecha: "2030-12-01", lugar: "Palmar", distanciasKm: [5, 10], notas: "" })).status).toBe(201);
  });
  afterAll(async () => { await env.limpiar(); if (app) await app.close(); });
  it("guarda y edita letras, números y objetivos mixtos; conserva resultados", async () => {
    expect((await A.post(`/api/alumnos/${alumno}/inscripciones`, { id: inscripcion, carreraId: carrera, distanciaKm: 5, objetivoSeg: null, objetivo: "Terminar cómodo, correr 5K sin dolor" })).status).toBe(201);
    for (const objetivo of ["Terminar cómodo", "12345", "Bajar de 50 min en 10K", ""]) {
      expect((await S.patch(`/api/inscripciones/${inscripcion}`, { objetivo })).status).toBe(200);
      expect((await A.get("/api/datos")).body.inscripciones.find((i: { id: string }) => i.id === inscripcion).objetivo).toBe(objetivo);
    }
    expect((await S.patch(`/api/inscripciones/${inscripcion}`, { objetivo: "A ritmo tranquilo", resultadoSeg: 1800 })).status).toBe(200);
    expect((await A.get("/api/datos")).body.inscripciones.find((i: { id: string }) => i.id === inscripcion)).toMatchObject({ objetivo: "A ritmo tranquilo", resultadoSeg: 1800 });
    expect((await B.patch(`/api/inscripciones/${inscripcion}`, { objetivo: "Ajeno" })).status).toBe(404);
    expect((await S.patch(`/api/inscripciones/${inscripcion}`, { objetivo: "x".repeat(501) })).status).toBe(400);
  });
  it("edita las distancias de la carrera y del alumno sin invalidar inscripciones", async () => {
    expect((await A.patch(`/api/carreras/${carrera}`, { distanciasKm: [5, 10, 7.5] })).status).toBe(200);
    expect((await A.patch(`/api/carreras/${carrera}`, { distanciasKm: [10, 7.5] })).status).toBe(422);
    expect((await A.patch(`/api/inscripciones/${inscripcion}`, { distanciaKm: 7.5 })).status).toBe(200);
    expect((await A.patch(`/api/carreras/${carrera}`, { distanciasKm: [10, 7.5] })).status).toBe(200);
    expect((await S.patch(`/api/inscripciones/${inscripcion}`, { distanciaKm: 10 })).status).toBe(200);
    expect((await S.patch(`/api/inscripciones/${inscripcion}`, { distanciaKm: 42 })).status).toBe(422);
    expect((await A.get("/api/datos")).body.inscripciones.find((i: { id: string }) => i.id === inscripcion)).toMatchObject({ distanciaKm: 10, objetivo: "A ritmo tranquilo", resultadoSeg: 1800 });
  });
});
