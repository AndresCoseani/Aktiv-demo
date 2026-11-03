import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import {
  altaMensualApi, altaSesionApi, altaEjercicioMensualApi, parcheMensualApi,
  parcheSesionApi, parcheEjercicioMensualApi, parcheCeldaAlumnoApi, parcheCeldaProfeApi,
  planesMensualesRespuesta, uuidSchema,
  MAX_SEMANAS_PLAN,
} from "@aktiv/contrato";
import { Roles } from "../auth/guards";
import { UsuarioActual, asegurarAlumno, actualizarUno, borrarUno, parchePorRol } from "../common/bd";
import { lanzarSiError, noEncontrado, reglaDeNegocio } from "../common/errores";
import type { Usuario } from "../common/tipos";
import { ZodPipe, validarOLanzar } from "../common/zod.pipe";
import { SupabaseService } from "../supabase/supabase.service";

const id = () => new ZodPipe(uuidSchema);
const numeroSemana = () => new ZodPipe(z.coerce.number().int().min(1).max(MAX_SEMANAS_PLAN));
type Db = ReturnType<SupabaseService["delUsuario"]>;
const TABLAS = { plan: "planes_mensuales", sesion: "sesiones", ejercicio: "sesion_ejercicios" } as const;
type Recurso = keyof typeof TABLAS;

@Injectable()
export class MensualesService {
  constructor(private readonly supa: SupabaseService) {}

  private async existe(db: Db, tabla: string, recursoId: string) {
    const r = await db.from(tabla).select("*").eq("id", recursoId).maybeSingle();
    lanzarSiError(r.error);
    if (!r.data) throw noEncontrado();
    return r.data;
  }

  /** Lecturas paginadas: las semanas multiplican rápidamente las filas. */
  private async filas(db: Db, tabla: string, columna: string, ids: string[]) {
    const filas: Record<string, unknown>[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      for (let desde = 0; ; desde += 500) {
        let q = db.from(tabla).select("*").in(columna, ids.slice(i, i + 100));
        q = tabla === "ejercicio_semanas" ? q.order("ejercicio_id").order("semana") : q.order("id");
        const r = await q.range(desde, desde + 499);
        lanzarSiError(r.error);
        filas.push(...(r.data ?? []));
        if ((r.data?.length ?? 0) < 500) break;
      }
    }
    return filas;
  }

  async cargar(u: Usuario, alumnoId: string) {
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    const planes = await this.filas(db, "planes_mensuales", "alumno_id", [alumnoId]);
    const sesiones = await this.filas(db, "sesiones", "plan_id", planes.map((p) => String(p.id)));
    const ejercicios = await this.filas(db, "sesion_ejercicios", "sesion_id", sesiones.map((s) => String(s.id)));
    const semanas = await this.filas(db, "ejercicio_semanas", "ejercicio_id", ejercicios.map((e) => String(e.id)));
    const porOrden = (a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.orden) - Number(b.orden) || String(a.id).localeCompare(String(b.id));
    return planesMensualesRespuesta.parse(planes.sort(porOrden).map((p) => ({
      ...p,
      sesiones: sesiones.filter((s) => s.plan_id === p.id).sort(porOrden).map((s) => ({
        ...s,
        ejercicios: ejercicios.filter((e) => e.sesion_id === s.id).sort(porOrden).map((e) => ({
          ...e,
          semanas: semanas.filter((c) => c.ejercicio_id === e.id).map((c) => ({
            semana: c.semana, prescripcion: c.prescripcion, peso: c.peso, pesoFecha: c.peso_fecha,
          })),
        })),
      })),
    })));
  }

  async crear(u: Usuario, recurso: Recurso, padreId: string, body: unknown) {
    const db = this.supa.delUsuario(u.token);
    const tabla = TABLAS[recurso];
    const columna = recurso === "plan" ? "alumno_id" : recurso === "sesion" ? "plan_id" : "sesion_id";
    const dto = validarOLanzar(
      recurso === "plan" ? altaMensualApi : recurso === "sesion" ? altaSesionApi : altaEjercicioMensualApi, body,
    );
    if (recurso === "plan") await asegurarAlumno(db, padreId);
    else await this.existe(db, recurso === "sesion" ? TABLAS.plan : TABLAS.sesion, padreId);
    const conteo = await db.from(tabla).select("id", { count: "exact", head: true }).eq(columna, padreId);
    lanzarSiError(conteo.error);
    const max = recurso === "plan" ? 50 : recurso === "sesion" ? 28 : 100;
    if ((conteo.count ?? 0) >= max) throw reglaDeNegocio("limite_mensual", `Se alcanzó el máximo de ${max} elementos.`);
    const ultimo = await db.from(tabla).select("orden").eq(columna, padreId).order("orden", { ascending: false }).limit(1);
    lanzarSiError(ultimo.error);
    const orden = (ultimo.data?.[0]?.orden ?? -1) + 1;
    const { diasIniciales, ...campos } = dto as typeof dto & { diasIniciales?: { fuerza: number; running: number } };
    const r = recurso === "plan" && diasIniciales
      ? await db.rpc("crear_plan_con_dias", { p_plan: { ...campos, alumno_id: padreId, orden }, p_fuerza: diasIniciales.fuerza, p_running: diasIniciales.running })
      : await db.from(tabla).insert({ ...campos, [columna]: padreId, orden });
    lanzarSiError(r.error);
    return { id: dto.id };
  }

