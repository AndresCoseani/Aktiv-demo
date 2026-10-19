import { cargarEnv } from "./env";

const BASE = {
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx",
};

describe("cargarEnv", () => {
  it("aplica valores por defecto seguros", () => {
    const e = cargarEnv(BASE);
    expect(e).toMatchObject({ PORT: 4000, NODE_ENV: "development", TRUST_PROXY: 0, cookieSecure: false });
    expect(e.origenes).toEqual(["http://localhost:3000"]);
  });

  it("en producción las cookies son Secure salvo que se diga lo contrario", () => {
    expect(cargarEnv({ ...BASE, NODE_ENV: "production" }).cookieSecure).toBe(true);
    expect(cargarEnv({ ...BASE, NODE_ENV: "production", COOKIE_SECURE: "false" }).cookieSecure).toBe(false);
  });

  it("acepta varios orígenes del frontend", () => {
    expect(cargarEnv({ ...BASE, WEB_ORIGIN: "https://a.com, https://b.com" }).origenes).toEqual(["https://a.com", "https://b.com"]);
  });

  it("se niega a arrancar si falta algo y dice qué corregir", () => {
    expect(() => cargarEnv({})).toThrow(/SUPABASE_URL/);
    expect(() => cargarEnv({ ...BASE, SUPABASE_ANON_KEY: "corta" })).toThrow(/SUPABASE_ANON_KEY/);
    expect(() => cargarEnv({ ...BASE, SUPABASE_URL: "no-es-url" })).toThrow(/SUPABASE_URL/);
    expect(() => cargarEnv({ ...BASE, PORT: "99999" })).toThrow(/PORT/);
  });
});
