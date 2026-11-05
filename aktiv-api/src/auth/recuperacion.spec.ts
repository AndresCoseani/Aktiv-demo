import { AuthService } from "./auth.service";
import type { SupabaseService } from "../supabase/supabase.service";
import type { Env } from "../config/env";

describe("Pedido de recuperación", () => {
  const reset = jest.fn();
  const supa = { anonimo: () => ({ auth: { resetPasswordForEmail: reset } }) } as unknown as SupabaseService;
  const env = { appUrl: "https://aktiv-running.vercel.app", LOGIN_FALLOS_POR_MIN: 2 } as Env;
  beforeEach(() => reset.mockReset());
  it("fija el destino del enlace y limita también los envíos exitosos", async () => {
    reset.mockResolvedValue({ error: null });
    const auth = new AuthService(supa, env);
    await auth.recuperarClave("alumno@example.test", "ip");
    await auth.recuperarClave("alumno@example.test", "ip");
    expect(reset).toHaveBeenCalledWith("alumno@example.test", { redirectTo: "https://aktiv-running.vercel.app/restablecer-clave" });
    await expect(auth.recuperarClave("alumno@example.test", "ip")).rejects.toMatchObject({ codigo: "demasiados_intentos" });
    expect(reset).toHaveBeenCalledTimes(2);
  });
  it("informa un fallo de envío sin exponer detalles del proveedor", async () => {
    reset.mockResolvedValue({ error: { status: 400, message: "email_address_not_authorized" } });
    await expect(new AuthService(supa, env).recuperarClave("alumno@example.test", "ip")).rejects.toThrow("No pudimos solicitar el correo");
  });
});
