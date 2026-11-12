"use client";
import { ActividadesIniciales } from "./actividades-plan";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ZodError } from "zod";
import { crearModeloApi, editarModeloApi, asignarModeloApi, nombreModeloApi, planModeloSchema, DIAS_PLAN, MAX_SEMANAS_PLAN, type PlanModelo, type ResumenModelo } from "@aktiv/contrato";
import { api } from "@/lib/api";
import { nuevoId, hoyISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import { avisarCambioMensual, hayBorradoresMensuales } from "@/lib/mensual";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FechaInput } from "./fecha-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from "./ui/combobox";

export type AccionModelo = {tipo:"crear"}|{tipo:"editar"|"duplicar"|"asignar"|"borrar";modelo:ResumenModelo};
const titulos={crear:"Nuevo plan modelo",editar:"Editar modelo",duplicar:"Duplicar modelo",asignar:"Asignar a un alumno",borrar:"Eliminar modelo"};
export function ModeloDialog({accion,onCerrar,alumnoInicial}:{accion:AccionModelo;onCerrar:()=>void;alumnoInicial?:string}) {
  const router=useRouter(),{alumnos}=useStore();
  const [id]=useState(nuevoId),[ocupado,setOcupado]=useState(false),[error,setError]=useState("");
  const [destino,setDestino]=useState<string|null>(alumnoInicial??null);
  const [detalle,setDetalle]=useState<PlanModelo|null>(null);
  const [selecciones,setSelecciones]=useState<Record<number,string>>({});
  const [inicioAsignacion,setInicioAsignacion]=useState(hoyISO()),[semanasAsignacion,setSemanasAsignacion]=useState(accion.tipo==="asignar"?accion.modelo.semanas:4);

  const modelo=accion.tipo==="crear"?null:accion.modelo;
  useEffect(()=>{if(accion.tipo!=="asignar")return;let vigente=true;api.get<unknown>(`/planes-modelo/${accion.modelo.id}`).then(r=>{if(vigente){setDetalle(planModeloSchema.parse(r));setError("");}}).catch(e=>{if(vigente)setError(e instanceof Error?e.message:"No pudimos cargar las sesiones del modelo.");});return()=>{vigente=false;};},[accion]);
  const cargandoDetalle=accion.tipo==="asignar"&&detalle?.id!==accion.modelo.id;
  const etiqueta=(id:string)=>{const a=alumnos.find((a)=>a.id===id);return a?`${a.nombre} · ${a.email}`:id;};
  async function guardar(evento:React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();if(ocupado)return;
    if(hayBorradoresMensuales()){setError("Esperá a que terminen de guardarse los cambios del modelo.");return;}
    const f=new FormData(evento.currentTarget);setOcupado(true);setError("");
    try {
      const nombre=String(f.get("nombre")??modelo?.nombre??"").trim();
      if(accion.tipo==="crear") {
        const dto=crearModeloApi.parse({id,nombre,tipo:String(f.get("tipo")),semanas:Number(f.get("semanas")),diasIniciales:JSON.parse(String(f.get("actividadesIniciales")))});
        await api.post("/planes-modelo",dto);router.push(`/planes?modelo=${id}`);toast.success("Modelo creado");
      } else if(accion.tipo==="editar") {
        await api.patch(`/planes-modelo/${accion.modelo.id}`,editarModeloApi.parse({nombre,semanas:Number(f.get("semanas"))}));toast.success("Modelo actualizado");
      } else if(accion.tipo==="duplicar") {
        await api.post(`/planes-modelo/${accion.modelo.id}/duplicar`,nombreModeloApi.parse({id,nombre}));router.push(`/planes?modelo=${id}`);toast.success("Modelo duplicado");
      } else if(accion.tipo==="asignar") {
        const dto=asignarModeloApi.parse({id,nombre,alumnoId:destino,inicio:String(f.get("inicio")),semanas:Number(f.get("semanas")),asignaciones:Object.entries(selecciones).filter(([,sesionId])=>Boolean(sesionId)).map(([dia,sesionId])=>({dia:Number(dia),sesionId}))});
        await api.post(`/planes-modelo/${accion.modelo.id}/asignar`,dto);
        toast.success("Plan asignado como borrador",{action:{label:"Ver alumno",onClick:()=>router.push(`/alumnos/${destino}`)}});
      } else {await api.delete(`/planes-modelo/${accion.modelo.id}`);router.push("/planes");toast.success("Modelo eliminado");}
      avisarCambioMensual();onCerrar();
    } catch(e) {
      setError(e instanceof ZodError?e.issues[0].message:e instanceof Error?e.message:"No pudimos guardar los cambios. Reintentá.");
    } finally {setOcupado(false);}
  }
  const descripcion=accion.tipo==="asignar"?"Elegí qué sesión va en cada día. Las sesiones que dejes sin asignar quedan disponibles en la copia del alumno.":accion.tipo==="borrar"?"Las copias que ya asignaste a alumnos se conservan.":accion.tipo==="crear"?"Armá una base reutilizable, sin alumno ni fecha de inicio.":"Los cambios del modelo no modifican los planes de los alumnos.";
  return <Dialog open onOpenChange={(o)=>!o&&!ocupado&&onCerrar()}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!ocupado}>
    <form className="space-y-5" onSubmit={guardar}>
      <DialogHeader><DialogTitle>{titulos[accion.tipo]}</DialogTitle><DialogDescription>{descripcion}</DialogDescription></DialogHeader>
      <fieldset disabled={ocupado} className="min-w-0 space-y-4">
        {accion.tipo==="borrar"?<p className="break-words text-sm">¿Eliminar «{modelo?.nombre}» de tu biblioteca?</p>:<>
          {accion.tipo==="asignar"&&!alumnoInicial&&<div className="space-y-1 text-sm"><label htmlFor="modelo-alumno">Alumno</label>
            <Combobox items={alumnos.map((a)=>a.id)} value={destino} onValueChange={setDestino} itemToStringLabel={etiqueta} filter={(id,q)=>etiqueta(id).toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es"))}>
              <ComboboxInput id="modelo-alumno" aria-label="Alumno" placeholder="Buscá por nombre o email" className="w-full" />
              <ComboboxContent><ComboboxEmpty>No se encontraron alumnos.</ComboboxEmpty><ComboboxList>{(id:string)=><ComboboxItem key={id} value={id}><span className="truncate">{etiqueta(id)}</span></ComboboxItem>}</ComboboxList></ComboboxContent>
            </Combobox>
          </div>}
          {accion.tipo==="asignar"&&alumnoInicial&&<p className="text-sm text-muted-foreground">Alumno: <span className="font-medium text-foreground">{etiqueta(alumnoInicial)}</span></p>}
          <label className="block space-y-1 text-sm">Nombre<Input name="nombre" defaultValue={modelo?(accion.tipo==="duplicar"?`${modelo.nombre.slice(0,112)} (copia)`:modelo.nombre):""} placeholder="Ej: Fuerza inicial" maxLength={120} required autoFocus /></label>
          {(accion.tipo==="crear"||accion.tipo==="editar")&&<label className="block space-y-1 text-sm">Duración en semanas<Input name="semanas" type="number" min={1} max={MAX_SEMANAS_PLAN} defaultValue={modelo?.semanas??4} required /></label>}
          {accion.tipo==="asignar"&&<label className="block space-y-1 text-sm">Duración en semanas<Input name="semanas" type="number" min={1} max={MAX_SEMANAS_PLAN} value={semanasAsignacion} onChange={e=>setSemanasAsignacion(Number(e.target.value))} required /></label>}
          {accion.tipo==="crear"&&<ActividadesIniciales />}
          {accion.tipo==="asignar"&&<><label className="block space-y-1 text-sm">Fecha de inicio<FechaInput name="inicio" value={inicioAsignacion} onChange={e=>setInicioAsignacion(e.target.value)} min="2000-01-01" max="2100-01-01" required /></label>{inicioAsignacion&&semanasAsignacion>0&&<p className="text-xs text-muted-foreground">La copia cubrirá {semanasAsignacion} semanas, hasta {new Date(Date.parse(`${inicioAsignacion}T12:00:00Z`)+(semanasAsignacion*7-1)*86400000).toLocaleDateString("es-AR",{timeZone:"UTC",day:"numeric",month:"short",year:"numeric"})}.</p>}</>}
          {accion.tipo==="asignar"&&<section className="space-y-2"><p className="text-sm font-medium">Sesiones de la semana</p>{cargandoDetalle?<p role="status" className="text-sm text-muted-foreground">Cargando sesiones…</p>:detalle?.sesiones.length?<div className="max-h-64 space-y-2 overflow-y-auto">{DIAS_PLAN.map((dia,i)=><label key={dia} className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2 text-sm"><span>{dia}</span><select aria-label={`Sesión para ${dia}`} className="h-9 min-w-0 rounded-lg border border-input bg-background px-2" value={selecciones[i+1]??""} onChange={e=>setSelecciones(prev=>({...prev,[i+1]:e.target.value}))}><option value="">Sin asignar</option>{detalle.sesiones.filter(s=>!Object.entries(selecciones).some(([d,id])=>Number(d)!==i+1&&id===s.id)).map((s,n)=><option key={s.id} value={s.id}>{s.nombre||`${detalle.tipo} - Día ${n+1}`}</option>)}</select></label>)}</div>:<p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Este modelo no tiene sesiones para asignar.</p>}{detalle&&<div className="space-y-1 text-xs text-muted-foreground"><p>{detalle.sesiones.length-Object.values(selecciones).filter(Boolean).length} de {detalle.sesiones.length} sesiones quedan disponibles sin asignar.</p>{detalle.sesiones.filter(s=>!Object.values(selecciones).includes(s.id)).map((s,n)=><p key={s.id}>· {s.nombre||`${detalle.tipo} - Día ${n+1}`}</p>)}</div>}</section>}
        </>}
      </fieldset>
      {error&&<p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" variant={accion.tipo==="borrar"?"destructive":"default"} disabled={ocupado||(accion.tipo==="asignar"&&(!destino||cargandoDetalle||!detalle))}>{ocupado?"Guardando…":accion.tipo==="asignar"?"Asignar como borrador":accion.tipo==="borrar"?"Eliminar modelo":accion.tipo==="crear"?"Crear modelo":accion.tipo==="duplicar"?"Duplicar modelo":"Guardar cambios"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
