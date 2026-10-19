import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import {
  ALUMNO_VALIDO,
  Entorno,
  H,
  PASS,
  Sesion,
  levantarApi,
  uuid,
  type UsuarioTest,
} from "./helpers";

const manana = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

describe("API de Aktiv (contra Supabase local)", () => {
  let app: NestExpressApplication;
  const env = new Entorno();
  let profeA: UsuarioTest;
  let profeB: UsuarioTest;
  let cuentaA1: UsuarioTest;
  let cuentaA2: UsuarioTest;
  let alumnoA1: string;
  let alumnoA2: string;
  let alumnoB1: string;
  let A: Sesion; // profe A
  let B: Sesion; // profe B
  let S1: Sesion; // alumno A1
  let S2: Sesion; // alumno A2

  beforeAll(async () => {
    app = await levantarApi();
    profeA = await env.usuario("profeA", "coach");
    profeB = await env.usuario("profeB", "coach");
    cuentaA1 = await env.usuario("alumnoA1", "alumno");
    cuentaA2 = await env.usuario("alumnoA2", "alumno");
    const cuentaB1 = await env.usuario("alumnoB1", "alumno");
    alumnoA1 = await env.alumno(profeA, "Alumno A1", cuentaA1);
    alumnoA2 = await env.alumno(profeA, "Alumno A2", cuentaA2);
    alumnoB1 = await env.alumno(profeB, "Alumno B1", cuentaB1);
    A = await new Sesion(app).entrar(profeA.email);
    B = await new Sesion(app).entrar(profeB.email);
    S1 = await new Sesion(app).entrar(cuentaA1.email);
    S2 = await new Sesion(app).entrar(cuentaA2.email);
  });

  afterAll(async () => {
    await env.limpiar();
    await app.close();
  });

  /* ────────────────────────────────────────────────────────── */
  describe("salud y cabeceras", () => {
    it("GET /health y /health/supabase responden sin sesión", async () => {
      expect((await request(app.getHttpServer()).get("/api/health")).body).toEqual({ estado: "ok" });
      expect((await request(app.getHttpServer()).get("/api/health/supabase")).status).toBe(200);
    });

    it("una ruta inexistente da 404 con el formato de error y un id de pedido", async () => {
      const r = await A.get("/api/no-existe");
      expect(r.status).toBe(404);
      expect(r.body).toMatchObject({ statusCode: 404, codigo: "http_404" });
      expect(typeof r.body.requestId).toBe("string");
      expect(r.headers["x-request-id"]).toBe(r.body.requestId);
    });

    it("manda cabeceras de seguridad y no revela el framework", async () => {
      const r = await request(app.getHttpServer()).get("/api/health");
      expect(r.headers["x-powered-by"]).toBeUndefined();
      expect(r.headers["x-content-type-options"]).toBe("nosniff");
      expect(r.headers["strict-transport-security"]).toBeDefined();
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("autenticación", () => {
    it("rechaza credenciales incorrectas con el mismo mensaje exista o no la cuenta", async () => {
      const s = new Sesion(app);
      const mala = await s.login(profeA.email, "clave-incorrecta");
      const inexistente = await s.login("nadie@test.local", "clave-incorrecta");
      expect(mala.status).toBe(401);
      expect(inexistente.status).toBe(401);
      expect(mala.body.codigo).toBe("credenciales_invalidas");
      expect(mala.body.mensaje).toBe(inexistente.body.mensaje);
    });

    it("valida el cuerpo del login", async () => {
      const s = new Sesion(app);
      expect((await s.login("no-es-un-email", "x")).status).toBe(400);
      expect((await s.http.post("/api/auth/login").set(H).send({})).status).toBe(400);
    });

    it("el login devuelve la sesión y deja los tokens solo en cookies httpOnly", async () => {
      const r = await new Sesion(app).login(profeA.email);
      expect(r.status).toBe(200);
      expect(r.body.session).toMatchObject({ role: "coach", userId: profeA.id });
      expect(JSON.stringify(r.body)).not.toMatch(/access_token|refresh_token|eyJ/);
      const cookies = (r.headers["set-cookie"] as unknown as string[]).join("\n");
      expect(cookies).toMatch(/aktiv_at=.*HttpOnly/i);
      expect(cookies).toMatch(/aktiv_rt=.*HttpOnly/i);
      expect(cookies).toMatch(/SameSite=Lax/i);
      expect(cookies).toMatch(/aktiv_rt=.*Path=\/api\/auth/i);
    });

    it("sin sesión todo lo protegido da 401", async () => {
      const anon = request(app.getHttpServer());
      expect((await anon.get("/api/datos")).status).toBe(401);
      expect((await anon.get("/api/auth/me")).status).toBe(401);
      const r = await anon.get("/api/datos").set("Authorization", "Bearer token.falso.xxx");
      expect(r.status).toBe(401);
      expect(r.body.codigo).toBe("token_invalido");
    });

    it("GET /auth/me devuelve la sesión actual", async () => {
      const r = await A.get("/api/auth/me");
      expect(r.status).toBe(200);
      expect(r.body.session).toMatchObject({ role: "coach", username: profeA.email });
    });

    it("refresh renueva la sesión y sin cookie da 401", async () => {
      const s = await new Sesion(app).entrar(profeA.email);
      const r = await s.post("/api/auth/refresh");
      expect(r.status).toBe(200);
      expect((await s.get("/api/auth/me")).status).toBe(200);
      expect((await new Sesion(app).post("/api/auth/refresh")).status).toBe(401);
    });

    it("logout borra las cookies y cierra la sesión", async () => {
      const s = await new Sesion(app).entrar(profeB.email);
      const r = await s.post("/api/auth/logout");
      expect(r.status).toBe(204);
      expect((await s.get("/api/auth/me")).status).toBe(401);
    });

    it("frena la fuerza bruta: tras 5 fallos responde 429", async () => {
      const s = new Sesion(app);
      const correo = `fuerza-bruta-${uuid().slice(0, 6)}@test.local`;
      for (let i = 0; i < 5; i++) expect((await s.login(correo, "mala")).status).toBe(401);
      const r = await s.login(correo, "mala");
      expect(r.status).toBe(429);
      expect(r.body.codigo).toBe("demasiados_intentos");
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("protección anti-CSRF", () => {
    it("rechaza un pedido que modifica datos sin el header de seguridad", async () => {
      const r = await A.http.post("/api/alumnos").send(ALUMNO_VALIDO());
      expect(r.status).toBe(403);
      expect(r.body.codigo).toBe("csrf");
    });

    it("rechaza un Origin que no es el del frontend", async () => {
      const r = await A.http.post("/api/alumnos").set(H).set("Origin", "https://sitio-malicioso.com").send(ALUMNO_VALIDO());
      expect(r.status).toBe(403);
      expect(r.body.codigo).toBe("origen_no_permitido");
    });

    it("acepta el Origin del frontend", async () => {
      const r = await A.http.post("/api/alumnos").set(H).set("Origin", "http://localhost:3000").send(ALUMNO_VALIDO());
      expect(r.status).toBe(201);
    });

    it("las lecturas (GET) no exigen el header", async () => {
      expect((await A.http.get("/api/datos")).status).toBe(200);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("validación de datos", () => {
    it("rechaza campos que no existen en el contrato (no se puede colar coach_id)", async () => {
      const r = await A.post("/api/alumnos", { ...ALUMNO_VALIDO(), coach_id: profeB.id });
      expect(r.status).toBe(400);
      expect(r.body.codigo).toBe("datos_invalidos");
    });

    it("rechaza valores inválidos y dice en qué campo", async () => {
      const r = await A.post("/api/alumnos", { ...ALUMNO_VALIDO(), nombre: "  ", nivel: "Experto", email: "x@", telefono: "abc" });
      expect(r.status).toBe(400);
      expect(Object.keys(r.body.detalles)).toEqual(expect.arrayContaining(["nombre", "nivel", "email", "telefono"]));
    });

    it("exige ids UUID", async () => {
      expect((await A.post("/api/alumnos", { ...ALUMNO_VALIDO("no-es-uuid") })).status).toBe(400);
      expect((await A.patch("/api/alumnos/no-es-uuid", { nombre: "x" })).status).toBe(400);
    });

    it("rechaza un cuerpo demasiado grande", async () => {
      const r = await A.post("/api/alumnos", { ...ALUMNO_VALIDO(), nombre: "x".repeat(200_000) });
      expect(r.status).toBe(413);
      expect(r.body.codigo).toBe("cuerpo_demasiado_grande");
    });

    it("un JSON roto da 400 con un mensaje claro", async () => {
      const r = await A.http.post("/api/alumnos").set(H).set("Content-Type", "application/json").send("{ esto no es json");
      expect(r.status).toBe(400);
      expect(r.body.codigo).toBe("json_invalido");
    });

    it("un parche vacío es un error, no un éxito silencioso", async () => {
      const r = await A.patch(`/api/alumnos/${alumnoA1}`, {});
      expect(r.status).toBe(400);
      expect(r.body.codigo).toBe("sin_cambios");
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("profe: alumnos, planes y ejercicios", () => {
    const id = uuid();
    const planId = uuid();
    const ejId = uuid();

    it("crea un alumno y aparece en /datos con él como profe dueño", async () => {
      const r = await A.post("/api/alumnos", ALUMNO_VALIDO(id));
      expect(r.status).toBe(201);
      expect(r.body).toEqual({ id });
      const datos = (await A.get("/api/datos")).body;
      const a = datos.alumnos.find((x: { id: string }) => x.id === id);
      expect(a).toMatchObject({ nombre: "Alumno de prueba", coachId: profeA.id, activo: true });
      expect(a.ficha.certificado).toBeNull(); // la ficha vacía la crea la base
      expect(a.semana).toHaveLength(7);
    });

    it("el mismo id dos veces da 409", async () => {
      const r = await A.post("/api/alumnos", ALUMNO_VALIDO(id));
      expect(r.status).toBe(409);
      expect(r.body.codigo).toBe("ya_existe");
    });

    it("edita estado, pago y semana", async () => {
      const semana = Array.from({ length: 7 }, (_, i) => ({ correr: i % 2 === 0, fuerza: i === 3 }));
      const r = await A.patch(`/api/alumnos/${id}`, { activo: false, proximoPago: "2030-01-15", semana });
      expect(r.status).toBe(200);
      const a = (await A.get("/api/datos")).body.alumnos.find((x: { id: string }) => x.id === id);
      expect(a).toMatchObject({ activo: false, proximoPago: "2030-01-15" });
      expect(a.semana[0]).toEqual({ correr: true, fuerza: false });
    });

    it("rechaza una semana de 6 días y un nivel inventado", async () => {
      expect((await A.patch(`/api/alumnos/${id}`, { semana: [] })).status).toBe(400);
      expect((await A.patch(`/api/alumnos/${id}`, { nivel: "Dios" })).status).toBe(400);
    });

    it("crea un plan y un ejercicio y los devuelve en orden", async () => {
      expect((await A.post(`/api/alumnos/${id}/planes`, { id: planId, nombre: "Plan base" })).status).toBe(201);
      const ej = { id: ejId, nombre: "Sentadilla búlgara", series: 3, repeticiones: "10" };
      expect((await A.post(`/api/planes/${planId}/ejercicios`, ej)).status).toBe(201);
      expect((await A.post(`/api/planes/${planId}/ejercicios`, { ...ej, id: uuid(), nombre: "Plancha" })).status).toBe(201);
      const a = (await A.get("/api/datos")).body.alumnos.find((x: { id: string }) => x.id === id);
      expect(a.planes[0].ejercicios.map((e: { nombre: string }) => e.nombre)).toEqual(["Sentadilla búlgara", "Plancha"]);
    });

    it("edita un ejercicio y valida series, repeticiones y peso", async () => {
      expect((await A.patch(`/api/ejercicios/${ejId}`, { series: 4, peso: "12,5", pesoFecha: "2026-10-01" })).status).toBe(200);
      expect((await A.patch(`/api/ejercicios/${ejId}`, { series: 100 })).status).toBe(400);
      expect((await A.patch(`/api/ejercicios/${ejId}`, { series: -1 })).status).toBe(400);
      expect((await A.patch(`/api/ejercicios/${ejId}`, { peso: "mucho" })).status).toBe(400);
      expect((await A.patch(`/api/ejercicios/${ejId}`, { repeticiones: "x".repeat(31) })).status).toBe(400);
    });

    it("el plan activo tiene que ser un plan del mismo alumno", async () => {
      expect((await A.patch(`/api/alumnos/${id}`, { planActivoId: planId })).status).toBe(200);
      const ajeno = uuid();
      await A.post(`/api/alumnos/${alumnoA2}/planes`, { id: ajeno, nombre: "Plan de otro" });
      const r = await A.patch(`/api/alumnos/${id}`, { planActivoId: ajeno });
      expect(r.status).toBe(422);
      expect(r.body.codigo).toBe("plan_invalido");
    });

    it("pone un tope de ejercicios por plan", async () => {
      const plan = uuid();
      await A.post(`/api/alumnos/${alumnoA2}/planes`, { id: plan, nombre: "Plan lleno" });
      let ultimo = 201;
      for (let i = 0; i < 101; i++) {
        const r = await A.post(`/api/planes/${plan}/ejercicios`, { id: uuid(), nombre: "x", series: 1, repeticiones: "1" });
        ultimo = r.status;
        if (i < 100) expect(r.status).toBe(201);
      }
      expect(ultimo).toBe(422);
    }, 120_000);

    it("borra ejercicios y planes (204) y después ya no existen (404)", async () => {
      expect((await A.delete(`/api/ejercicios/${ejId}`)).status).toBe(204);
      expect((await A.delete(`/api/ejercicios/${ejId}`)).status).toBe(404);
      expect((await A.delete(`/api/planes/${planId}`)).status).toBe(204);
    });

    it("borra un alumno y ya no aparece", async () => {
      expect((await A.delete(`/api/alumnos/${id}`)).status).toBe(204);
      expect((await A.delete(`/api/alumnos/${id}`)).status).toBe(404);
      const datos = (await A.get("/api/datos")).body;
      expect(datos.alumnos.some((x: { id: string }) => x.id === id)).toBe(false);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("ficha médica, lesiones y marcas", () => {
    it("completa la ficha y valida teléfono, largo y fechas", async () => {
      const contacto = { nombre: "Ana", parentesco: "Madre", telefono: "+54 11 4444-5555" };
      expect((await A.patch(`/api/alumnos/${alumnoA1}/ficha`, { lugarNacimiento: "Salta", enfermedades: "Asma", fechaNacimiento: "1990-05-10", contacto })).status).toBe(200);
      expect((await A.patch(`/api/alumnos/${alumnoA1}/ficha`, { contacto: { ...contacto, telefono: "llamar" } })).status).toBe(400);
      expect((await A.patch(`/api/alumnos/${alumnoA1}/ficha`, { enfermedades: "x".repeat(2001) })).status).toBe(400);
      expect((await A.patch(`/api/alumnos/${alumnoA1}/ficha`, { fechaNacimiento: "1800-01-01" })).status).toBe(400);
      expect((await A.patch(`/api/alumnos/${alumnoA1}/ficha`, { fechaNacimiento: "2026-02-30" })).status).toBe(400);
      const a = (await A.get("/api/datos")).body.alumnos.find((x: { id: string }) => x.id === alumnoA1);
      expect(a.ficha).toMatchObject({ lugarNacimiento: "Salta", contacto });
    });

    it("no deja editar el certificado por la ficha (tiene su propio endpoint)", async () => {
      const r = await A.patch(`/api/alumnos/${alumnoA1}/ficha`, { certificado: { nombre: "x" } });
      expect(r.status).toBe(400);
    });

    it("lesiones: alta, edición, validación y baja", async () => {
      const id = uuid();
      const base = { id, descripcion: "Tendinitis", fecha: "2026-03-01", estado: "activa" };
      expect((await A.post(`/api/alumnos/${alumnoA1}/lesiones`, base)).status).toBe(201);
      expect((await A.post(`/api/alumnos/${alumnoA1}/lesiones`, { ...base, id: uuid(), descripcion: "  " })).status).toBe(400);
      expect((await A.post(`/api/alumnos/${alumnoA1}/lesiones`, { ...base, id: uuid(), estado: "curada" })).status).toBe(400);
      expect((await A.patch(`/api/lesiones/${id}`, { estado: "recuperada" })).status).toBe(200);
      expect((await A.delete(`/api/lesiones/${id}`)).status).toBe(204);
    });

    it("marcas: alta, edición, validación y baja", async () => {
      const id = uuid();
      const base = { id, distanciaKm: 5, tiempoSeg: 1500, fecha: "2026-03-01", carrera: "5K Palermo" };
      expect((await A.post(`/api/alumnos/${alumnoA1}/marcas`, base)).status).toBe(201);
      for (const malo of [{ tiempoSeg: 0 }, { tiempoSeg: 90000 }, { distanciaKm: 0 }, { distanciaKm: 5000 }, { fecha: manana(10) }]) {
        expect((await A.post(`/api/alumnos/${alumnoA1}/marcas`, { ...base, id: uuid(), ...malo })).status).toBe(400);
      }
      expect((await A.patch(`/api/marcas/${id}`, { tiempoSeg: 1450 })).status).toBe(200);
      expect((await A.delete(`/api/marcas/${id}`)).status).toBe(204);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("carreras e inscripciones", () => {
    const carreraId = uuid();
    const inscId = uuid();
    const base = { id: carreraId, nombre: "Media Maratón", fecha: "2030-12-01", lugar: "CABA", distanciasKm: [10, 21.097], notas: "" };

    it("el profe carga la carrera y valida nombre y distancias", async () => {
      expect((await A.post("/api/carreras", base)).status).toBe(201);
      env.carreras.push(carreraId);
      expect((await A.post("/api/carreras", { ...base, id: uuid(), nombre: " " })).status).toBe(400);
      expect((await A.post("/api/carreras", { ...base, id: uuid(), distanciasKm: [] })).status).toBe(400);
      expect((await A.post("/api/carreras", { ...base, id: uuid(), distanciasKm: [5, 5] })).status).toBe(400);
      expect((await A.post("/api/carreras", { ...base, id: uuid(), distanciasKm: [0] })).status).toBe(400);
      expect((await A.post("/api/carreras", { ...base, id: uuid(), fecha: "1999-01-01" })).status).toBe(422); // la base rechaza el año
    });

    it("asigna un alumno con una distancia que la carrera ofrece", async () => {
      const r = await A.post(`/api/alumnos/${alumnoA1}/inscripciones`, { id: inscId, carreraId, distanciaKm: 21.097, objetivoSeg: 6000 });
      expect(r.status).toBe(201);
      const datos = (await A.get("/api/datos")).body;
      expect(datos.inscripciones.find((i: { id: string }) => i.id === inscId)).toMatchObject({ alumnoId: alumnoA1, distanciaKm: 21.097 });
    });

    it("rechaza una distancia que la carrera no ofrece, un duplicado y una carrera ajena", async () => {
      const mala = await A.post(`/api/alumnos/${alumnoA2}/inscripciones`, { id: uuid(), carreraId, distanciaKm: 42.195, objetivoSeg: null });
      expect(mala.status).toBe(422);
      const dup = await A.post(`/api/alumnos/${alumnoA1}/inscripciones`, { id: uuid(), carreraId, distanciaKm: 10, objetivoSeg: null });
      expect(dup.status).toBe(409);
      const carreraB = uuid();
      await B.post("/api/carreras", { ...base, id: carreraB });
      env.carreras.push(carreraB);
      const ajena = await A.post(`/api/alumnos/${alumnoA2}/inscripciones`, { id: uuid(), carreraId: carreraB, distanciaKm: 10, objetivoSeg: null });
      expect(ajena.status).toBeGreaterThanOrEqual(400);
      expect(ajena.status).toBeLessThan(500);
    });

    it("no deja sacar una distancia que ya eligió un alumno", async () => {
      const r = await A.patch(`/api/carreras/${carreraId}`, { distanciasKm: [10] });
      expect(r.status).toBe(422);
      expect(r.body.codigo).toBe("distancia_en_uso");
      expect((await A.patch(`/api/carreras/${carreraId}`, { distanciasKm: [10, 21.097, 42.195] })).status).toBe(200);
    });

    it("al borrar la carrera se borran sus inscripciones", async () => {
      expect((await A.delete(`/api/carreras/${carreraId}`)).status).toBe(204);
      const datos = (await A.get("/api/datos")).body;
      expect(datos.inscripciones.some((i: { id: string }) => i.id === inscId)).toBe(false);
    });

    it("catálogo de ejercicios del profe: alta, duplicado y baja", async () => {
      const id = uuid();
      expect((await A.post("/api/catalogo/ejercicios", { id, nombre: "Burpees" })).status).toBe(201);
      expect((await A.post("/api/catalogo/ejercicios", { id: uuid(), nombre: "burpees" })).status).toBe(409);
      expect((await A.post("/api/catalogo/ejercicios", { id: uuid(), nombre: "x".repeat(121) })).status).toBe(400);
      expect((await A.delete(`/api/catalogo/ejercicios/${id}`)).status).toBe(204);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("aislamiento entre profes", () => {
    it("el profe B no ve ninguno de los datos del profe A", async () => {
      const datos = (await B.get("/api/datos")).body;
      const ids = datos.alumnos.map((a: { id: string }) => a.id);
      expect(ids).toContain(alumnoB1);
      expect(ids).not.toContain(alumnoA1);
      expect(ids).not.toContain(alumnoA2);
    });

    it("el profe B no puede tocar al alumno del profe A (404, sin revelar que existe)", async () => {
      expect((await B.patch(`/api/alumnos/${alumnoA1}`, { nombre: "hackeado" })).status).toBe(404);
      expect((await B.delete(`/api/alumnos/${alumnoA1}`)).status).toBe(404);
      expect((await B.patch(`/api/alumnos/${alumnoA1}/ficha`, { lugarNacimiento: "x" })).status).toBe(404);
      expect((await B.post(`/api/alumnos/${alumnoA1}/marcas`, { id: uuid(), distanciaKm: 5, tiempoSeg: 1500, fecha: "2026-01-01", carrera: "" })).status).toBe(404);
      expect((await B.post(`/api/alumnos/${alumnoA1}/planes`, { id: uuid(), nombre: "x" })).status).toBe(404);
      expect((await B.get(`/api/alumnos/${alumnoA1}/certificado/url`)).status).toBe(404);
    });

    it("el 404 es idéntico para un alumno que no existe y para uno ajeno", async () => {
      const ajeno = await B.patch(`/api/alumnos/${alumnoA1}`, { nombre: "x" });
      const inexistente = await B.patch(`/api/alumnos/${uuid()}`, { nombre: "x" });
      expect(ajeno.status).toBe(inexistente.status);
      expect(ajeno.body.codigo).toBe(inexistente.body.codigo);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("permisos del alumno", () => {
    let planId: string;
    let ejId: string;
    let carreraId: string;
    let inscId: string;

    beforeAll(async () => {
      planId = uuid();
      ejId = uuid();
      carreraId = uuid();
      inscId = uuid();
      await A.post(`/api/alumnos/${alumnoA1}/planes`, { id: planId, nombre: "Plan del alumno" });
      await A.post(`/api/planes/${planId}/ejercicios`, { id: ejId, nombre: "Sentadilla", series: 3, repeticiones: "10" });
      await A.post("/api/carreras", { id: carreraId, nombre: "10K del club", fecha: "2030-11-01", lugar: "", distanciasKm: [5, 10], notas: "" });
      env.carreras.push(carreraId);
      await A.post(`/api/alumnos/${alumnoA1}/inscripciones`, { id: inscId, carreraId, distanciaKm: 10, objetivoSeg: 3000 });
    });

    it("GET /datos: ve solo su alumno, el calendario de su profe y su id", async () => {
      const r = await S1.get("/api/datos");
      expect(r.status).toBe(200);
      expect(r.body.session).toMatchObject({ role: "alumno", alumnoId: alumnoA1 });
      expect(r.body.alumnos.map((a: { id: string }) => a.id)).toEqual([alumnoA1]);
      expect(r.body.carreras.some((c: { id: string }) => c.id === carreraId)).toBe(true);
      expect(r.body.inscripciones.every((i: { alumnoId: string }) => i.alumnoId === alumnoA1)).toBe(true);
    });

    it("puede editar sus notas, pero nada más de su ficha de alumno (403)", async () => {
      expect((await S1.patch(`/api/alumnos/${alumnoA1}`, { notasAlumno: "me duele la rodilla" })).status).toBe(200);
      for (const campo of [{ nombre: "otro" }, { activo: false }, { notasProfe: "x" }, { proximoPago: "2030-01-01" }]) {
        const r = await S1.patch(`/api/alumnos/${alumnoA1}`, campo);
        expect(r.status).toBe(403);
        expect(r.body.codigo).toBe("sin_permiso");
      }
    });

    it("el profe ve lo que escribió el alumno", async () => {
      const a = (await A.get("/api/datos")).body.alumnos.find((x: { id: string }) => x.id === alumnoA1);
      expect(a.notasAlumno).toBe("me duele la rodilla");
    });

    it("no puede crear ni borrar alumnos, planes, carreras ni inscripciones", async () => {
      expect((await S1.post("/api/alumnos", ALUMNO_VALIDO())).status).toBe(403);
      expect((await S1.delete(`/api/alumnos/${alumnoA1}`)).status).toBe(403);
      expect((await S1.post(`/api/alumnos/${alumnoA1}/planes`, { id: uuid(), nombre: "x" })).status).toBe(403);
      expect((await S1.delete(`/api/planes/${planId}`)).status).toBe(403);
      expect((await S1.post("/api/carreras", { id: uuid(), nombre: "x", fecha: "2030-01-01", lugar: "", distanciasKm: [5], notas: "" })).status).toBe(403);
      expect((await S1.post(`/api/alumnos/${alumnoA1}/inscripciones`, { id: uuid(), carreraId, distanciaKm: 5, objetivoSeg: null })).status).toBe(403);
      expect((await S1.delete(`/api/inscripciones/${inscId}`)).status).toBe(403);
      expect((await S1.post("/api/catalogo/ejercicios", { id: uuid(), nombre: "x" })).status).toBe(403);
    });

    it("puede anotar el peso de su ejercicio, pero no cambiarlo", async () => {
      expect((await S1.patch(`/api/ejercicios/${ejId}`, { peso: "20", pesoFecha: "2026-10-18" })).status).toBe(200);
      expect((await S1.patch(`/api/ejercicios/${ejId}`, { nombre: "Otro" })).status).toBe(403);
      expect((await S1.patch(`/api/ejercicios/${ejId}`, { series: 9 })).status).toBe(403);
      expect((await S1.patch(`/api/ejercicios/${ejId}`, { peso: "mucho" })).status).toBe(400);
    });

    it("puede cargar objetivo y resultado de su inscripción, pero no distancia ni carrera", async () => {
      expect((await S1.patch(`/api/inscripciones/${inscId}`, { objetivoSeg: 2900, resultadoSeg: 3100 })).status).toBe(200);
      expect((await S1.patch(`/api/inscripciones/${inscId}`, { distanciaKm: 5 })).status).toBe(403);
      expect((await S1.patch(`/api/inscripciones/${inscId}`, { carreraId: uuid() })).status).toBe(403);
    });

    it("completa su ficha, sus lesiones y sus marcas", async () => {
      expect((await S1.patch(`/api/alumnos/${alumnoA1}/ficha`, { lugarNacimiento: "Tucumán" })).status).toBe(200);
      expect((await S1.post(`/api/alumnos/${alumnoA1}/lesiones`, { id: uuid(), descripcion: "Tobillo", fecha: null, estado: "activa" })).status).toBe(201);
      expect((await S1.post(`/api/alumnos/${alumnoA1}/marcas`, { id: uuid(), distanciaKm: 10, tiempoSeg: 3000, fecha: "2026-05-01", carrera: "" })).status).toBe(201);
    });

    it("no puede tocar a otro alumno, ni siquiera del mismo profe (404)", async () => {
      expect((await S1.patch(`/api/alumnos/${alumnoA2}`, { notasAlumno: "x" })).status).toBe(404);
      expect((await S1.patch(`/api/alumnos/${alumnoA2}/ficha`, { lugarNacimiento: "x" })).status).toBe(404);
      expect((await S1.post(`/api/alumnos/${alumnoA2}/marcas`, { id: uuid(), distanciaKm: 5, tiempoSeg: 1500, fecha: "2026-01-01", carrera: "" })).status).toBe(404);
      const datosS2 = (await S2.get("/api/datos")).body;
      expect(datosS2.alumnos.map((a: { id: string }) => a.id)).toEqual([alumnoA2]);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("certificado médico", () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
    const subir = (s: Sesion, alumnoId: string, buffer: Buffer, nombre: string, tipo: string, vencimiento?: string) => {
      const r = s.http.post(`/api/alumnos/${alumnoId}/certificado`).set(H).attach("archivo", buffer, { filename: nombre, contentType: tipo });
      return vencimiento ? r.field("vencimiento", vencimiento) : r;
    };

    it("rechaza un archivo que dice ser PDF pero no lo es (se mira el contenido)", async () => {
      const r = await subir(A, alumnoA1, Buffer.from("esto es un texto, no un pdf"), "falso.pdf", "application/pdf");
      expect(r.status).toBe(415);
      expect(r.body.codigo).toBe("tipo_no_permitido");
    });

    it("rechaza un ejecutable disfrazado de imagen", async () => {
      const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100)]);
      expect((await subir(A, alumnoA1, exe, "virus.png", "image/png")).status).toBe(415);
    });

    it("rechaza archivos de más de 5 MB", async () => {
      const grande = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024 + 10)]);
      expect((await subir(A, alumnoA1, grande, "grande.pdf", "application/pdf")).status).toBe(413);
    });

    it("pide el archivo y valida la fecha de vencimiento", async () => {
      expect((await A.http.post(`/api/alumnos/${alumnoA1}/certificado`).set(H)).status).toBe(400);
      expect((await subir(A, alumnoA1, pdf, "c.pdf", "application/pdf", "mañana")).status).toBe(400);
    });

    it("sube un PDF válido y devuelve sus datos", async () => {
      const r = await subir(A, alumnoA1, pdf, "certificado médico.pdf", "application/octet-stream", "2031-01-01");
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ nombre: "certificado médico.pdf", tipo: "application/pdf", vencimiento: "2031-01-01" });
      expect(r.body.ruta.startsWith(`${alumnoA1}/`)).toBe(true);
      const a = (await A.get("/api/datos")).body.alumnos.find((x: { id: string }) => x.id === alumnoA1);
      expect(a.ficha.certificado).toMatchObject({ tipo: "application/pdf", vencimiento: "2031-01-01" });
    });

    it("da una URL firmada de vida corta que sirve el archivo", async () => {
      const r = await A.get(`/api/alumnos/${alumnoA1}/certificado/url`);
      expect(r.status).toBe(200);
      expect(r.body.url).toContain("/object/sign/");
      expect(r.body.expiraEnSegundos).toBe(120);
      expect((await fetch(r.body.url)).status).toBe(200);
    });

    it("ni otro profe ni otro alumno pueden pedir la URL", async () => {
      expect((await B.get(`/api/alumnos/${alumnoA1}/certificado/url`)).status).toBe(404);
      expect((await S2.get(`/api/alumnos/${alumnoA1}/certificado/url`)).status).toBe(404);
      expect((await request(app.getHttpServer()).get(`/api/alumnos/${alumnoA1}/certificado/url`)).status).toBe(401);
    });

    it("el alumno sube el suyo pero no el de otro", async () => {
      expect((await subir(S1, alumnoA1, pdf, "mio.pdf", "application/pdf")).status).toBe(201);
      expect((await subir(S1, alumnoA2, pdf, "ajeno.pdf", "application/pdf")).status).toBe(404);
      expect((await subir(B, alumnoA1, pdf, "ajeno.pdf", "application/pdf")).status).toBe(404);
    });

    it("edita el vencimiento y lo quita", async () => {
      expect((await A.patch(`/api/alumnos/${alumnoA1}/certificado`, { vencimiento: "2032-02-02" })).status).toBe(200);
      expect((await A.patch(`/api/alumnos/${alumnoA1}/certificado`, { vencimiento: "ayer" })).status).toBe(400);
      expect((await A.delete(`/api/alumnos/${alumnoA1}/certificado`)).status).toBe(204);
      expect((await A.get(`/api/alumnos/${alumnoA1}/certificado/url`)).status).toBe(404);
      expect((await A.delete(`/api/alumnos/${alumnoA1}/certificado`)).status).toBe(404);
    });

    it("al borrar un alumno se borran también sus archivos", async () => {
      const id = uuid();
      await A.post("/api/alumnos", ALUMNO_VALIDO(id));
      const sub = await subir(A, id, pdf, "x.pdf", "application/pdf");
      expect(sub.status).toBe(201);
      const antes = await env.admin.storage.from("certificados").list(id);
      expect(antes.data?.length).toBe(1);
      expect((await A.delete(`/api/alumnos/${id}`)).status).toBe(204);
      const despues = await env.admin.storage.from("certificados").list(id);
      expect(despues.data?.length ?? 0).toBe(0);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("errores", () => {
    it("nunca filtra detalles internos ni stack traces", async () => {
      const respuestas = [
        await A.patch(`/api/alumnos/${uuid()}`, { nombre: "x" }),
        await A.post("/api/alumnos", { basura: true }),
        await request(app.getHttpServer()).get("/api/datos"),
      ];
      for (const r of respuestas) {
        const texto = JSON.stringify(r.body);
        expect(texto).not.toMatch(/stack|node_modules|supabase|postgres|PGRST|at Object/i);
        expect(r.body).toEqual(
          expect.objectContaining({ statusCode: r.status, codigo: expect.any(String), mensaje: expect.any(String) }),
        );
      }
    });

    it("el límite general de pedidos responde 429", async () => {
      const limitada = await levantarApi({ RATE_LIMIT_PER_MIN: "5" });
      try {
        const http = request(limitada.getHttpServer());
        const estados: number[] = [];
        for (let i = 0; i < 8; i++) estados.push((await http.get("/api/health")).status);
        expect(estados.slice(0, 5).every((s) => s === 200)).toBe(true);
        expect(estados).toContain(429);
      } finally {
        await limitada.close();
      }
    });
  });

  it("(sanidad) las claves de prueba existen", () => {
    expect(PASS.length).toBeGreaterThan(8);
  });
});
