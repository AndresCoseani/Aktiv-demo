import type { Response } from "express";
import { borrarCookies, ponerCookies } from "./cookies";
import type { Env } from "../config/env";
describe("sesión recordada en el dispositivo", () => {
  it("persiste la renovación por 30 días sin exponer tokens a JavaScript", () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };
    const env = { cookieSecure: true } as Env;
    ponerCookies(res as unknown as Response, env, { accessToken: "token-prueba", refreshToken: "refresco-prueba", expiraEn: 3600 });
    expect(res.cookie).toHaveBeenCalledWith("aktiv_rt", "refresco-prueba", { path: "/api/auth", httpOnly: true, secure: true, sameSite: "lax", maxAge: 30 * 86400000 });
    borrarCookies(res as unknown as Response, env);
    expect(res.clearCookie).toHaveBeenCalledWith("aktiv_rt", { path: "/api/auth", httpOnly: true, secure: true, sameSite: "lax" });
  });
});
