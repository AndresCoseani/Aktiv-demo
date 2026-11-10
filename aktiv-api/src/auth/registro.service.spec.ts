import { RegistroService } from "./registro.service";
import type { SupabaseService } from "../supabase/supabase.service";
import type { SupabaseAdminService } from "../supabase/admin.service";
import type { Env } from "../config/env";

describe("Registro simple", () => {
  const id = "a0000000-0000-4000-8000-000000000001";
  function preparar(coaches = [{ id }]) {
    const limit = jest.fn().mockResolvedValue({ data: coaches, error: null });
    const createUser = jest.fn().mockResolvedValue({ data: { user: { id: "nuevo" } }, error: null });
    const rpc = jest.fn().mockResolvedValue({ data: "solicitud", error: null });
    const cliente = { from: jest.fn(() => ({ select: () => ({ eq: () => ({ limit }) }) })), auth: { admin: { createUser } }, rpc };
    const servicio = new RegistroService({} as SupabaseService, { disponible: true, admin: () => cliente } as unknown as SupabaseAdminService, {} as Env);
    return { servicio, createUser, rpc };
  }
  it("detecta el único profesor y crea cuenta pendiente sin correo ni sesión", async () => {
    const { servicio, createUser, rpc } = preparar();
    expect(await servicio.profesor()).toBe(id);
    await servicio.registrar({ nombre: "Ana", email: "ana@example.test", dni: "45111222", telefono: "" });
    expect(createUser).toHaveBeenCalledWith({ email: "ana@example.test", password: "45111222", email_confirm: true, user_metadata: { nombre: "Ana", dni: "45111222", telefono: "", origen: "registro_aktiv" } });
    expect(rpc).toHaveBeenCalledWith("completar_registro_alumno", { p_usuario: "nuevo", p_coach: id });
  });
  it("no elige arbitrariamente entre varios profesores ni crea cuentas sin destino", async () => {
    const { servicio, createUser } = preparar([{ id }, { id: "otro" }]);
    expect(await servicio.profesor()).toBeNull();
    await expect(servicio.registrar({ nombre: "Ana", email: "ana@example.test", dni: "45111222", telefono: "" })).rejects.toThrow();
    expect(createUser).not.toHaveBeenCalled();
  });
  it("un email existente conserva su cuenta y su contraseña", async () => {
    const { servicio, createUser, rpc } = preparar();
    createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "email_exists" } });
    await servicio.registrar({ nombre: "Ana", email: "ana@example.test", dni: "45111222", telefono: "" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
