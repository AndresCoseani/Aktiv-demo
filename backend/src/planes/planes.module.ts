import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import {
  CAMPOS_EJERCICIO_EDITABLES_POR_ALUMNO,
  altaEjercicioApi,
  altaPlanApi,
  parcheEjercicioAlumnoApi,
  parcheEjercicioProfeApi,
  parchePlanApi,
  uuidSchema,
} from "@aktiv/contrato";
import { Roles } from "../auth/guards";
import {
  RESPUESTA_ID,
  UsuarioActual,
  actualizarUno,
  asegurarAlumno,
  borrarUno,
  parchePorRol,
} from "../common/bd";
import { lanzarSiError, noEncontrado, reglaDeNegocio } from "../common/errores";
import type { Usuario } from "../common/tipos";
import { ZodPipe, validarOLanzar } from "../common/zod.pipe";
import { columnasEjercicio, columnasPlan } from "../datos/mapeo";
import { SupabaseService } from "../supabase/supabase.service";

/** topes para que nadie llene la base con miles de planes o ejercicios */
const MAX_PLANES_POR_ALUMNO = 50;
const MAX_EJERCICIOS_POR_PLAN = 100;

@Injectable()
export class PlanesService {
  constructor(private readonly supa: SupabaseService) {}

  async crearPlan(u: Usuario, alumnoId: string, dto: z.output<typeof altaPlanApi>) {
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    const { count, error: e1 } = await db
      .from("planes")
      .select("id", { count: "exact", head: true })
      .eq("alumno_id", alumnoId);
    lanzarSiError(e1);
    if ((count ?? 0) >= MAX_PLANES_POR_ALUMNO) {
      throw reglaDeNegocio("limite_planes", `Un alumno puede tener hasta ${MAX_PLANES_POR_ALUMNO} planes.`);
    }
    const { error } = await db
      .from("planes")
      .insert({ id: dto.id, alumno_id: alumnoId, nombre: dto.nombre, orden: count ?? 0 });
    lanzarSiError(error);
    return RESPUESTA_ID(dto.id);
  }

  async parchearPlan(u: Usuario, id: string, body: unknown) {
    const dto = validarOLanzar(parchePlanApi, body) as Record<string, unknown>;
    await actualizarUno(this.supa.delUsuario(u.token), "planes", "id", id, columnasPlan(dto), "El plan");
    return RESPUESTA_ID(id);
  }

  async eliminarPlan(u: Usuario, id: string) {
    await borrarUno(this.supa.delUsuario(u.token), "planes", id, "El plan");
  }

  async crearEjercicio(u: Usuario, planId: string, dto: z.output<typeof altaEjercicioApi>) {
    const db = this.supa.delUsuario(u.token);
    const { data: plan, error: e0 } = await db.from("planes").select("id").eq("id", planId).maybeSingle();
    lanzarSiError(e0);
    if (!plan) throw noEncontrado("El plan");

    const { data: ultimo, error: e1 } = await db
      .from("plan_ejercicios")
      .select("orden")
      .eq("plan_id", planId)
      .order("orden", { ascending: false })
      .limit(1);
    lanzarSiError(e1);
    const { count, error: e2 } = await db
      .from("plan_ejercicios")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);
    lanzarSiError(e2);
    if ((count ?? 0) >= MAX_EJERCICIOS_POR_PLAN) {
      throw reglaDeNegocio("limite_ejercicios", `Un plan puede tener hasta ${MAX_EJERCICIOS_POR_PLAN} ejercicios.`);
    }

    const { error } = await db.from("plan_ejercicios").insert({
      id: dto.id,
      plan_id: planId,
      orden: (ultimo?.[0]?.orden ?? -1) + 1,
      nombre: dto.nombre,
      series: dto.series,
      repeticiones: dto.repeticiones,
      peso: dto.peso ?? null,
      peso_fecha: dto.pesoFecha ?? null,
    });
    lanzarSiError(error);
    return RESPUESTA_ID(dto.id);
  }

  async parchearEjercicio(u: Usuario, id: string, body: unknown) {
    const dto = parchePorRol(u, body, {
      profe: parcheEjercicioProfeApi,
      alumno: parcheEjercicioAlumnoApi,
      camposAlumno: CAMPOS_EJERCICIO_EDITABLES_POR_ALUMNO,
    }) as Record<string, unknown>;
    await actualizarUno(
      this.supa.delUsuario(u.token),
      "plan_ejercicios",
      "id",
      id,
      columnasEjercicio(dto),
      "El ejercicio",
    );
    return RESPUESTA_ID(id);
  }

  async eliminarEjercicio(u: Usuario, id: string) {
    await borrarUno(this.supa.delUsuario(u.token), "plan_ejercicios", id, "El ejercicio");
  }
}

const idParam = () => new ZodPipe(uuidSchema);

@Controller()
export class PlanesController {
  constructor(private readonly planes: PlanesService) {}

  @Roles("coach")
  @Post("alumnos/:id/planes")
  crearPlan(
    @UsuarioActual() u: Usuario,
    @Param("id", idParam()) id: string,
    @Body(new ZodPipe(altaPlanApi)) dto: z.output<typeof altaPlanApi>,
  ) {
    return this.planes.crearPlan(u, id, dto);
  }

  @Roles("coach")
  @Patch("planes/:id")
  parchearPlan(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.planes.parchearPlan(u, id, body);
  }

  @Roles("coach")
  @Delete("planes/:id")
  @HttpCode(204)
  eliminarPlan(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.planes.eliminarPlan(u, id);
  }

  @Roles("coach")
  @Post("planes/:id/ejercicios")
  crearEjercicio(
    @UsuarioActual() u: Usuario,
    @Param("id", idParam()) id: string,
    @Body(new ZodPipe(altaEjercicioApi)) dto: z.output<typeof altaEjercicioApi>,
  ) {
    return this.planes.crearEjercicio(u, id, dto);
  }

  @Patch("ejercicios/:id")
  parchearEjercicio(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.planes.parchearEjercicio(u, id, body);
  }

  @Roles("coach")
  @Delete("ejercicios/:id")
  @HttpCode(204)
  eliminarEjercicio(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.planes.eliminarEjercicio(u, id);
  }
}

@Module({ controllers: [PlanesController], providers: [PlanesService] })
export class PlanesModule {}
