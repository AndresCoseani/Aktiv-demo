import { Inject, Injectable } from "@nestjs/common";
import { registroAlumnoApi } from "@aktiv/contrato";
import type { z } from "zod";
import { ENV, type Env } from "../config/env";
import { ErrorApi, lanzarSiError } from "../common/errores";
import { SupabaseService } from "../supabase/supabase.service";
import { SupabaseAdminService } from "../supabase/admin.service";

@Injectable()
export class RegistroService {
  constructor(private readonly supa: SupabaseService, private readonly admin: SupabaseAdminService, @Inject(ENV) private readonly env: Env) {}
  get habilitado() { return Boolean(this.env.REGISTRO_COACH_ID && this.admin.disponible); }
  private comprobar() { if (!this.habilitado) throw new ErrorApi(503, "registro_deshabilitado", "El registro todavía no está habilitado. Hablá con Lucas."); }
  async registrar(dto: z.infer<typeof registroAlumnoApi>) {
    this.comprobar();
    const { error } = await this.supa.anonimo().auth.signUp({ email: dto.email, password: dto.dni, options: {
      emailRedirectTo: `${this.env.appUrl}/confirmar-registro`,
      data: { nombre: dto.nombre, dni: dto.dni, telefono: dto.telefono, origen: "registro_aktiv" },
    } });
    if (error) {
      if (error.status === 429) throw new ErrorApi(429, "registro_limite", "Esperá unos minutos antes de solicitar otro correo.");
      if (error.code === "user_already_exists" || error.code === "email_exists") return;
      throw new ErrorApi(422, "registro_no_disponible", "No pudimos solicitar el registro. Revisá los datos o probá recuperar tu contraseña si ya tenés cuenta.");
    }
  }
  async completar(token: string) {
    this.comprobar();
    const { data, error } = await this.supa.anonimo().auth.getUser(token);
    if (error || !data.user?.email_confirmed_at || data.user.user_metadata.origen !== "registro_aktiv") throw new ErrorApi(422, "registro_invalido", "El enlace no es válido o todavía no confirmaste tu email. Probá ingresar con tu contraseña.");
    const r = await this.admin.admin().rpc("completar_registro_alumno", { p_usuario: data.user.id, p_coach: this.env.REGISTRO_COACH_ID });
    lanzarSiError(r.error);
  }
  async pendientes(token: string) {
    const filas: unknown[] = [];
    for (let desde=0;;desde+=100) {
      const r=await this.supa.delUsuario(token).from("solicitudes_alta").select("id,nombre,email,dni,telefono,creada_en").is("aprobada_en",null).order("creada_en").order("id").range(desde,desde+99);
      lanzarSiError(r.error); filas.push(...(r.data??[])); if((r.data?.length??0)<100)return filas;
    }
  }
  async aprobar(token: string,id: string) {
    const r=await this.supa.delUsuario(token).rpc("aprobar_registro_alumno",{p_solicitud:id});
    lanzarSiError(r.error); return {id:r.data};
  }
}
