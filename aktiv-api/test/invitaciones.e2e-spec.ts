import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import request from "supertest";
import { Entorno, H, MailMemoria, PASS, Sesion, levantarApi, uuid, type UsuarioTest } from "./helpers";

const PREFIJO = "inv-";
const correo = () => `${PREFIJO}${uuid().slice(0, 8)}@test.local`;
const CLAVE_NUEVA = "Clave-nueva-2026";

describe("Alta de alumnos con invitación por mail", () => {
  let app: NestExpressApplication;
  const mail = new MailMemoria();
  const env = new Entorno();
  let profe: UsuarioTest;
  let otroProfe: UsuarioTest;
  let A: Sesion; // profe
  let B: Sesion; // otro profe

  /** Crea un alumno (como el profe), opcionalmente con un plan, y devuelve su id y email */
  async function nuevoAlumno(nombre = "Maria Prueba", email = correo()) {
    const id = uuid();
    const r = await A.post("/api/alumnos", {
      id, nombre, email, telefono: "", objetivo: "10K", nivel: "Principiante",
    });
    expect(r.status).toBe(201);
    return { id, email, nombre };
  }

  beforeAll(async () => {
    app = await levantarApi({}, { mail });
    profe = await env.usuario("profeInv", "coach");
    otroProfe = await env.usuario("otroProfeInv", "coach");
    A = await new Sesion(app).entrar(profe.email);
    B = await new Sesion(app).entrar(otroProfe.email);
  });

  afterAll(async () => {
    await env.limpiarCuentasCon(PREFIJO);
    await env.limpiar();
    await app.close();
  });

  /* ────────────────────────────────────────────────────────── */
  it("RECORRIDO COMPLETO: crear alumno → asignarle un plan → invitarlo → el alumno entra y lo ve", async () => {
    // 1. el profe da de alta al alumno y le arma un plan
    const al = await nuevoAlumno("Maria Prueba");
    const planId = uuid();
    expect((await A.post(`/api/alumnos/${al.id}/planes`, { id: planId, nombre: "Plan de inicio", tipo: "Fuerza", activo: true })).status).toBe(201);
    const ejId = uuid();
    expect((await A.post(`/api/planes/${planId}/ejercicios`, { id: ejId, nombre: "Sentadilla búlgara", series: 3, repeticiones: "10" })).status).toBe(201);
    expect((await A.post(`/api/planes/${planId}/ejercicios`, { id: uuid(), nombre: "Trote regenerativo", series: 1, repeticiones: "30 min" })).status).toBe(201);
    expect((await A.patch(`/api/alumnos/${al.id}`, { semana: Array.from({ length: 7 }, (_, i) => ({ correr: i % 2 === 0, fuerza: i === 3 })) })).status).toBe(200);

    // 2. todavía no tiene cuenta
    let datos = (await A.get("/api/datos")).body;
    let a = datos.alumnos.find((x: { id: string }) => x.id === al.id);
    expect(a.acceso).toEqual({ estado: "sin_cuenta", expiraEn: null });
    expect(a.userId ?? null).toBeNull();

    // 3. lo invita: se crea la cuenta y sale el mail con el enlace
    const inv = await A.post(`/api/alumnos/${al.id}/invitar`, {});
    expect(inv.status).toBe(200);
    expect(inv.body.enviadoA).toBe(al.email);
    expect(new Date(inv.body.expiraEn).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(mail.enviados).toHaveLength(1);
    const enviado = mail.enviados[0];
    expect(enviado.a).toBe(al.email);
    expect(enviado.asunto).toContain("te invitó a Aktiv");
    expect(enviado.html).toContain("Crear mi contraseña");
    expect(enviado.texto).toContain("Maria Prueba");
    const token = mail.ultimoToken();
    expect(token.length).toBeGreaterThanOrEqual(40);

    datos = (await A.get("/api/datos")).body;
    a = datos.alumnos.find((x: { id: string }) => x.id === al.id);
    expect(a.acceso.estado).toBe("invitado");
    expect(a.userId).toBeTruthy();

    // 4. el alumno abre el enlace (sin sesión) y ve de quién es
    const consulta = await request(app.getHttpServer()).get(`/api/auth/invitacion/${token}`);
    expect(consulta.status).toBe(200);
    expect(consulta.body).toEqual({ nombre: "Maria Prueba", email: al.email, profe: profe.nombre });

    // 5. elige su contraseña: una débil se rechaza, una buena lo deja adentro
    const S = new Sesion(app);
    expect((await S.http.post("/api/auth/invitacion/aceptar").set(H).send({ token, clave: "corta" })).status).toBe(400);
    const aceptar = await S.http.post("/api/auth/invitacion/aceptar").set(H).send({ token, clave: CLAVE_NUEVA });
    expect(aceptar.status).toBe(200);
    expect(aceptar.body.session).toMatchObject({ role: "alumno", username: al.email });
    expect(JSON.stringify(aceptar.body)).not.toMatch(/access_token|refresh_token|eyJ/);
    expect((aceptar.headers["set-cookie"] as unknown as string[]).join("\n")).toMatch(/aktiv_at=.*HttpOnly/i);

    // 6. ya con sesión, ve SU plan (el que armó el profe) y puede anotar el peso
    const suyos = (await S.get("/api/datos")).body;
    expect(suyos.session.alumnoId).toBe(al.id);
    expect(suyos.alumnos).toHaveLength(1);
    const miAlumno = suyos.alumnos[0];
    expect(miAlumno.planes[0]).toMatchObject({ id: planId, tipo: "Fuerza", activo: true });
    expect(miAlumno.planes[0].ejercicios.map((e: { nombre: string }) => e.nombre)).toEqual(["Sentadilla búlgara", "Trote regenerativo"]);
    expect(miAlumno.semana[0]).toEqual({ correr: true, fuerza: false });
    expect(miAlumno.acceso).toBeUndefined(); // el estado de acceso es solo del profe
    expect((await S.patch(`/api/ejercicios/${ejId}`, { peso: "12", pesoFecha: "2026-10-19" })).status).toBe(200);
    expect((await S.patch(`/api/alumnos/${al.id}`, { activo: false })).status).toBe(403);

    // 7. el enlace es de un solo uso
    const otra = await request(app.getHttpServer()).post("/api/auth/invitacion/aceptar").set(H).send({ token, clave: "Otra-clave-2026" });
    expect(otra.status).toBe(410);
    expect(otra.body.codigo).toBe("invitacion_invalida");

    // 8. el profe ve que ya está activo y el peso que anotó
    datos = (await A.get("/api/datos")).body;
    a = datos.alumnos.find((x: { id: string }) => x.id === al.id);
    expect(a.acceso.estado).toBe("activo");
    expect(a.planes[0].ejercicios[0].peso).toBe("12");

    // 9. después puede entrar con su email y contraseña de siempre
    expect((await new Sesion(app).login(al.email, CLAVE_NUEVA)).status).toBe(200);
  });

  /* ────────────────────────────────────────────────────────── */
  describe("permisos", () => {
    it("solo el profe dueño invita; un alumno, otro profe y un anónimo no", async () => {
      const al = await nuevoAlumno();
      expect((await B.post(`/api/alumnos/${al.id}/invitar`, {})).status).toBe(404);
      expect((await request(app.getHttpServer()).post(`/api/alumnos/${al.id}/invitar`).set(H).send({})).status).toBe(401);
      expect((await A.post("/api/alumnos/no-es-uuid/invitar", {})).status).toBe(400);
      expect((await A.post(`/api/alumnos/${uuid()}/invitar`, {})).status).toBe(404);
      expect((await A.post(`/api/alumnos/${al.id}/invitar`, { email: "otro@x.com" })).status).toBe(400); // no se acepta un email por el cuerpo
      expect((await A.http.post(`/api/alumnos/${al.id}/invitar`).send({})).status).toBe(403); // sin header anti-CSRF
    });

    it("un alumno con cuenta no puede invitar a nadie", async () => {
      const al = await nuevoAlumno();
      await A.post(`/api/alumnos/${al.id}/invitar`, {});
      const S = new Sesion(app);
      await S.http.post("/api/auth/invitacion/aceptar").set(H).send({ token: mail.ultimoToken(), clave: CLAVE_NUEVA });
      expect((await S.post(`/api/alumnos/${al.id}/invitar`, {})).status).toBe(403);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("casos de borde", () => {
    it("sin email no se puede invitar", async () => {
      const id = uuid();
      await A.post("/api/alumnos", { id, nombre: "Sin Mail", email: "", telefono: "", objetivo: "", nivel: "Principiante" });
      const r = await A.post(`/api/alumnos/${id}/invitar`, {});
      expect(r.status).toBe(422);
      expect(r.body.codigo).toBe("sin_email");
    });

    it("un email que ya tiene cuenta da 409 y no deja nada a medias", async () => {
      const email = correo();
      const uno = await nuevoAlumno("Uno", email);
      const dos = await nuevoAlumno("Dos", email);
      expect((await A.post(`/api/alumnos/${uno.id}/invitar`, {})).status).toBe(200);
      const r = await A.post(`/api/alumnos/${dos.id}/invitar`, {});
      expect(r.status).toBe(409);
      expect(r.body.codigo).toBe("email_en_uso");
      const datos = (await A.get("/api/datos")).body;
      expect(datos.alumnos.find((x: { id: string }) => x.id === dos.id).acceso.estado).toBe("sin_cuenta");
    });

    it("si no está configurada la clave de servidor, las invitaciones dicen 503 y el resto sigue andando", async () => {
      const sinClave = await levantarApi({ SUPABASE_SERVICE_ROLE_KEY: "" }, { mail: new MailMemoria() });
      try {
        const S = await new Sesion(sinClave).entrar(profe.email);
        const al = uuid();
        await S.post("/api/alumnos", { id: al, nombre: "X", email: correo(), telefono: "", objetivo: "", nivel: "Principiante" });
        const r = await S.post(`/api/alumnos/${al}/invitar`, {});
        expect(r.status).toBe(503);
        expect(r.body.codigo).toBe("invitaciones_no_configuradas");
        expect((await S.get("/api/datos")).status).toBe(200);
      } finally {
        await sinClave.close();
      }
    });

    it("si el mail no sale, se informa (502) y el enlace no queda colgado", async () => {
      const al = await nuevoAlumno();
      mail.fallar = true;
      const r = await A.post(`/api/alumnos/${al.id}/invitar`, {});
      mail.fallar = false;
      expect(r.status).toBe(502);
      expect(r.body.codigo).toBe("mail_no_enviado");
      const { data } = await env.admin
        .from("invitaciones")
        .select("id")
        .eq("alumno_id", al.id)
        .is("usada_en", null)
        .is("invalidada_en", null);
      expect(data ?? []).toHaveLength(0); // ningún enlace vivo
      // y se puede reintentar sin problema (la cuenta ya quedó creada)
      expect((await A.post(`/api/alumnos/${al.id}/invitar`, {})).status).toBe(200);
    });

    it("pone un tope de invitaciones por hora a cada alumno", async () => {
      const limitada = await levantarApi({ INVITACIONES_POR_HORA: "3" }, { mail: new MailMemoria() });
      try {
        const S = await new Sesion(limitada).entrar(profe.email);
        const id = uuid();
        await S.post("/api/alumnos", { id, nombre: "Tope", email: correo(), telefono: "", objetivo: "", nivel: "Principiante" });
        const estados: number[] = [];
        for (let i = 0; i < 4; i++) estados.push((await S.post(`/api/alumnos/${id}/invitar`, {})).status);
        expect(estados).toEqual([200, 200, 200, 429]);
      } finally {
        await limitada.close();
      }
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("el enlace", () => {
    it("nunca se guarda: en la base solo está su hash", async () => {
      const al = await nuevoAlumno();
      await A.post(`/api/alumnos/${al.id}/invitar`, {});
      const token = mail.ultimoToken();
      const { data } = await env.admin.from("invitaciones").select("token_hash").eq("alumno_id", al.id).single();
      expect(data?.token_hash).toBe(createHash("sha256").update(token).digest("hex"));
      expect(JSON.stringify(data)).not.toContain(token);
    });

    it("vencido: responde 410 con su propio código y el profe lo ve como vencido", async () => {
      const al = await nuevoAlumno();
      await A.post(`/api/alumnos/${al.id}/invitar`, {});
      const token = mail.ultimoToken();
      await env.admin
        .from("invitaciones")
        .update({ creada_en: new Date(Date.now() - 2 * 86_400_000).toISOString(), expira_en: new Date(Date.now() - 86_400_000).toISOString() })
        .eq("alumno_id", al.id);
      const r = await request(app.getHttpServer()).get(`/api/auth/invitacion/${token}`);
      expect(r.status).toBe(410);
      expect(r.body.codigo).toBe("invitacion_vencida");
      expect((await request(app.getHttpServer()).post("/api/auth/invitacion/aceptar").set(H).send({ token, clave: CLAVE_NUEVA })).status).toBe(410);
      const datos = (await A.get("/api/datos")).body;
      expect(datos.alumnos.find((x: { id: string }) => x.id === al.id).acceso.estado).toBe("invitacion_vencida");
    });

    it("reenviar invalida el enlace anterior; y sirve para restablecer la contraseña de un alumno activo", async () => {
      const al = await nuevoAlumno();
      await A.post(`/api/alumnos/${al.id}/invitar`, {});
      const viejo = mail.ultimoToken();
      await A.post(`/api/alumnos/${al.id}/invitar`, {});
      const nuevo = mail.ultimoToken();
      expect(nuevo).not.toBe(viejo);
      expect((await request(app.getHttpServer()).get(`/api/auth/invitacion/${viejo}`)).status).toBe(410);
      expect((await request(app.getHttpServer()).get(`/api/auth/invitacion/${nuevo}`)).status).toBe(200);

      expect((await new Sesion(app).http.post("/api/auth/invitacion/aceptar").set(H).send({ token: nuevo, clave: CLAVE_NUEVA })).status).toBe(200);
      // ya activo: "reenviar acceso" genera otro enlace y cambia la contraseña
      expect((await A.post(`/api/alumnos/${al.id}/invitar`, {})).status).toBe(200);
      const reset = mail.ultimoToken();
      expect((await new Sesion(app).http.post("/api/auth/invitacion/aceptar").set(H).send({ token: reset, clave: "Tercera-clave-2026" })).status).toBe(200);
      expect((await new Sesion(app).login(al.email, "Tercera-clave-2026")).status).toBe(200);
      expect((await new Sesion(app).login(al.email, CLAVE_NUEVA)).status).toBe(401);
    });

    it("un enlace inventado da 410, uno mal formado 400, y insistir se frena (429)", async () => {
      const http = request(app.getHttpServer());
      expect((await http.get("/api/auth/invitacion/corto")).status).toBe(400);
      expect((await http.get("/api/auth/invitacion/%3Cscript%3E")).status).toBe(400);
      const falso = "A".repeat(43);
      const r = await http.get(`/api/auth/invitacion/${falso}`);
      expect(r.status).toBe(410);
      expect(r.body.codigo).toBe("invitacion_invalida");
      // la app de prueba permite 5×2 fallos por minuto desde la misma IP
      const limitada = await levantarApi({ LOGIN_FALLOS_POR_MIN: "2" });
      try {
        const h = request(limitada.getHttpServer());
        const estados: number[] = [];
        for (let i = 0; i < 6; i++) estados.push((await h.get(`/api/auth/invitacion/${"B".repeat(43)}`)).status);
        expect(estados.slice(0, 4).every((s) => s === 410)).toBe(true);
        expect(estados).toContain(429);
      } finally {
        await limitada.close();
      }
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("borrar un alumno con cuenta", () => {
    it("borra también su cuenta: ya no puede entrar ni queda un usuario suelto", async () => {
      const al = await nuevoAlumno();
      await A.post(`/api/alumnos/${al.id}/invitar`, {});
      const S = new Sesion(app);
      await S.http.post("/api/auth/invitacion/aceptar").set(H).send({ token: mail.ultimoToken(), clave: CLAVE_NUEVA });
      const userId = (await S.get("/api/datos")).body.session.userId as string;

      expect((await A.delete(`/api/alumnos/${al.id}`)).status).toBe(204);
      expect((await env.admin.auth.admin.getUserById(userId)).data.user).toBeNull();
      const { data: perfil } = await env.admin.from("profiles").select("id").eq("id", userId);
      expect(perfil ?? []).toHaveLength(0);
      expect((await new Sesion(app).login(al.email, CLAVE_NUEVA)).status).toBe(401);
    });

    it("un profe no puede borrar al alumno de otro (y su cuenta tampoco se toca)", async () => {
      const al = await nuevoAlumno();
      await A.post(`/api/alumnos/${al.id}/invitar`, {});
      expect((await B.delete(`/api/alumnos/${al.id}`)).status).toBe(404);
      const { data } = await env.admin.from("alumnos").select("user_id").eq("id", al.id).single();
      expect((await env.admin.auth.admin.getUserById(data!.user_id)).data.user).not.toBeNull();
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("acceso sin mail: credenciales con contraseña aleatoria", () => {
    it("crea la cuenta, devuelve email y contraseña UNA vez, y el alumno entra con eso", async () => {
      const al = await nuevoAlumno("Camila Credenciales");
      const r = await A.post(`/api/alumnos/${al.id}/credenciales`, {});
      expect(r.status).toBe(200);
      expect(r.headers["cache-control"]).toMatch(/no-store/);
      expect(r.body.email).toBe(al.email);
      expect(r.body.clave).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/); // 12 caracteres sin los que se confunden
      expect(/[A-Z]/.test(r.body.clave) && /[a-z]/.test(r.body.clave) && /[0-9]/.test(r.body.clave)).toBe(true);
      expect(mail.enviados.some((m) => m.a === al.email)).toBe(false); // no sale ningún mail

      // el estado pasa a "activo" y el alumno entra con esas credenciales
      const a = (await A.get("/api/datos")).body.alumnos.find((x: { id: string }) => x.id === al.id);
      expect(a.acceso.estado).toBe("activo");
      const S = new Sesion(app);
      const login = await S.login(al.email, r.body.clave);
      expect(login.status).toBe(200);
      expect(login.body.session).toMatchObject({ role: "alumno" });
      expect((await S.get("/api/datos")).body.session.alumnoId).toBe(al.id);

      // la contraseña no queda en ningún lado de la base ni en el listado del profe
      expect(JSON.stringify((await A.get("/api/datos")).body)).not.toContain(r.body.clave);
    });

    it("cada pedido genera una contraseña distinta, y la anterior deja de servir", async () => {
      const al = await nuevoAlumno();
      const uno = (await A.post(`/api/alumnos/${al.id}/credenciales`, {})).body;
      const dos = (await A.post(`/api/alumnos/${al.id}/credenciales`, {})).body;
      expect(dos.clave).not.toBe(uno.clave);
      expect((await new Sesion(app).login(al.email, uno.clave)).status).toBe(401);
      expect((await new Sesion(app).login(al.email, dos.clave)).status).toBe(200);
    });

    it("invalida el enlace de invitación pendiente (no puede pisar la contraseña entregada)", async () => {
      const al = await nuevoAlumno();
      await A.post(`/api/alumnos/${al.id}/invitar`, {});
      const token = mail.ultimoToken();
      expect((await A.post(`/api/alumnos/${al.id}/credenciales`, {})).status).toBe(200);
      const aceptar = await request(app.getHttpServer()).post("/api/auth/invitacion/aceptar").set(H).send({ token, clave: CLAVE_NUEVA });
      expect(aceptar.status).toBe(410);
    });

    it("sin email no se puede, y es solo del profe dueño", async () => {
      const sinEmail = uuid();
      expect((await A.post("/api/alumnos", { id: sinEmail, nombre: "Sin Mail", email: "", telefono: "", objetivo: "", nivel: "Principiante" })).status).toBe(201);
      const r = await A.post(`/api/alumnos/${sinEmail}/credenciales`, {});
      expect(r.status).toBe(422);
      expect(r.body.codigo).toBe("sin_email");

      const al = await nuevoAlumno();
      expect((await B.post(`/api/alumnos/${al.id}/credenciales`, {})).status).toBe(404);
      expect((await A.post(`/api/alumnos/${al.id}/credenciales`, { clave: "admin" })).status).toBe(400);
      expect((await request(app.getHttpServer()).post(`/api/alumnos/${al.id}/credenciales`).set(H).send({})).status).toBe(401);
    });

    it("funciona aunque el reloj de la API esté atrasado respecto del de la base (caso real: el CHECK expira_en > creada_en)", async () => {
      const al = await nuevoAlumno();
      const real = Date.now;
      jest.spyOn(Date, "now").mockImplementation(() => real() - 60_000); // la API "cree" que es 1 minuto antes
      let r;
      try {
        r = await A.post(`/api/alumnos/${al.id}/credenciales`, {});
      } finally {
        jest.restoreAllMocks();
      }
      expect(r.status).toBe(200);
      expect((await new Sesion(app).login(al.email, r.body.clave)).status).toBe(200);
    });

    it("tiene tope por hora (cuenta junto con las invitaciones)", async () => {
      const al = await nuevoAlumno();
      let ultimo = 200;
      for (let i = 0; i < 6; i++) ultimo = (await A.post(`/api/alumnos/${al.id}/credenciales`, {})).status;
      expect(ultimo).toBe(429);
    });
  });

  /* ────────────────────────────────────────────────────────── */
  describe("cambiar la propia contraseña", () => {
    it("pide la actual, valida la nueva y deja entrar con la nueva", async () => {
      const al = await nuevoAlumno();
      const { clave } = (await A.post(`/api/alumnos/${al.id}/credenciales`, {})).body;
      const S = new Sesion(app);
      await S.login(al.email, clave);

      expect((await S.post("/api/auth/clave", { claveActual: "incorrecta", claveNueva: CLAVE_NUEVA })).status).toBe(422);
      expect((await S.post("/api/auth/clave", { claveActual: clave, claveNueva: "corta" })).status).toBe(400);
      expect((await S.post("/api/auth/clave", { claveActual: clave, claveNueva: clave })).status).toBe(422);
      expect((await S.post("/api/auth/clave", { claveActual: clave, claveNueva: CLAVE_NUEVA, otro: 1 })).status).toBe(400);
      // la sesión sigue viva después de un intento fallido (no se confunde con un 401)
      expect((await S.get("/api/auth/me")).status).toBe(200);

      expect((await S.post("/api/auth/clave", { claveActual: clave, claveNueva: CLAVE_NUEVA })).status).toBe(204);
      expect((await new Sesion(app).login(al.email, clave)).status).toBe(401);
      expect((await new Sesion(app).login(al.email, CLAVE_NUEVA)).status).toBe(200);
    });

    it("exige estar con la sesión iniciada", async () => {
      const r = await request(app.getHttpServer()).post("/api/auth/clave").set(H).send({ claveActual: "x", claveNueva: CLAVE_NUEVA });
      expect(r.status).toBe(401);
    });
  });

  it("(sanidad) usa claves de prueba de verdad", () => {
    expect(PASS.length).toBeGreaterThan(8);
  });
});
