import { Controller, Get, Inject, Module } from "@nestjs/common";
import { Publico } from "../auth/guards";
import { ENV, type Env } from "../config/env";
import { ErrorApi } from "../common/errores";

@Controller("health")
export class HealthController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /** La API está viva */
  @Publico()
  @Get()
  vivo() {
    return { estado: "ok" };
  }

  /**
   * Supabase responde. Funciona con la base vacía (sirve para probar la conexión
   * antes de aplicar las migraciones).
   */
  @Publico()
  @Get("supabase")
  async supabase() {
    try {
      const r = await fetch(`${this.env.SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: this.env.SUPABASE_ANON_KEY },
        signal: AbortSignal.timeout(4_000),
      });
      // 200 con la clave pública válida; 401/403 si la clave no corresponde a este proyecto
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { estado: "ok" };
    } catch {
      throw new ErrorApi(503, "supabase_no_disponible", "No se pudo conectar con Supabase. Revisá SUPABASE_URL y la clave.");
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
