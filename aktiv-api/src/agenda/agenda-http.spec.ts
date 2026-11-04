import request from "supertest";
import { crearApp } from "../app.factory";
import { cargarEnv } from "../config/env";
import { AuthService } from "../auth/auth.service";
import { SupabaseService } from "../supabase/supabase.service";
import { diaSemanal, desplazarFecha, fechaArgentina } from "@aktiv/contrato";
import type { Usuario } from "../common/tipos";

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
describe("agenda: HTTP, roles y datos públicos", () => {
  it("separa calendarios, no entrega listas de alumnos al alumno y deriva su identidad del token", async () => {
    const app = await crearApp(cargarEnv({ NODE_ENV: "test", SUPABASE_URL: "https://prueba.example.test", SUPABASE_ANON_KEY: "sb_publishable_solo_pruebas_0000000000" }));
    const hoy = fechaArgentina();
    const usuarios: Record<string, Usuario> = {
      coach: { id: id(1), rol: "coach", email: "coach@example.test", nombre: "Lucas", token: "coach" },
      alumno: { id: id(2), rol: "alumno", email: "ana@example.test", nombre: "Ana", token: "alumno" },
      otro: { id: id(3), rol: "coach", email: "otro@example.test", nombre: "Otro", token: "otro" },
    };
    const filas: Record<string, Record<string, unknown>[]> = {
      alumnos: [{ id: id(10), user_id: id(2), coach_id: id(1) }],
      horarios_clase: [1, 3].map((coach) => ({ id: id(20 + coach), coach_id: id(coach), titulo: "Clase", dia: diaSemanal(hoy), hora: "18:00", fin: "", lugar: "", activo: true })),
      clases_canceladas: [],
      cambios_horario_clase: [],
      confirmaciones_clase: [10, 11].map((alumno) => ({ horario_id: id(21), fecha: hoy, alumno_id: id(alumno), hora_llegada: alumno === 10 ? "18:45" : "18:15", alumnos: { nombre: alumno === 10 ? "Ana" : "Sol" } })),
    };
    const escrituras: unknown[] = [];
    jest.spyOn(app.get(AuthService), "usuarioDesdeToken").mockImplementation(async (token) => usuarios[token]);
    jest.spyOn(app.get(SupabaseService), "delUsuario").mockImplementation(() => ({
      rpc: jest.fn(async (nombre: string, dto: unknown) => { escrituras.push({ nombre, dto }); return { error: null }; }),
      from: (tabla: string) => {
        const filtros: ((fila: Record<string, unknown>) => boolean)[] = [];
        const leer = () => (filas[tabla] ?? []).filter((fila) => filtros.every((f) => f(fila)));
        const q: Record<string, jest.Mock> = {
          select: jest.fn(() => q), order: jest.fn(() => q),
          eq: jest.fn((col: string, v: unknown) => { filtros.push((f) => f[col] === v); return q; }),
          in: jest.fn((col: string, valores: unknown[]) => { filtros.push((f) => valores.includes(f[col])); return q; }),
          gte: jest.fn((col: string, v: string) => { filtros.push((f) => String(f[col]) >= v); return q; }),
          lte: jest.fn((col: string, v: string) => { filtros.push((f) => String(f[col]) <= v); return q; }),
          range: jest.fn(async (desde: number, hasta: number) => ({ data: leer().slice(desde, hasta + 1), error: null })),
          maybeSingle: jest.fn(async () => ({ data: leer()[0] ?? null, error: null })),
          upsert: jest.fn(async (dto: unknown) => { escrituras.push(dto); return { error: null }; }),
        };
        return q;
      },
    }) as unknown as ReturnType<SupabaseService["delUsuario"]>);
    try {
      await app.init();
      const http = app.getHttpServer();
      const consultar = (token: string) => request(http).get(`/api/agenda?desde=${hoy}&hasta=${hoy}`).set("Authorization", `Bearer ${token}`);
      const coach = await consultar("coach");
      expect(coach.status).toBe(200);
      expect(coach.body.horarios.map((h: { id: string }) => h.id)).toEqual([id(21)]);
      expect(coach.body.clases[0].confirmados.map((a: { nombre: string }) => a.nombre)).toEqual(["Sol", "Ana"]);
      expect((await mutarSinHora()).status).toBe(400);
      function mutarSinHora() { return request(http).post("/api/agenda/confirmaciones").set("Authorization", "Bearer alumno").set("x-requested-with", "aktiv").send({horarioId:id(21),fecha:hoy}); }
      const alumno = await consultar("alumno");
      expect(alumno.status).toBe(200);
      expect(alumno.body.clases[0]).toMatchObject({ asistire: true, horaLlegada: "18:45", confirmados: [] });
      expect(JSON.stringify(alumno.body)).not.toContain("Sol");
      expect((await consultar("otro")).body.horarios.map((h: { id: string }) => h.id)).toEqual([id(23)]);
      const mutar = (token: string, ruta: string, body: Record<string, unknown>) => request(http).post(`/api/agenda/${ruta}`).set("Authorization", `Bearer ${token}`).set("x-requested-with", "aktiv").send(body);
      expect((await mutar("alumno", "horarios", { id: id(30), titulo: "Intruso", dia: 1, hora: "18:00" })).status).toBe(403);
      expect((await mutar("coach", "confirmaciones", { horarioId: id(21), fecha: hoy })).status).toBe(403);
      expect((await mutar("alumno", "confirmaciones", { horarioId: id(21), fecha: hoy, alumnoId: id(11) })).status).toBe(400);
      expect(escrituras).toHaveLength(0);
      expect((await mutar("alumno", "confirmaciones", { horarioId: id(21), fecha: hoy, horaLlegada: "18:30" })).status).toBe(204);
      expect(escrituras).toEqual([{ nombre: "confirmar_llegada_clase", dto: { p_horario_id: id(21), p_fecha: hoy, p_alumno_id: id(10), p_hora_llegada: "18:30" } }]);
      const futuro=desplazarFecha(hoy,7), pasado=desplazarFecha(hoy,-7);
      filas.cambios_horario_clase.push(
        {horario_id:id(21),fecha:hoy,alcance:'habitual',titulo:'Running',hora:'19:00',fin:'20:00',lugar:'Palmar'},
        {horario_id:id(21),fecha:futuro,alcance:'solo_fecha',titulo:'Running',hora:'09:00',fin:'10:00',lugar:'Pista'},
      );
      const semana=await request(http).get(`/api/agenda?desde=${pasado}&hasta=${futuro}`).set('Authorization','Bearer coach');
      expect(semana.status).toBe(200);
      expect(semana.body.clases.map((c:{hora:string})=>c.hora)).toEqual(['18:00','19:00','09:00']);
      expect(semana.body.clases.map((c:{personalizada:boolean})=>c.personalizada)).toEqual([false,false,true]);
      const cambio={fecha:hoy,alcance:'habitual',titulo:'Running',hora:'06:00',fin:'12:00',lugar:'Palmar'};
      expect((await mutar('alumno',`horarios/${id(21)}/cambios`,cambio)).status).toBe(403);
      expect((await mutar('coach',`horarios/${id(21)}/cambios`,{...cambio,fin:'05:00'})).status).toBe(400);
      expect((await mutar('coach',`horarios/${id(21)}/cambios`,cambio)).status).toBe(201);
      expect(escrituras.at(-1)).toEqual({nombre:'guardar_cambio_horario',dto:{p_horario_id:id(21),p_fecha:hoy,p_alcance:'habitual',p_titulo:'Running',p_hora:'06:00',p_fin:'12:00',p_lugar:'Palmar'}});
    } finally { await app.close(); jest.restoreAllMocks(); }
  });
});
