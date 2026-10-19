import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { ErrorApi, lanzarSiError } from "../common/errores";
import { SupabaseAdminService } from "../supabase/admin.service";

/**
 * Cuentas de los alumnos (Supabase Auth + tabla profiles). Usa la clave de
 * servidor, así que SOLO se llama después de comprobar permisos (ver
 * SupabaseAdminService). Nunca toca cuentas de profes.
 */
@Injectable()
export class CuentasService {
  private readonly log = new Logger("Cuentas");

  constructor(private readonly admin: SupabaseAdminService) {}

  /** Contraseña aleatoria que nadie conoce: el alumno elige la suya al aceptar la invitación */
  private claveAleatoria() {
    return randomBytes(24).toString("base64url");
  }

  /** Crea la cuenta (sin contraseña conocida) y su perfil de alumno. Devuelve el id del usuario. */
  async crearCuentaAlumno(email: string, nombre: string): Promise<string> {
    const sb = this.admin.admin();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: this.claveAleatoria(),
      email_confirm: true,
    });
    if (error || !data.user) {
      if (error?.code === "email_exists" || error?.status === 422) {
        throw new ErrorApi(HttpStatus.CONFLICT, "email_en_uso", "Ya existe una cuenta con ese email.");
      }
      this.log.error(`createUser falló: ${error?.message}`);
      throw new ErrorApi(HttpStatus.BAD_GATEWAY, "cuenta_no_creada", "No se pudo crear la cuenta. Probá de nuevo.");
    }
    const id = data.user.id;
    const { error: ePerfil } = await sb.from("profiles").insert({ id, rol: "alumno", nombre, email });
    if (ePerfil) {
      await sb.auth.admin.deleteUser(id).catch(() => undefined);
      lanzarSiError(ePerfil);
    }
    return id;
  }

  /** Vincula la cuenta al alumno solo si todavía no tenía una (evita pisar otra cuenta) */
  async vincular(alumnoId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.admin
      .admin()
      .from("alumnos")
      .update({ user_id: userId })
      .eq("id", alumnoId)
      .is("user_id", null)
      .select("id");
    lanzarSiError(error);
    return Boolean(data?.length);
  }

  async emailDe(userId: string): Promise<string | null> {
    const { data, error } = await this.admin.admin().auth.admin.getUserById(userId);
    return error ? null : (data.user?.email ?? null);
  }

  async establecerClave(userId: string, clave: string) {
    const { error } = await this.admin.admin().auth.admin.updateUserById(userId, { password: clave });
    if (error) {
      throw new ErrorApi(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "clave_rechazada",
        "Esa contraseña no se aceptó. Elegí una más larga o menos común.",
      );
    }
  }

  /** Borra la cuenta de un alumno. Si el usuario no es alumno, no hace nada. */
  async eliminarCuenta(userId: string): Promise<void> {
    try {
      const sb = this.admin.admin();
      const { data } = await sb.from("profiles").select("rol").eq("id", userId).maybeSingle();
      if (data?.rol !== "alumno") {
        this.log.warn(`No se borra la cuenta ${userId}: no es de un alumno.`);
        return;
      }
      await sb.auth.admin.deleteUser(userId);
    } catch (e) {
      // el alumno ya se borró: la cuenta huérfana queda registrada para limpiarla a mano
      this.log.error(`No se pudo borrar la cuenta ${userId}: ${e instanceof Error ? e.message : e}`);
    }
  }
}
