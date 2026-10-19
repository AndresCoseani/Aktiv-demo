import { Controller, Get, Injectable, Module } from "@nestjs/common";
import { datosApiSchema, type DatosApi } from "@aktiv/contrato";
import { UsuarioActual } from "../common/bd";
import { lanzarSiError } from "../common/errores";
import type { Usuario } from "../common/tipos";
import { SupabaseService } from "../supabase/supabase.service";
import { TABLAS_DATOS, desdeFilas, type FilasCrudas } from "./mapeo";

@Injectable()
export class DatosService {
  constructor(private readonly supa: SupabaseService) {}

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
