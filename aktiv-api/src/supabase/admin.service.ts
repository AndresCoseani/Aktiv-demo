import { Inject, Injectable } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV, type Env } from "../config/env";
import { ErrorApi } from "../common/errores";

/**
 * ÚNICO punto de la API que usa la clave service_role (la llave maestra de
 * Supabase: se salta RLS). Reglas para no abusar de ella:
 *
 *  - Solo la importan CuentasService e InvitacionesService. Ningún otro módulo.
 *  - Quien la usa comprueba ANTES, con el cliente del usuario (RLS), que quien
 *    hace el pedido es el profe dueño de ese alumno.
 *  - Solo sirve para: crear/borrar/ponerle contraseña a la cuenta de un alumno y
 *    guardar/consumir sus invitaciones. No hay consultas libres con ella.
 *
 * Si la clave no está configurada, el resto de la API funciona igual.
 */
@Injectable()
export class SupabaseAdminService {
  private cliente?: SupabaseClient;

  constructor(@Inject(ENV) private readonly env: Env) {}

  get disponible() {
    return Boolean(this.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  admin(): SupabaseClient {
    const clave = this.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!clave) {
      throw new ErrorApi(
        503,
        "invitaciones_no_configuradas",
        "Las invitaciones todavía no están configuradas en el servidor.",
      );
    }
    this.cliente ??= createClient(this.env.SUPABASE_URL, clave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return this.cliente;
  }
}
