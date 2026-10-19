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
  CAMPOS_ALUMNO_EDITABLES_POR_ALUMNO,
  altaAlumnoApi,
  altaLesionApi,
  altaMarcaApi,
  parcheAlumnoAlumnoApi,
  parcheAlumnoProfeApi,
  parcheFichaApi,
  parcheLesionApi,
  parcheMarcaApi,
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
import {
  columnasAlumno,
  columnasFicha,
  columnasLesion,
  columnasMarca,
} from "../datos/mapeo";
import { BUCKET_CERTIFICADOS, SupabaseService } from "../supabase/supabase.service";

/** Un parche sin ninguna clave no hace nada: se avisa en vez de ignorarlo en silencio */
function noVacio<T extends object>(parche: T): T {
  if (Object.keys(parche).length === 0) {
    throw new ErrorApi(400, "sin_cambios", "No hay cambios para guardar.");
  }
  return parche;
}

@Injectable()
export class AlumnosService {
  constructor(private readonly supa: SupabaseService) {}

  /* ───────────── alumnos ───────────── */

  async crear(u: Usuario, dto: z.output<typeof altaAlumnoApi>) {
    const db = this.supa.delUsuario(u.token);
    // el profe dueño sale del token, nunca del cuerpo del pedido
    const { error } = await db.from("alumnos").insert({
      id: dto.id,
      coach_id: u.id,
      nombre: dto.nombre,
      email: dto.email,
      telefono: dto.telefono,
      objetivo: dto.objetivo,
      nivel: dto.nivel,
    });
    lanzarSiError(error);
    return RESPUESTA_ID(dto.id);
  }

  async parchear(u: Usuario, id: string, body: unknown) {
    const dto = parchePorRol(u, body, {
      profe: parcheAlumnoProfeApi,
      alumno: parcheAlumnoAlumnoApi,
      camposAlumno: CAMPOS_ALUMNO_EDITABLES_POR_ALUMNO,
    }) as Record<string, unknown>;
    const db = this.supa.delUsuario(u.token);

    // el plan activo tiene que ser un plan de este mismo alumno (la base no tiene FK a propósito)
    if (typeof dto.planActivoId === "string") {
      const { data, error } = await db
        .from("planes")
        .select("id")
        .eq("id", dto.planActivoId)
        .eq("alumno_id", id)
        .maybeSingle();
      lanzarSiError(error);
      if (!data) throw reglaDeNegocio("plan_invalido", "El plan activo tiene que ser un plan de este alumno.");
    }
    await actualizarUno(db, "alumnos", "id", id, columnasAlumno(dto), "El alumno");
    return RESPUESTA_ID(id);
  }

