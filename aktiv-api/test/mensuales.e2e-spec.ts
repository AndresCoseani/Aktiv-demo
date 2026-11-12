import type { NestExpressApplication } from "@nestjs/platform-express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Entorno, Sesion, levantarApi, uuid, entornoDeTest, PASS } from "./helpers";
import { prescripcionEfectiva, type PlanMensual } from "@aktiv/contrato";

describe("Planes mensuales (Supabase local)", () => {
  const env = new Entorno();
  let app: NestExpressApplication;
  let A: Sesion; let B: Sesion; let S: Sesion;
  let alumno: string;
  let destino: string; let ajeno: string;
  const plan = uuid(); const sesion = uuid(); const ejercicio = uuid();
  let dbAlumno: SupabaseClient;
  beforeAll(async () => {
    app = await levantarApi();
    const profe = await env.usuario("mensual-profe", "coach");
    const otro = await env.usuario("mensual-otro", "coach");
    const cuenta = await env.usuario("mensual-alumno", "alumno");
    alumno = await env.alumno(profe, "Alumno mensual", cuenta);
    destino = await env.alumno(profe, "Destino copia");
    ajeno = await env.alumno(otro, "Destino ajeno");
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
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { id: plan, nombre: "Noviembre", tipo: "Fuerza", inicio: "2026-11-02", activo: true })).status).toBe(201);
    expect((await A.post(`/api/planes-mensuales/${plan}/sesiones`, { id: sesion, dia: null, tipo: "Fuerza", nombre: "Fuerza", calentamiento: "1. Activación\n2. Movilidad", enfriamiento: "Estirar" })).status).toBe(201);
    expect((await A.post(`/api/sesiones/${sesion}/ejercicios`, { id: ejercicio, nombre: "Zumo", grupo: 1, descanso: "60 s" })).status).toBe(201);
    const r = await A.get(`/api/alumnos/${alumno}/planes-mensuales`);
    expect(r.status).toBe(200);
    expect(r.body[0].sesiones).toHaveLength(1);
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
  it("duplica un día completo en seis semanas con IDs nuevos, sin pesos y sin modificar el original", async () => {
    const activacionId = uuid();
    expect((await A.patch(`/api/sesiones/${sesion}`, { bloques: [2, 1, 3], activacion: [{ id: activacionId, nombre: "Movilidad", indicacion: "Opcional", fase: "Movilidad" }] })).status).toBe(200);
    const antes = (await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body[0];
    const original = antes.sesiones.find((s: { id: string }) => s.id === sesion);
    const copiaId = uuid();
    const r = await A.post(`/api/sesiones/${sesion}/duplicar`, { id: copiaId, nombre: "Fuerza B", dia: 1 });
    expect(r.status).toBe(201); expect(r.body.id).toBe(copiaId);
    const despues = (await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body[0];
    const copia = despues.sesiones.find((s: { id: string }) => s.id === copiaId);
    expect(despues.activo).toBe(antes.activo);
    expect(copia).toMatchObject({ nombre: "Fuerza B", dia: 1, tipo: original.tipo, calentamiento: original.calentamiento, enfriamiento: original.enfriamiento, bloques: [2, 1, 3] });
    expect(copia.orden).toBeGreaterThan(Math.max(...antes.sesiones.map((s: { orden: number }) => s.orden)));
    expect(copia.activacion[0]).toMatchObject({ nombre: "Movilidad", indicacion: "Opcional" });
    expect(copia.activacion[0].id).not.toBe(activacionId);
    expect(copia.ejercicios[0].id).not.toBe(ejercicio);
    expect(copia.ejercicios[0]).toMatchObject({ nombre: original.ejercicios[0].nombre, grupo: original.ejercicios[0].grupo, descanso: original.ejercicios[0].descanso });
    expect(copia.ejercicios[0].semanas.map((c: { prescripcion: string }) => c.prescripcion)).toEqual(original.ejercicios[0].semanas.map((c: { prescripcion: string }) => c.prescripcion));
    expect(copia.ejercicios[0].semanas).toHaveLength(6);
    expect(copia.ejercicios[0].semanas.every((c: { peso: string | null; pesoFecha: string | null }) => c.peso === null && c.pesoFecha === null)).toBe(true);
    expect((await A.patch(`/api/sesion-ejercicios/${copia.ejercicios[0].id}/semanas/1`, { prescripcion: "8×8" })).status).toBe(200);
    expect((await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body[0].sesiones.find((s: { id: string }) => s.id === sesion)).toEqual(original);
    expect((await A.post(`/api/sesiones/${sesion}/duplicar`, { id: copiaId, nombre: "Fuerza B", dia: 1 })).status).toBe(409);
    expect((await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body[0].sesiones.filter((s: { id: string }) => s.id === copiaId)).toHaveLength(1);
  });
  it("protege la copia por API y RPC frente a alumnos, otros profesores y parámetros ajenos", async () => {
    const dto = { id: uuid(), nombre: "Copia", dia: null };
    expect((await B.post(`/api/sesiones/${sesion}/duplicar`, dto)).status).toBe(404);
    expect((await S.post(`/api/sesiones/${sesion}/duplicar`, dto)).status).toBe(403);
    expect((await A.post(`/api/sesiones/${uuid()}/duplicar`, dto)).status).toBe(404);
    expect((await A.post(`/api/sesiones/${sesion}/duplicar`, { ...dto, tipo: "Running" })).status).toBe(400);
    expect((await A.post(`/api/sesiones/${sesion}/duplicar`, { ...dto, nombre: " " })).status).toBe(400);
    const rpc = await dbAlumno.rpc("duplicar_sesion", { p_origen: sesion, p_id: dto.id, p_nombre: dto.nombre, p_dia: null });
    expect(rpc.error?.code).toBe("42501");
    expect((await env.admin.from("sesiones").select("id").eq("id", dto.id)).data).toEqual([]);
  });
  it("copia también días vacíos y rechaza superar el límite sin dejar una copia parcial", async () => {
    const vacio = uuid(), copia = uuid();
    expect((await A.post(`/api/planes-mensuales/${plan}/sesiones`, { id: vacio, tipo: "Running", dia: null, nombre: "Vacío", calentamiento: "", enfriamiento: "", bloques: [4] })).status).toBe(201);
    expect((await A.post(`/api/sesiones/${vacio}/duplicar`, { id: copia, nombre: "Otro vacío", dia: null })).status).toBe(201);
    const dias = (await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body[0].sesiones;
    expect(dias.find((s: { id: string }) => s.id === copia)).toMatchObject({ dia: null, bloques: [4], ejercicios: [] });
    const extras = Array.from({ length: 28 - dias.length }, (_, i) => ({ id: uuid(), plan_id: plan, tipo: "Fuerza", dia: null, orden: 100 + i }));
    expect((await env.admin.from("sesiones").insert(extras)).error).toBeNull();
    const rechazada = uuid();
    expect((await A.post(`/api/sesiones/${sesion}/duplicar`, { id: rechazada, nombre: "No entra", dia: null })).status).toBe(422);
    expect((await env.admin.from("sesiones").select("id").eq("id", rechazada)).data).toEqual([]);
    await env.admin.from("sesiones").delete().in("id", extras.map((s) => s.id));
  });
  it("copia el plan entero al mismo alumno y a otro sin reemplazar activos ni copiar pesos", async () => {
    const original: PlanMensual = (await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body.find((p: PlanMensual) => p.id === plan);
    const activoDestino = uuid();
    expect((await A.post(`/api/alumnos/${destino}/planes-mensuales`, { id: activoDestino, nombre: "Activo destino", tipo: "Fuerza", inicio: "2026-11-02", activo: true })).status).toBe(201);
    for (const alumnoId of [alumno, destino]) {
      const id = uuid(); const dto = { id, alumnoId, nombre: "Copia completa", inicio: "2026-12-07" };
      const respuesta = await A.post(`/api/planes-mensuales/${plan}/duplicar`, dto);
      expect({ status: respuesta.status, body: respuesta.body }).toMatchObject({ status: 201, body: { id } });
      const listado: PlanMensual[] = (await A.get(`/api/alumnos/${alumnoId}/planes-mensuales`)).body;
      expect(listado.find((p) => p.activo)?.id).toBe(alumnoId === alumno ? plan : activoDestino);
      const copia = listado.find((p) => p.id === id)!;
      expect(copia).toMatchObject({ nombre: dto.nombre, inicio: dto.inicio, semanas: 6, activo: false });
      expect(copia.sesiones).toHaveLength(original.sesiones.length);
      for (let i = 0; i < original.sesiones.length; i++) {
        const anterior = original.sesiones[i]; const nueva = copia.sesiones[i];
        expect(nueva.id).not.toBe(anterior.id);
        expect({ ...nueva, id: anterior.id, ejercicios: anterior.ejercicios, activacion: anterior.activacion }).toEqual(anterior);
        expect(nueva.activacion.map((a) => ({ ...a, id: "" }))).toEqual(anterior.activacion.map((a) => ({ ...a, id: "" })));
        expect(nueva.activacion.every((a) => !anterior.activacion.some((b) => b.id === a.id))).toBe(true);
        expect(nueva.ejercicios).toHaveLength(anterior.ejercicios.length);
        for (let j = 0; j < anterior.ejercicios.length; j++) {
          const a = anterior.ejercicios[j]; const b = nueva.ejercicios[j];
          expect(b.id).not.toBe(a.id);
          expect({ ...b, id: a.id, semanas: a.semanas }).toEqual(a);
          expect(b.semanas).toEqual(a.semanas.map((s) => ({ ...s, peso: null, pesoFecha: null })));
        }
      }
      const copiado = copia.sesiones.find((s) => s.ejercicios.length)!.ejercicios[0];
      expect((await A.patch(`/api/sesion-ejercicios/${copiado.id}/semanas/1`, { prescripcion: "1x1" })).status).toBe(200);
      expect((await A.post(`/api/planes-mensuales/${plan}/duplicar`, dto)).status).toBe(409);
      expect((await A.get(`/api/alumnos/${alumnoId}/planes-mensuales`)).body.filter((p: PlanMensual) => p.id === id)).toHaveLength(1);
    }
    expect((await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body.find((p: PlanMensual) => p.id === plan)).toEqual(original);
  });
  it("protege la copia completa en API y RPC y no deja planes parciales al rechazar", async () => {
    const dto = { id: uuid(), alumnoId: alumno, nombre: "Copia", inicio: "2026-12-01" };
    expect((await B.post(`/api/planes-mensuales/${plan}/duplicar`, dto)).status).toBe(404);
    expect((await S.post(`/api/planes-mensuales/${plan}/duplicar`, dto)).status).toBe(403);
    expect((await A.post(`/api/planes-mensuales/${plan}/duplicar`, { ...dto, alumnoId: ajeno })).status).toBe(404);
    expect((await A.post(`/api/planes-mensuales/${uuid()}/duplicar`, dto)).status).toBe(404);
    expect((await A.post(`/api/planes-mensuales/${plan}/duplicar`, { ...dto, activo: true })).status).toBe(400);
    const rpc = await dbAlumno.rpc("duplicar_plan", { p_origen: plan, p_id: dto.id, p_alumno: alumno, p_nombre: "Copia", p_inicio: dto.inicio });
    expect(rpc.error?.code).toBe("42501");
    expect((await env.admin.from("planes_mensuales").select("id").eq("id", dto.id)).data).toEqual([]);
    // Un plan vacío también se copia y queda borrador aunque el destino no tenga activos.
    const vacio = uuid();
    expect((await A.post(`/api/alumnos/${destino}/planes-mensuales`, { id: vacio, nombre: "Vacío", tipo: "Fuerza", inicio: dto.inicio, activo: false })).status).toBe(201);
    expect((await A.post(`/api/planes-mensuales/${vacio}/duplicar`, { ...dto, alumnoId: destino })).status).toBe(201);
    expect((await A.get(`/api/alumnos/${destino}/planes-mensuales`)).body.find((p: PlanMensual) => p.id === dto.id)).toMatchObject({ activo: false, sesiones: [] });
    const existentes = (await A.get(`/api/alumnos/${destino}/planes-mensuales`)).body.length;
    const extras = Array.from({ length: 50 - existentes }, (_, orden) => ({ id: uuid(), alumno_id: destino, nombre: "Límite", inicio: dto.inicio, activo: false, orden: 100 + orden }));
    expect((await env.admin.from("planes_mensuales").insert(extras)).error).toBeNull();
    const rechazada = uuid();
    expect((await A.post(`/api/planes-mensuales/${plan}/duplicar`, { ...dto, id: rechazada, alumnoId: destino })).status).toBe(422);
    expect((await env.admin.from("planes_mensuales").select("id").eq("id", rechazada)).data).toEqual([]);
  });
  it("mantiene otro tipo activo en paralelo; borrar sesión borra sus ejercicios y pesos", async () => {
    const siguiente = uuid();
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`, { id: siguiente, nombre: "Diciembre running", tipo: "Running", inicio: "2026-12-01", activo: true })).status).toBe(201);
    const r = await A.get(`/api/alumnos/${alumno}/planes-mensuales`);
    expect(r.body.filter((p: { activo: boolean }) => p.activo)).toHaveLength(2);
    expect(r.body.find((p: { id: string }) => p.id === siguiente).activo).toBe(true);
    expect((await A.delete(`/api/sesiones/${sesion}`)).status).toBe(204);
    const c = await env.admin.from("ejercicio_semanas").select("*").eq("ejercicio_id", ejercicio);
    expect(c.error).toBeNull(); expect(c.data).toEqual([]);
  });
});
