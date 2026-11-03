import request from "supertest";
import { crearApp } from "./app.factory";
import { cargarEnv } from "./config/env";
describe("límite HTTP de importación", () => {
  it("admite el lote sin ampliar el límite del resto de endpoints ni omitir autenticación", async () => {
    const app = await crearApp(cargarEnv({ NODE_ENV: "test", SUPABASE_URL: "https://prueba.example.test", SUPABASE_ANON_KEY: "sb_publishable_solo_pruebas_0000000000" }));
    try {
      await app.init();
      const servidor = app.getHttpServer();
      expect((await request(servidor).post("/api/alumnos/importar").set("x-requested-with", "aktiv").send({ alumnos: [{ relleno: "x".repeat(150000) }] })).status).toBe(401);
      expect((await request(servidor).post("/api/alumnos").set("x-requested-with", "aktiv").send({ relleno: "x".repeat(150000) })).status).toBe(413);
      expect((await request(servidor).post("/api/alumnos/importar").set("x-requested-with", "aktiv").send({ alumnos: [{ relleno: "x".repeat(600000) }] })).status).toBe(413);
    } finally { await app.close(); }
  });
});
