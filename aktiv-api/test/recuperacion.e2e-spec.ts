import { createClient } from "@supabase/supabase-js";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Entorno, Sesion, levantarApi, entornoDeTest, PASS } from "./helpers";

describe("Recuperación con Supabase local", () => {
  const env = new Entorno();
  let app: NestExpressApplication;
  beforeAll(async () => { app = await levantarApi(); });
  afterAll(async () => { await env.limpiar(); if (app) await app.close(); });
  it("cambia la clave con un enlace real de recuperación; rechaza un token de login normal", async () => {
    const usuario = await env.usuario("recuperacion", "coach");
    const e = entornoDeTest();
    const db = createClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const normal = await db.auth.signInWithPassword({ email: usuario.email, password: PASS });
    expect(normal.error).toBeNull();
    const cliente = new Sesion(app);
    const nueva = "Recuperada-Segura-2026!";
    expect((await cliente.post("/api/auth/restablecer-clave", { token: normal.data.session!.access_token, claveNueva: nueva })).status).toBe(422);
    const enlace = await env.admin.auth.admin.generateLink({ type: "recovery", email: usuario.email });
    expect(enlace.error).toBeNull();
    // Reproducir el enlace por defecto del correo (GET /verify), no el flujo OTP.
    const redireccion = await fetch(enlace.data.properties!.action_link, { redirect: "manual" });
    expect(redireccion.status).toBe(303);
    const fragmento = new URLSearchParams(new URL(redireccion.headers.get("location")!).hash.slice(1));
    const token = fragmento.get("access_token")!;
    expect(fragmento.get("type")).toBe("recovery");
    const resultado = await cliente.post("/api/auth/restablecer-clave", { token, claveNueva: nueva });
    expect({ status: resultado.status, body: resultado.body }).toEqual({ status: 204, body: {} });
    const acceso = await db.auth.signInWithPassword({ email: usuario.email, password: nueva });
    expect(acceso.error).toBeNull();
    expect((await db.auth.signInWithPassword({ email: usuario.email, password: PASS })).error).not.toBeNull();
    expect((await db.auth.verifyOtp({ type: "recovery", token_hash: enlace.data.properties!.hashed_token })).error).not.toBeNull();
    expect((await cliente.post("/api/auth/restablecer-clave", { token: "invalido-xxxxxxxxxxxxxxxxxxxxxxxxxx", claveNueva: nueva })).status).toBe(422);
  });
});
