import { Body, Controller, Get, Module, Post } from "@nestjs/common";
import { actividadPlanSchema } from "@aktiv/contrato";
import { z } from "zod";
import { Roles } from "../auth/guards";
import { UsuarioActual } from "../common/bd";
import { lanzarSiError } from "../common/errores";
import type { Usuario } from "../common/tipos";
import { validarOLanzar } from "../common/zod.pipe";
import { SupabaseService } from "../supabase/supabase.service";

@Roles("coach")
@Controller("actividades-plan")
class ActividadesController {
  constructor(private readonly supa: SupabaseService) {}
  @Get()
  async listar(@UsuarioActual() u: Usuario) {
    const nombres = new Set(["Fuerza", "Running"]);
    const db = this.supa.delUsuario(u.token);
    for (let desde = 0; ; desde += 500) {
      const r = await db.from("actividades_plan").select("nombre").order("nombre").range(desde, desde + 499);
      lanzarSiError(r.error);
      for (const fila of r.data ?? []) nombres.add(fila.nombre);
      if ((r.data?.length ?? 0) < 500) return [...nombres];
    }
  }
  @Post()
  async crear(@UsuarioActual() u: Usuario, @Body() body: unknown) {
    const dto = validarOLanzar(z.object({ nombre: actividadPlanSchema }).strict(), body);
    const nombre = ["Fuerza", "Running"].find((n) => n.toLowerCase() === dto.nombre.toLowerCase()) ?? dto.nombre;
    const db = this.supa.delUsuario(u.token);
    const r = await db.from("actividades_plan").upsert({ coach_id: u.id, nombre }, { onConflict: "coach_id,clave", ignoreDuplicates: true });
    lanzarSiError(r.error);
    const consulta = await db.from("actividades_plan").select("nombre").eq("clave", nombre.toLocaleLowerCase("es")).single();
    lanzarSiError(consulta.error);
    return { nombre: consulta.data!.nombre };
  }
}
@Module({ controllers: [ActividadesController] })
export class ActividadesModule {}
