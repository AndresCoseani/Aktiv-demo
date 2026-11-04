import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { agendaRespuestaSchema, altaHorarioApi, cambioHorarioApi, confirmarAsistenciaApi, consultaAgendaApi, desplazarFecha, diaSemanal, fechaArgentina, parcheHorarioApi, referenciaClaseApi, uuidSchema } from "@aktiv/contrato";
import { Roles } from "../auth/guards";
import { UsuarioActual, actualizarUno } from "../common/bd";
import { existe, lanzarSiError, reglaDeNegocio } from "../common/errores";
import type { Usuario } from "../common/tipos";
import { ZodPipe, validarOLanzar } from "../common/zod.pipe";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class AgendaService {
  constructor(private readonly supa: SupabaseService) {}

  private async contexto(u: Usuario) {
    const db = this.supa.delUsuario(u.token);
    if (u.rol === "coach") return { db, coachId: u.id, alumnoId: null };
    const r = await db.from("alumnos").select("id, coach_id").eq("user_id", u.id).maybeSingle();
    lanzarSiError(r.error);
    const alumno = existe(r.data, "El alumno");
    return { db, coachId: String(alumno.coach_id), alumnoId: String(alumno.id) };
  }

  async cargar(u: Usuario, desde: string, hasta: string) {
    const { db, coachId, alumnoId } = await this.contexto(u);
    const horarios: Record<string, unknown>[] = [];
    for (let n = 0; ; n += 500) {
      const r = await db.from("horarios_clase").select("*").eq("coach_id", coachId).order("id").range(n, n + 499);
      lanzarSiError(r.error); horarios.push(...(r.data ?? []));
      if ((r.data?.length ?? 0) < 500) break;
    }
    const canceladas: Record<string, unknown>[] = [];
    const confirmadas: Record<string, unknown>[] = [];
    const cambios: Record<string, unknown>[] = [];
    // Consulta por lotes para no truncar respuestas ni formar URLs enormes.
    for (let i = 0; i < horarios.length; i += 100) {
      const ids = horarios.slice(i, i + 100).map((h) => String(h.id));
      for (let n = 0; ; n += 500) {
        const r = await db.from("cambios_horario_clase").select("*").in("horario_id", ids).lte("fecha", hasta)
          .order("horario_id").order("fecha").order("alcance").range(n, n + 499);
        lanzarSiError(r.error); cambios.push(...(r.data ?? []));
        if ((r.data?.length ?? 0) < 500) break;
      }
      for (const tabla of ["clases_canceladas", "confirmaciones_clase"] as const) {
        for (let n = 0; ; n += 500) {
          const r = await db.from(tabla).select(tabla === "confirmaciones_clase" && u.rol === "coach" ? "*, alumnos(nombre)" : "*")
            .in("horario_id", ids).gte("fecha", desde).lte("fecha", hasta).order("horario_id").order("fecha")
            .order(tabla === "confirmaciones_clase" ? "alumno_id" : "horario_id").range(n, n + 499);
          lanzarSiError(r.error);
          (tabla === "clases_canceladas" ? canceladas : confirmadas).push(...((r.data ?? []) as unknown as Record<string, unknown>[]));
          if ((r.data?.length ?? 0) < 500) break;
        }
      }
    }
    const clases = [];
    for (let fecha = desde; fecha <= hasta; fecha = desplazarFecha(fecha, 1)) {
      for (const h of horarios.filter((h) => h.activo && h.dia === diaSemanal(fecha) && (!h.desde || String(h.desde) <= fecha))) {
        const delHorario = cambios.filter((c) => c.horario_id === h.id);
        const puntual = delHorario.find((c) => c.alcance === "solo_fecha" && c.fecha === fecha);
        const habitual = delHorario.filter((c) => c.alcance === "habitual" && String(c.fecha) <= fecha).sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
        const vigente = puntual ?? habitual ?? h;
        const confirmaciones = confirmadas.filter((c) => c.horario_id === h.id && c.fecha === fecha);
        clases.push({ horarioId: h.id, fecha, titulo: vigente.titulo, hora: vigente.hora, fin: vigente.fin, lugar: vigente.lugar, personalizada: Boolean(puntual),
          cancelada: canceladas.some((c) => c.horario_id === h.id && c.fecha === fecha),
          asistire: confirmaciones.some((c) => c.alumno_id === alumnoId),
          horaLlegada: confirmaciones.find((c) => c.alumno_id === alumnoId)?.hora_llegada ?? null,
          confirmados: u.rol === "coach" ? confirmaciones.map((c) => ({ alumnoId: c.alumno_id, nombre: (c.alumnos as { nombre: string } | null)?.nombre ?? "Alumno", horaLlegada: c.hora_llegada ?? null })).sort((a,b) => String(a.horaLlegada ?? "99:99").localeCompare(String(b.horaLlegada ?? "99:99")) || a.nombre.localeCompare(b.nombre)) : [],
        });
      }
    }
    clases.sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora).localeCompare(String(b.hora)) || String(a.horarioId).localeCompare(String(b.horarioId)));
    const habituales = horarios.map((h) => {
      const cambio = cambios.filter((c) => c.horario_id === h.id && c.alcance === "habitual" && String(c.fecha) <= hasta)
        .sort((a,b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
      return cambio ? { ...h, titulo: cambio.titulo, hora: cambio.hora, fin: cambio.fin, lugar: cambio.lugar } : h;
    });
    return agendaRespuestaSchema.parse({ horarios: habituales, clases });
  }

  async crear(u: Usuario, dto: z.output<typeof altaHorarioApi>) {
    const desde = dto.desde ?? fechaArgentina();
    if (desde < fechaArgentina() || desde > desplazarFecha(fechaArgentina(), 60)) throw reglaDeNegocio("fecha_horario", "Elegí un inicio dentro de los próximos 60 días.");
    const { error } = await this.supa.delUsuario(u.token).from("horarios_clase").insert({ ...dto, desde, coach_id: u.id });
    lanzarSiError(error); return { id: dto.id };
  }
  async archivar(u: Usuario, id: string, activo: boolean) {
    await actualizarUno(this.supa.delUsuario(u.token), "horarios_clase", "id", id, { activo }, "El horario");
    return { id };
  }
  async editar(u: Usuario, id: string, dto: z.output<typeof cambioHorarioApi>) {
    const { error } = await this.supa.delUsuario(u.token).rpc("guardar_cambio_horario", {
      p_horario_id: id, p_fecha: dto.fecha, p_alcance: dto.alcance,
      p_titulo: dto.titulo, p_hora: dto.hora, p_fin: dto.fin, p_lugar: dto.lugar,
    });
    lanzarSiError(error); return { id };
  }
  async confirmar(u: Usuario, horarioId: string, fecha: string, cancelar: boolean, horaLlegada?: string) {
    const { db, alumnoId } = await this.contexto(u);
    if (!alumnoId) throw reglaDeNegocio("solo_alumno", "Solo el alumno puede confirmar su asistencia.");
    if (fecha < fechaArgentina() || fecha > desplazarFecha(fechaArgentina(), 60)) throw reglaDeNegocio("fecha_clase", "Elegí una clase de los próximos 60 días.");
    const r = cancelar
      ? await db.from("confirmaciones_clase").delete().eq("horario_id", horarioId).eq("fecha", fecha).eq("alumno_id", alumnoId)
      : await db.rpc("confirmar_llegada_clase", { p_horario_id: horarioId, p_fecha: fecha, p_alumno_id: alumnoId, p_hora_llegada: horaLlegada });
    lanzarSiError(r.error);
  }
  async cancelarClase(u: Usuario, horarioId: string, fecha: string, reabrir: boolean) {
    const db = this.supa.delUsuario(u.token);
    const r = reabrir ? await db.from("clases_canceladas").delete().eq("horario_id", horarioId).eq("fecha", fecha)
      : await db.from("clases_canceladas").upsert({ horario_id: horarioId, fecha }, { onConflict: "horario_id,fecha", ignoreDuplicates: true });
    lanzarSiError(r.error);
  }
}

