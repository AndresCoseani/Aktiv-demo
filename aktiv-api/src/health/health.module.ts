import { Controller, Get, Inject, Logger, Module } from "@nestjs/common";
import { Publico } from "../auth/guards";
import { ENV, type Env } from "../config/env";
import { ErrorApi } from "../common/errores";

@Controller("health")
export class HealthController {
  private readonly log = new Logger("Health");

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** La API está viva */
  @Publico()
  @Get()
  vivo() {
    return { estado: "ok" };
  }

  /**
   * Supabase responde. Funciona con la base vacía (sirve para probar la conexión
   * antes de aplicar las migraciones) y cuenta como actividad del proyecto, que en
   * el plan gratis se pausa si pasa una semana sin uso: por eso el cron le pega a esta.
   */
  @Publico()
  @Get("supabase")
  async supabase() {
    const cabeceras = { apikey: this.env.SUPABASE_ANON_KEY };
    const pedir = (ruta: string) =>
      fetch(`${this.env.SUPABASE_URL}${ruta}`, { headers: cabeceras, signal: AbortSignal.timeout(5_000) });
    try {
      // 1) el servicio de Auth responde y la clave corresponde a este proyecto
      const auth = await pedir("/auth/v1/health");
      if (!auth.ok) throw new Error(`Auth respondió HTTP ${auth.status}`);
      // 2) la base responde. Esta app no le da permisos a la clave pública sobre ninguna tabla,
      //    así que lo normal es un "permiso denegado" de Postgres (código 42501): prueba que
      //    la base contestó. Si la tabla no existe todavía (antes de migrar) es 404: también hay conexión
      const base = await pedir("/rest/v1/profiles?select=id&limit=1");
      const cuerpo = (await base.json().catch(() => null)) as { code?: string } | null;
      const contesto = base.ok || base.status === 404 || cuerpo?.code === "42501";
      if (!contesto) throw new Error(`la base respondió HTTP ${base.status}`);
      return { estado: "ok" };
    } catch (e) {
      // el motivo va al log (sin claves) y al usuario le queda un mensaje genérico
      this.log.warn(`Supabase no disponible: ${e instanceof Error ? e.message : e}`);
      throw new ErrorApi(503, "supabase_no_disponible", "No se pudo conectar con Supabase. Revisá SUPABASE_URL y la clave.");
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
