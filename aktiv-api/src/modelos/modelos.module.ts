import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Param, Patch, Post } from "@nestjs/common";
import { actividadesIniciales, asignarModeloApi, crearModeloApi, editarModeloApi, nombreModeloApi, operacionModeloApi, planModeloSchema, uuidSchema, type PlanModelo } from "@aktiv/contrato";
import { Roles } from "../auth/guards";
import { UsuarioActual, asegurarAlumno, borrarUno } from "../common/bd";
import { ErrorApi, lanzarSiError, noEncontrado } from "../common/errores";
import { ZodPipe, validarOLanzar } from "../common/zod.pipe";
import type { Usuario } from "../common/tipos";
import { SupabaseService } from "../supabase/supabase.service";
import { MensualesModule, MensualesService } from "../mensuales/mensuales.module";
import { remapearDistribucion } from "@aktiv/contrato";
import { cambiarDuracion, copiarSesiones, operarModelo } from "./contenido";

@Injectable()
export class ModelosService {
  constructor(private readonly supa: SupabaseService, private readonly mensuales: MensualesService) {}
  async listar(u: Usuario) {
    const modelos: PlanModelo[] = [];
    for (let desde=0; ; desde+=100) {
      const r=await this.supa.delUsuario(u.token).from("planes_modelo").select("id,nombre,tipo,semanas,sesiones,revision,running,distribucion").order("nombre").order("id").range(desde,desde+99);
      lanzarSiError(r.error); modelos.push(...(r.data ?? []).map((p)=>planModeloSchema.parse(p)));
      if ((r.data?.length ?? 0)<100) return modelos.map((p)=>({id:p.id,nombre:p.nombre,tipo:p.tipo,semanas:p.semanas,dias:p.sesiones.length}));
    }
  }
  async obtener(u: Usuario,id: string) {
    const r=await this.supa.delUsuario(u.token).from("planes_modelo").select("id,nombre,tipo,semanas,sesiones,revision,running,distribucion").eq("id",id).maybeSingle();
    lanzarSiError(r.error); if(!r.data) throw noEncontrado("El modelo"); return planModeloSchema.parse(r.data);
  }
  private async insertar(u: Usuario,modelo: PlanModelo) {
    const datos=validarOLanzar(planModeloSchema,modelo);
    const r=await this.supa.delUsuario(u.token).from("planes_modelo").insert({...datos,coach_id:u.id});
    if(r.error?.code==="23505") return this.obtener(u,datos.id);
    lanzarSiError(r.error);
    return datos;
  }
  async crear(u: Usuario,body: unknown) {
    const {diasIniciales,...dto}=validarOLanzar(crearModeloApi,body);
    const sesiones=actividadesIniciales(diasIniciales).flatMap(({tipo,dias})=>Array.from({length:dias},(_,i)=>({id:crypto.randomUUID(),nombre:`${tipo.slice(0,48)} · Día ${i+1}`,tipo,dia:null,franja:"Sin definir" as const,orden:i,calentamiento:"",enfriamiento:"",bloques:[],activacion:[],ejercicios:[]})));
    return this.insertar(u,{...dto,revision:0,sesiones:sesiones.map((s,i)=>({...s,orden:i}))});
  }
  /** CAS: operaciones simultáneas sobre distintas semanas no se pisan. */
  private async modificar(u: Usuario,id: string,transformar:(p:PlanModelo)=>PlanModelo) {
    for(let intento=0;intento<5;intento++) {
      const anterior=await this.obtener(u,id), siguiente=validarOLanzar(planModeloSchema,transformar(anterior));
      const r=await this.supa.delUsuario(u.token).from("planes_modelo").update({nombre:siguiente.nombre,tipo:siguiente.tipo,semanas:siguiente.semanas,sesiones:siguiente.sesiones,running:siguiente.running ?? {},distribucion:siguiente.distribucion ?? {},revision:anterior.revision+1}).eq("id",id).eq("revision",anterior.revision).select("id").maybeSingle();
      lanzarSiError(r.error); if(r.data) return {id};
    }
    throw new ErrorApi(409,"modelo_modificado","El modelo está recibiendo otros cambios. Reintentá; tu edición sigue en el formulario.");
  }
  async editar(u:Usuario,id:string,body:unknown) {
    const dto=validarOLanzar(editarModeloApi,body);
    return this.modificar(u,id,(p)=>({...dto,...(dto.semanas ? cambiarDuracion(p,dto.semanas):p),nombre:dto.nombre ?? p.nombre}));
  }
  async operar(u:Usuario,id:string,body:unknown) { const op=validarOLanzar(operacionModeloApi,body); return this.modificar(u,id,(p)=>operarModelo(p,op)); }
  async duplicar(u:Usuario,id:string,body:unknown) {
    const dto=validarOLanzar(nombreModeloApi,body), p=await this.obtener(u,id);
    const sesiones=copiarSesiones(p.sesiones);return this.insertar(u,{...p,...dto,revision:0,running:p.running ?? {},sesiones,distribucion:remapearDistribucion(p.distribucion,new Map(p.sesiones.map((s,i)=>[s.id,sesiones[i].id])))});
  }
  async desdePlan(u:Usuario,id:string,body:unknown) {
    const dto=validarOLanzar(nombreModeloApi,body);
    const r=await this.supa.delUsuario(u.token).from("planes_mensuales").select("alumno_id").eq("id",id).maybeSingle();
    lanzarSiError(r.error); if(!r.data) throw noEncontrado("El plan");
    const p=(await this.mensuales.cargar(u,r.data.alumno_id)).find((p)=>p.id===id); if(!p) throw noEncontrado("El plan");
    const sesiones=copiarSesiones(p.sesiones);return this.insertar(u,{...dto,tipo:p.tipo,semanas:p.semanas,revision:0,running:p.running ?? {},sesiones,distribucion:remapearDistribucion(p.distribucion,new Map(p.sesiones.map((s,i)=>[s.id,sesiones[i].id])))});
  }
  async asignar(u:Usuario,id:string,body:unknown) {
    const dto=validarOLanzar(asignarModeloApi,body), modelo=await this.obtener(u,id);
    const db=this.supa.delUsuario(u.token); await asegurarAlumno(db,dto.alumnoId);
    const r=await db.rpc("asignar_plan_modelo_duracion",{p_modelo:id,p_id:dto.id,p_alumno:dto.alumnoId,p_nombre:dto.nombre,p_inicio:dto.inicio,p_semanas:dto.semanas??modelo.semanas,p_asignaciones:dto.asignaciones}); lanzarSiError(r.error); return {id:dto.id};
  }
  async borrar(u:Usuario,id:string) { await borrarUno(this.supa.delUsuario(u.token),"planes_modelo",id,"El modelo"); }
}
const id=()=>new ZodPipe(uuidSchema);
@Roles("coach")
@Controller("planes-modelo")
export class ModelosController {
  constructor(private readonly modelos:ModelosService) {}
  @Get() listar(@UsuarioActual() u:Usuario) {return this.modelos.listar(u);}
  @Get(":id") obtener(@UsuarioActual() u:Usuario,@Param("id",id()) p:string) {return this.modelos.obtener(u,p);}
  @Post() crear(@UsuarioActual() u:Usuario,@Body() b:unknown) {return this.modelos.crear(u,b);}
  @Patch(":id") editar(@UsuarioActual() u:Usuario,@Param("id",id()) p:string,@Body() b:unknown) {return this.modelos.editar(u,p,b);}
  @Post(":id/contenido") contenido(@UsuarioActual() u:Usuario,@Param("id",id()) p:string,@Body() b:unknown) {return this.modelos.operar(u,p,b);}
  @Post(":id/duplicar") duplicar(@UsuarioActual() u:Usuario,@Param("id",id()) p:string,@Body() b:unknown) {return this.modelos.duplicar(u,p,b);}
  @Post("desde-plan/:id") desdePlan(@UsuarioActual() u:Usuario,@Param("id",id()) p:string,@Body() b:unknown) {return this.modelos.desdePlan(u,p,b);}
  @Post(":id/asignar") asignar(@UsuarioActual() u:Usuario,@Param("id",id()) p:string,@Body() b:unknown) {return this.modelos.asignar(u,p,b);}
  @Delete(":id") @HttpCode(204) borrar(@UsuarioActual() u:Usuario,@Param("id",id()) p:string) {return this.modelos.borrar(u,p);}
}
@Module({imports:[MensualesModule],controllers:[ModelosController],providers:[ModelosService]})
export class ModelosModule {}
