import { Global, Inject, Injectable, Module } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV, type Env } from "../config/env";
import { SupabaseAdminService } from "./admin.service";

export const BUCKET_CERTIFICADOS = "certificados";

/**
 * Acceso a Supabase.
 *
 *  - `anonimo()`  : sin sesión (login, refresh, validar un token).
 *  - `delUsuario(token)` : cliente que lleva el token del usuario. Cada consulta
 *    se ejecuta *como ese usuario*, así que las políticas RLS, los triggers y los
 *    CHECK de la base siguen aplicando aunque haya un bug en la API.
 *
 * Nunca se usa la clave service_role.
 */
@Injectable()
export class SupabaseService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  private crear(token?: string): SupabaseClient {
    return createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
  }

  anonimo() {
    return this.crear();
  }

  delUsuario(token: string) {
    return this.crear(token);
  }
}

@Global()
@Module({
  providers: [SupabaseService, SupabaseAdminService],
  exports: [SupabaseService, SupabaseAdminService],
})
export class SupabaseModule {}
