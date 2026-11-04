import { HealthController } from "./health.module";
import { cargarEnv } from "../config/env";
import { crearApp } from "../app.factory";
import request from "supertest";
import { LegacyRouteConverter } from "@nestjs/core/router/legacy-route-converter";

describe("health: separar API de dependencia Supabase", () => {
  const env = cargarEnv({ NODE_ENV: "test", SUPABASE_URL: "https://prueba.supabase.co", SUPABASE_ANON_KEY: "sb_publishable_solo_pruebas_0000000000" });
  afterEach(() => jest.restoreAllMocks());
  it("liveness no depende de Supabase", () => {
    const fetch = jest.spyOn(globalThis, "fetch");
    expect(new HealthController(env).vivo()).toEqual({ estado: "ok" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("readiness acepta respuesta de base con RLS", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "42501" }), { status: 401 }));
    await expect(new HealthController(env).supabase()).resolves.toEqual({ estado: "ok" });
  });
  it("reporta 503 si Auth no está disponible", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("caído", { status: 503 }));
    await expect(new HealthController(env).supabase()).rejects.toMatchObject({ status: 503 });
  });
  it("liveness no falla por el límite de solicitudes del proxy", async () => {
    const warning = jest.spyOn(LegacyRouteConverter, "printWarning");
    const app = await crearApp({ ...env, RATE_LIMIT_PER_MIN: 1 });
    try {
      await app.init();
      for (let i = 0; i < 3; i++) {
        const r = await request(app.getHttpServer()).get("/api/health");
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ estado: "ok" });
        expect(r.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
      }
      expect(warning).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