  async parchear(u: Usuario, recurso: Recurso, recursoId: string, body: unknown) {
    const dto = validarOLanzar(recurso === "plan" ? parcheMensualApi : recurso === "sesion" ? parcheSesionApi : parcheEjercicioMensualApi, body);
    await actualizarUno(this.supa.delUsuario(u.token), TABLAS[recurso], "id", recursoId, dto, "El recurso");
    return { id: recursoId };
  }

  async eliminar(u: Usuario, recurso: Recurso, recursoId: string) {
    await borrarUno(this.supa.delUsuario(u.token), TABLAS[recurso], recursoId, "El recurso");
  }

  async celda(u: Usuario, ejercicioId: string, semana: number, body: unknown) {
    const dto = parchePorRol(u, body, {
      profe: parcheCeldaProfeApi, alumno: parcheCeldaAlumnoApi, camposAlumno: ["peso", "pesoFecha"],
    });
    const { pesoFecha, ...resto } = dto;
    const r = await this.supa.delUsuario(u.token).from("ejercicio_semanas")
      .update({ ...resto, ...(pesoFecha !== undefined ? { peso_fecha: pesoFecha } : {}) })
      .eq("ejercicio_id", ejercicioId).eq("semana", semana).select("ejercicio_id");
    lanzarSiError(r.error);
    if (!r.data?.length) throw noEncontrado("La semana del ejercicio");
    return { id: ejercicioId };
  }
}

@Controller()
export class MensualesController {
  constructor(private readonly servicio: MensualesService) {}
  @Get("alumnos/:id/planes-mensuales")
  cargar(@UsuarioActual() u: Usuario, @Param("id", id()) alumno: string) { return this.servicio.cargar(u, alumno); }
  @Roles("coach") @Post("alumnos/:id/planes-mensuales")
  plan(@UsuarioActual() u: Usuario, @Param("id", id()) padre: string, @Body() body: unknown) { return this.servicio.crear(u, "plan", padre, body); }
  @Roles("coach") @Patch("planes-mensuales/:id")
  parchePlan(@UsuarioActual() u: Usuario, @Param("id", id()) recurso: string, @Body() body: unknown) { return this.servicio.parchear(u, "plan", recurso, body); }
  @Roles("coach") @Delete("planes-mensuales/:id") @HttpCode(204)
  borrarPlan(@UsuarioActual() u: Usuario, @Param("id", id()) recurso: string) { return this.servicio.eliminar(u, "plan", recurso); }
  @Roles("coach") @Post("planes-mensuales/:id/sesiones")
  sesion(@UsuarioActual() u: Usuario, @Param("id", id()) padre: string, @Body() body: unknown) { return this.servicio.crear(u, "sesion", padre, body); }
  @Roles("coach") @Patch("sesiones/:id")
  parcheSesion(@UsuarioActual() u: Usuario, @Param("id", id()) recurso: string, @Body() body: unknown) { return this.servicio.parchear(u, "sesion", recurso, body); }
  @Roles("coach") @Delete("sesiones/:id") @HttpCode(204)
  borrarSesion(@UsuarioActual() u: Usuario, @Param("id", id()) recurso: string) { return this.servicio.eliminar(u, "sesion", recurso); }
  @Roles("coach") @Post("sesiones/:id/ejercicios")
  ejercicio(@UsuarioActual() u: Usuario, @Param("id", id()) padre: string, @Body() body: unknown) { return this.servicio.crear(u, "ejercicio", padre, body); }
  @Roles("coach") @Patch("sesion-ejercicios/:id")
  parcheEjercicio(@UsuarioActual() u: Usuario, @Param("id", id()) recurso: string, @Body() body: unknown) { return this.servicio.parchear(u, "ejercicio", recurso, body); }
  @Roles("coach") @Delete("sesion-ejercicios/:id") @HttpCode(204)
  borrarEjercicio(@UsuarioActual() u: Usuario, @Param("id", id()) recurso: string) { return this.servicio.eliminar(u, "ejercicio", recurso); }
  @Patch("sesion-ejercicios/:id/semanas/:semana")
  celda(@UsuarioActual() u: Usuario, @Param("id", id()) recurso: string, @Param("semana", numeroSemana()) semana: number, @Body() body: unknown) { return this.servicio.celda(u, recurso, semana, body); }
}

@Module({ controllers: [MensualesController], providers: [MensualesService] })
export class MensualesModule {}
