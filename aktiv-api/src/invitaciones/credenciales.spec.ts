import { InvitacionesService } from "./invitaciones.module";
import type { SupabaseService } from "../supabase/supabase.service";
import type { SupabaseAdminService } from "../supabase/admin.service";
import type { CuentasService } from "../cuentas/cuentas.service";
import type { AuthService } from "../auth/auth.service";
import type { Mail } from "../mail/mail.service";
import type { Env } from "../config/env";
import type { Usuario } from "../common/tipos";
const u: Usuario = { id: "coach", email: "coach@example.test", rol: "coach", nombre: "Coach", token: "token-prueba" };
function entorno(campos: Record<string, unknown> = {}) {
  const fila = { id: "alumno", coach_id: u.id, user_id: null, nombre: "Ana", email: "ana@example.test", dni: "12345678", ...campos };
  const q: Record<"select" | "eq" | "is" | "gte" | "update" | "insert" | "maybeSingle" | "single", jest.Mock> & { then: (resolver: (r: unknown) => unknown) => Promise<unknown> } = { select: jest.fn(() => q), eq: jest.fn(() => q), is: jest.fn(() => q), gte: jest.fn(() => q), update: jest.fn(() => q), insert: jest.fn(() => q), maybeSingle: jest.fn(async () => ({ data: fila, error: null })), single: jest.fn(async () => ({ data: fila, error: null })), then: (resolver: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolver) };
  const db = { from: jest.fn(() => q) };
  const supa = { delUsuario: jest.fn(() => db) };
  const admin = { admin: jest.fn(() => db) };
  const cuentas = { crearCuentaAlumno: jest.fn(async () => "cuenta"), vincular: jest.fn(async () => true), establecerClave: jest.fn(async () => undefined), emailDe: jest.fn(async () => "cuenta@example.test"), eliminarCuenta: jest.fn() };
  return { servicio: new InvitacionesService(supa as unknown as SupabaseService, admin as unknown as SupabaseAdminService, cuentas as unknown as CuentasService, {} as AuthService, {} as Mail, { INVITACIONES_POR_HORA: 5 } as Env), cuentas, admin, supa };
}
describe("acceso inicial con DNI", () => {
  it("crea credenciales con DNI y el token del profesor", async () => {
    const e = entorno();
    await expect(e.servicio.entregarCredenciales(u, "alumno")).resolves.toEqual({ email: "ana@example.test", clave: "12345678" });
    expect(e.cuentas.crearCuentaAlumno).toHaveBeenCalledWith("ana@example.test", "Ana", "12345678");
    expect(e.supa.delUsuario).toHaveBeenCalledWith(u.token);
  });
  it("no cambia una cuenta existente sin confirmación explícita", async () => {
    const e = entorno({ user_id: "cuenta" });
    await expect(e.servicio.entregarCredenciales(u, "alumno")).rejects.toMatchObject({ status: 409 });
    expect(e.admin.admin).not.toHaveBeenCalled();
    expect(e.cuentas.establecerClave).not.toHaveBeenCalled();
  });
  it("restablece solo por acción explícita y usa el email real de la cuenta", async () => {
    const e = entorno({ user_id: "cuenta" });
    await expect(e.servicio.entregarCredenciales(u, "alumno", true)).resolves.toEqual({ email: "cuenta@example.test", clave: "12345678" });
    expect(e.cuentas.establecerClave).toHaveBeenCalledWith("cuenta", "12345678");
  });
  it.each([{ dni: "" }, { dni: "123456" }, { coach_id: "otro" }])("rechaza datos o propietario inválidos antes de usar admin: %j", async (campos) => {
    const e = entorno(campos);
    await expect(e.servicio.entregarCredenciales(u, "alumno")).rejects.toBeDefined();
    expect(e.admin.admin).not.toHaveBeenCalled();
  });
});