  async eliminar(u: Usuario, id: string) {
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, id);
    // los archivos se borran ANTES: una vez borrada la fila la base ya no autoriza esa carpeta
    const { data: archivos } = await db.storage.from(BUCKET_CERTIFICADOS).list(id);
    if (archivos?.length) {
      await db.storage.from(BUCKET_CERTIFICADOS).remove(archivos.map((a) => `${id}/${a.name}`));
    }
    await borrarUno(db, "alumnos", id, "El alumno");
  }

  /* ───────────── ficha médica ───────────── */

  async parchearFicha(u: Usuario, alumnoId: string, body: unknown) {
    const dto = noVacio(validarOLanzar(parcheFichaApi, body)) as Record<string, unknown>;
    const db = this.supa.delUsuario(u.token);
    await actualizarUno(db, "fichas_medicas", "alumno_id", alumnoId, columnasFicha(dto), "La ficha");
    return RESPUESTA_ID(alumnoId);
  }

  /* ───────────── lesiones ───────────── */

  async crearLesion(u: Usuario, alumnoId: string, dto: z.output<typeof altaLesionApi>) {
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    const { error } = await db.from("lesiones").insert({
      id: dto.id,
      alumno_id: alumnoId,
      descripcion: dto.descripcion,
      fecha: dto.fecha,
      estado: dto.estado,
    });
    lanzarSiError(error);
    return RESPUESTA_ID(dto.id);
  }

  async parchearLesion(u: Usuario, id: string, body: unknown) {
    const dto = noVacio(validarOLanzar(parcheLesionApi, body)) as Record<string, unknown>;
    await actualizarUno(this.supa.delUsuario(u.token), "lesiones", "id", id, columnasLesion(dto), "La lesión");
    return RESPUESTA_ID(id);
  }

  async eliminarLesion(u: Usuario, id: string) {
    await borrarUno(this.supa.delUsuario(u.token), "lesiones", id, "La lesión");
  }

  /* ───────────── marcas ───────────── */

  async crearMarca(u: Usuario, alumnoId: string, dto: z.output<typeof altaMarcaApi>) {
    const db = this.supa.delUsuario(u.token);
    await asegurarAlumno(db, alumnoId);
    const { error } = await db.from("marcas").insert({
      id: dto.id,
      alumno_id: alumnoId,
      distancia_km: dto.distanciaKm,
      tiempo_seg: dto.tiempoSeg,
      fecha: dto.fecha,
      carrera: dto.carrera,
    });
    lanzarSiError(error);
    return RESPUESTA_ID(dto.id);
  }

  async parchearMarca(u: Usuario, id: string, body: unknown) {
    const dto = noVacio(validarOLanzar(parcheMarcaApi, body)) as Record<string, unknown>;
    await actualizarUno(this.supa.delUsuario(u.token), "marcas", "id", id, columnasMarca(dto), "La marca");
    return RESPUESTA_ID(id);
  }

  async eliminarMarca(u: Usuario, id: string) {
    await borrarUno(this.supa.delUsuario(u.token), "marcas", id, "La marca");
  }
}

const idParam = () => new ZodPipe(uuidSchema);

@Controller()
export class AlumnosController {
  constructor(private readonly alumnos: AlumnosService) {}

  // ---- alumnos
  @Roles("coach")
  @Post("alumnos")
  crear(@UsuarioActual() u: Usuario, @Body(new ZodPipe(altaAlumnoApi)) dto: z.output<typeof altaAlumnoApi>) {
    return this.alumnos.crear(u, dto);
  }

  @Patch("alumnos/:id")
  parchear(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.alumnos.parchear(u, id, body);
  }

  @Roles("coach")
  @Delete("alumnos/:id")
  @HttpCode(204)
  eliminar(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.alumnos.eliminar(u, id);
  }

  // ---- ficha
  @Patch("alumnos/:id/ficha")
  parchearFicha(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.alumnos.parchearFicha(u, id, body);
  }

  // ---- lesiones
  @Post("alumnos/:id/lesiones")
  crearLesion(
    @UsuarioActual() u: Usuario,
    @Param("id", idParam()) id: string,
    @Body(new ZodPipe(altaLesionApi)) dto: z.output<typeof altaLesionApi>,
  ) {
    return this.alumnos.crearLesion(u, id, dto);
  }

  @Patch("lesiones/:id")
  parchearLesion(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.alumnos.parchearLesion(u, id, body);
  }

  @Delete("lesiones/:id")
  @HttpCode(204)
  eliminarLesion(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.alumnos.eliminarLesion(u, id);
  }

  // ---- marcas
  @Post("alumnos/:id/marcas")
  crearMarca(
    @UsuarioActual() u: Usuario,
    @Param("id", idParam()) id: string,
    @Body(new ZodPipe(altaMarcaApi)) dto: z.output<typeof altaMarcaApi>,
  ) {
    return this.alumnos.crearMarca(u, id, dto);
  }

  @Patch("marcas/:id")
  parchearMarca(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string, @Body() body: unknown) {
    return this.alumnos.parchearMarca(u, id, body);
  }

  @Delete("marcas/:id")
  @HttpCode(204)
  eliminarMarca(@UsuarioActual() u: Usuario, @Param("id", idParam()) id: string) {
    return this.alumnos.eliminarMarca(u, id);
  }
}

@Module({ controllers: [AlumnosController], providers: [AlumnosService], exports: [AlumnosService] })
export class AlumnosModule {}
