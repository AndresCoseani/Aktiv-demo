import { Controller, Get, Injectable, Module } from "@nestjs/common";
import { datosApiSchema, type Alumno, type DatosApi } from "@aktiv/contrato";
import { UsuarioActual } from "../common/bd";
import { lanzarSiError } from "../common/errores";
import type { Usuario } from "../common/tipos";
import { SupabaseService } from "../supabase/supabase.service";
import { TABLAS_DATOS, desdeFilas, type FilasCrudas } from "./mapeo";

type FilaInvitacion = {
  alumno_id: string;
  creada_en: string;
  expira_en: string;
  usada_en: string | null;
  invalidada_en: string | null;
};

@Injectable()
export class DatosService {
  constructor(private readonly supa: SupabaseService) {}

  /**
   * Estado del acceso de cada alumno a partir de sus invitaciones. El profe puede
   * leer el ESTADO (no el hash del enlace): lo garantiza la base con permisos por columna.
   */
  private async conAcceso(db: ReturnType<SupabaseService["delUsuario"]>, alumnos: Alumno[]): Promise<Alumno[]> {
    const { data, error } = await db
      .from("invitaciones")
      .select("alumno_id, creada_en, expira_en, usada_en, invalidada_en")
      .order("creada_en", { ascending: false });
    lanzarSiError(error);
    const porAlumno = new Map<string, FilaInvitacion[]>();
    for (const f of (data ?? []) as FilaInvitacion[]) {
      porAlumno.set(f.alumno_id, [...(porAlumno.get(f.alumno_id) ?? []), f]);
    }

    return alumnos.map((a) => {
      if (!a.userId) return { ...a, acceso: { estado: "sin_cuenta" as const, expiraEn: null } };
      const invs = porAlumno.get(a.id) ?? [];
      // sin invitaciones (cuenta creada por script) o con alguna ya usada: el alumno ya puede entrar
      if (invs.length === 0 || invs.some((i) => i.usada_en)) {
        return { ...a, acceso: { estado: "activo" as const, expiraEn: null } };
      }
      const pendiente = invs.find((i) => !i.invalidada_en);
      if (pendiente && new Date(pendiente.expira_en).getTime() > Date.now()) {
        return { ...a, acceso: { estado: "invitado" as const, expiraEn: pendiente.expira_en } };
      }
      return { ...a, acceso: { estado: "invitacion_vencida" as const, expiraEn: pendiente?.expira_en ?? null } };
    });
  }

  /**
   * Todo lo que este usuario puede ver. Las consultas corren como el usuario,
   * así que la base ya filtra por profe/alumno (RLS); acá no se filtra nada a mano.
   */
  async cargar(u: Usuario): Promise<DatosApi> {
    const db = this.supa.delUsuario(u.token);
    const respuestas = await Promise.all(TABLAS_DATOS.map((t) => db.from(t).select("*")));
    const crudas = {} as FilasCrudas;
    respuestas.forEach((r, i) => {
      lanzarSiError(r.error);
      crudas[TABLAS_DATOS[i]] = r.data ?? [];
    });
    const datos = desdeFilas(crudas, u.id);
    if (u.rol === "coach") datos.alumnos = await this.conAcceso(db, datos.alumnos);
    const respuesta = {
      session: {
        username: u.email,
        role: u.rol,
        nombre: u.nombre,
        userId: u.id,
        ...(datos.alumnoIdPropio ? { alumnoId: datos.alumnoIdPropio } : {}),
      },
      alumnos: datos.alumnos,
      carreras: datos.carreras,
      inscripciones: datos.inscripciones,
      ejerciciosCustom: datos.ejerciciosCustom,
    };
    // lo que sale de la API también cumple el contrato
    return datosApiSchema.parse(respuesta);
  }
}

@Controller("datos")
export class DatosController {
  constructor(private readonly datos: DatosService) {}

  @Get()
  cargar(@UsuarioActual() u: Usuario) {
    return this.datos.cargar(u);
  }
}

@Module({ controllers: [DatosController], providers: [DatosService] })
export class DatosModule {}
