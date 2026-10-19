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
  altaCarreraApi,
  altaEjercicioCustomApi,
  parcheEjercicioCustomApi,
  altaInscripcionApi,
  parcheCarreraApi,
  parcheInscripcionProfeApi,
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
import { ErrorApi, lanzarSiError, reglaDeNegocio } from "../common/errores";
import type { Usuario } from "../common/tipos";
import { ZodPipe, validarOLanzar } from "../common/zod.pipe";
import { columnasCarrera, columnasInscripcion } from "../datos/mapeo";
import { SupabaseService } from "../supabase/supabase.service";

const mismaDistancia = (a: number, b: number) => Math.abs(a - b) < 0.001;

@Injectable()
export class CarrerasService {
  constructor(private readonly supa: SupabaseService) {}

  /* ───────────── calendario del profe ───────────── */

  async crear(u: Usuario, dto: z.output<typeof altaCarreraApi>) {
    const { error } = await this.supa.delUsuario(u.token).from("carreras").insert({
      id: dto.id,
      coach_id: u.id,
      nombre: dto.nombre,
      fecha: dto.fecha,
      lugar: dto.lugar,
      distancias_km: dto.distanciasKm,
      notas: dto.notas,
    });
    lanzarSiError(error);
    return RESPUESTA_ID(dto.id);
  }

  async parchear(u: Usuario, id: string, body: unknown) {
    const dto = validarOLanzar(parcheCarreraApi, body);
    if (Object.keys(dto).length === 0) throw new ErrorApi(400, "sin_cambios", "No hay cambios para guardar.");
    const db = this.supa.delUsuario(u.token);

    // no se puede sacar una distancia que ya eligió algún alumno
    if (dto.distanciasKm) {
      const { data, error } = await db.from("inscripciones").select("distancia_km").eq("carrera_id", id);
      lanzarSiError(error);
      const nuevas = dto.distanciasKm;
      const enUso = (data ?? [])
        .map((r) => Number(r.distancia_km))
        .filter((km) => !nuevas.some((k) => mismaDistancia(k, km)));
      if (enUso.length) {
        throw reglaDeNegocio(
          "distancia_en_uso",
          "Hay alumnos anotados en una distancia que querés sacar. Sacalos de esa distancia primero.",
        );
      }
    }
    await actualizarUno(db, "carreras", "id", id, columnasCarrera(dto as Record<string, unknown>), "La carrera");
    return RESPUESTA_ID(id);
  }

  async eliminar(u: Usuario, id: string) {
    await borrarUno(this.supa.delUsuario(u.token), "carreras", id, "La carrera");
  }

  /* ───────────── inscripciones ───────────── */

  async inscribir(u: Usuario, alumnoId: string, dto: z.output<typeof altaInscripcionApi>) {
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    // la base además valida que alumno y carrera sean del mismo profe y que la distancia exista
    const { error } = await db.from("inscripciones").insert({
      id: dto.id,
      alumno_id: alumnoId,
      carrera_id: dto.carreraId,
      distancia_km: dto.distanciaKm,
      objetivo_seg: dto.objetivoSeg,
    });
    lanzarSiError(error);
    return RESPUESTA_ID(dto.id);
  }

  async parchearInscripcion(u: Usuario, id: string, body: unknown) {
    // el profe y el alumno dueño pueden lo mismo; la base impone que no se mueva a otro alumno o carrera
    const dto = validarOLanzar(parcheInscripcionProfeApi, body) as Record<string, unknown>;
    await actualizarUno(
      this.supa.delUsuario(u.token),
      "inscripciones",
      "id",
      id,
      columnasInscripcion(dto),
      "La inscripción",
    );
    return RESPUESTA_ID(id);
  }

  async quitarInscripcion(u: Usuario, id: string) {
    await borrarUno(this.supa.delUsuario(u.token), "inscripciones", id, "La inscripción");
  }

  /* ───────────── catálogo de ejercicios del profe ───────────── */

  async crearEjercicioCustom(u: Usuario, dto: z.output<typeof altaEjercicioCustomApi>) {
    const { error } = await this.supa
      .delUsuario(u.token)
      .from("ejercicios_custom")
      .insert({ id: dto.id, coach_id: u.id, nombre: dto.nombre, categoria: dto.categoria });
    lanzarSiError(error);
    return RESPUESTA_ID(dto.id);
  }

  async parchearEjercicioCustom(u: Usuario, id: string, dto: z.output<typeof parcheEjercicioCustomApi>) {
    if (Object.keys(dto).length === 0) throw new ErrorApi(400, "sin_cambios", "No hay cambios para guardar.");
    await actualizarUno(this.supa.delUsuario(u.token), "ejercicios_custom", "id", id, dto, "El ejercicio");
    return RESPUESTA_ID(id);
  }

  async eliminarEjercicioCustom(u: Usuario, id: string) {
    await borrarUno(this.supa.delUsuario(u.token), "ejercicios_custom", id, "El ejercicio");
  }
}

const idParam = () => new ZodPipe(uuidSchema);

@Controller()
export class CarrerasController {
  constructor(private readonly carreras: CarrerasService) {}

  @Roles("coach")
  @Post("carreras")
  crear(@UsuarioActual() u: Usuario, @Body(new ZodPipe(altaCarreraApi)) dto: z.output<typeof altaCarreraApi>) {
    return this.carreras.crear(u, dto);
  }

  @Roles("coach")
  @Patch("carreras/:id")
  parchear(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.carreras.parchear(u, id, body);
  }

  @Roles("coach")
  @Delete("carreras/:id")
  @HttpCode(204)
  eliminar(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.carreras.eliminar(u, id);
  }

  @Post("alumnos/:id/inscripciones")
  inscribir(
    @UsuarioActual() u: Usuario,
    @Param("id", idParam()) id: string,
    @Body(new ZodPipe(altaInscripcionApi)) dto: z.output<typeof altaInscripcionApi>,
  ) {
    return this.carreras.inscribir(u, id, dto);
  }

  @Patch("inscripciones/:id")
  parchearInscripcion(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.carreras.parchearInscripcion(u, id, body);
  }

  @Delete("inscripciones/:id")
  @HttpCode(204)
  quitarInscripcion(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.carreras.quitarInscripcion(u, id);
  }

  @Roles("coach")
  @Post("catalogo/ejercicios")
  crearEjercicioCustom(
    @UsuarioActual() u: Usuario,
    @Body(new ZodPipe(altaEjercicioCustomApi)) dto: z.output<typeof altaEjercicioCustomApi>,
  ) {
    return this.carreras.crearEjercicioCustom(u, dto);
  }

  @Roles("coach")
  @Patch("catalogo/ejercicios/:id")
  parchearEjercicioCustom(
    @UsuarioActual() u: Usuario,
    @Param("id", idParam()) id: string,
    @Body(new ZodPipe(parcheEjercicioCustomApi)) dto: z.output<typeof parcheEjercicioCustomApi>,
  ) {
    return this.carreras.parchearEjercicioCustom(u, id, dto);
  }

  @Roles("coach")
  @Delete("catalogo/ejercicios/:id")
  @HttpCode(204)
  eliminarEjercicioCustom(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.carreras.eliminarEjercicioCustom(u, id);
  }
}

@Module({ controllers: [CarrerasController], providers: [CarrerasService] })
export class CarrerasModule {}