@Controller("agenda")
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}
  @Get()
  cargar(@UsuarioActual() u: Usuario, @Query() query: unknown) {
    const { desde, hasta } = validarOLanzar(consultaAgendaApi, query);
    return this.agenda.cargar(u, desde, hasta);
  }
  @Roles("coach") @Post("horarios")
  crear(@UsuarioActual() u: Usuario, @Body(new ZodPipe(altaHorarioApi)) dto: z.output<typeof altaHorarioApi>) { return this.agenda.crear(u, dto); }
  @Roles("coach") @Patch("horarios/:id")
  archivar(@UsuarioActual() u: Usuario, @Param("id", new ZodPipe(uuidSchema)) id: string, @Body(new ZodPipe(parcheHorarioApi)) dto: z.output<typeof parcheHorarioApi>) { return this.agenda.archivar(u, id, dto.activo); }
  @Roles("coach") @Post("horarios/:id/cambios")
  editar(@UsuarioActual() u: Usuario, @Param("id", new ZodPipe(uuidSchema)) id: string, @Body(new ZodPipe(cambioHorarioApi)) dto: z.output<typeof cambioHorarioApi>) { return this.agenda.editar(u, id, dto); }
  @Roles("alumno") @Post("confirmaciones") @HttpCode(204)
  confirmar(@UsuarioActual() u: Usuario, @Body(new ZodPipe(confirmarAsistenciaApi)) dto: z.output<typeof confirmarAsistenciaApi>) { return this.agenda.confirmar(u, dto.horarioId, dto.fecha, false, dto.horaLlegada); }
  @Roles("alumno") @Delete("confirmaciones") @HttpCode(204)
  cancelar(@UsuarioActual() u: Usuario, @Body(new ZodPipe(referenciaClaseApi)) dto: z.output<typeof referenciaClaseApi>) { return this.agenda.confirmar(u, dto.horarioId, dto.fecha, true); }
  @Roles("coach") @Post("cancelaciones") @HttpCode(204)
  cancelarClase(@UsuarioActual() u: Usuario, @Body(new ZodPipe(referenciaClaseApi)) dto: z.output<typeof referenciaClaseApi>) { return this.agenda.cancelarClase(u, dto.horarioId, dto.fecha, false); }
  @Roles("coach") @Delete("cancelaciones") @HttpCode(204)
  reabrir(@UsuarioActual() u: Usuario, @Body(new ZodPipe(referenciaClaseApi)) dto: z.output<typeof referenciaClaseApi>) { return this.agenda.cancelarClase(u, dto.horarioId, dto.fecha, true); }
}
@Module({ controllers: [AgendaController], providers: [AgendaService] })
export class AgendaModule {}
