"use client";
import { ActividadesIniciales } from "./actividades-plan";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ZodError } from "zod";
import { crearModeloApi, editarModeloApi, asignarModeloApi, nombreModeloApi, MAX_SEMANAS_PLAN, type ResumenModelo } from "@aktiv/contrato";
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
export function ModeloDialog({accion,onCerrar}:{accion:AccionModelo;onCerrar:()=>void}) {
  const router=useRouter(),{alumnos}=useStore();
  const [id]=useState(nuevoId),[ocupado,setOcupado]=useState(false),[error,setError]=useState("");
  const [destino,setDestino]=useState<string|null>(null);

  const modelo=accion.tipo==="crear"?null:accion.modelo;
  const etiqueta=(id:string)=>{const a=alumnos.find((a)=>a.id===id);return a?`${a.nombre} · ${a.email}`:id;};
  async function guardar(evento:React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();if(ocupado)return;
    if(hayBorradoresMensuales()){setError("Esperá a que terminen de guardarse los cambios del modelo.");return;}
    const f=new FormData(evento.currentTarget);setOcupado(true);setError("");
    try {
      const nombre=String(f.get("nombre")??modelo?.nombre??"").trim();
      if(accion.tipo==="crear") {
        const dto=crearModeloApi.parse({id,nombre,semanas:Number(f.get("semanas")),diasIniciales:JSON.parse(String(f.get("actividadesIniciales")))});
        await api.post("/planes-modelo",dto);router.push(`/planes?modelo=${id}`);toast.success("Modelo creado");
      } else if(accion.tipo==="editar") {
        await api.patch(`/planes-modelo/${accion.modelo.id}`,editarModeloApi.parse({nombre,semanas:Number(f.get("semanas"))}));toast.success("Modelo actualizado");
      } else if(accion.tipo==="duplicar") {
        await api.post(`/planes-modelo/${accion.modelo.id}/duplicar`,nombreModeloApi.parse({id,nombre}));router.push(`/planes?modelo=${id}`);toast.success("Modelo duplicado");
      } else if(accion.tipo==="asignar") {
        const dto=asignarModeloApi.parse({id,nombre,alumnoId:destino,inicio:String(f.get("inicio"))});
        await api.post(`/planes-modelo/${accion.modelo.id}/asignar`,dto);
        toast.success("Plan asignado como borrador",{action:{label:"Ver alumno",onClick:()=>router.push(`/alumnos/${destino}`)}});
      } else {await api.delete(`/planes-modelo/${accion.modelo.id}`);router.push("/planes");toast.success("Modelo eliminado");}
      avisarCambioMensual();onCerrar();
    } catch(e) {
      setError(e instanceof ZodError?e.issues[0].message:e instanceof Error?e.message:"No pudimos guardar los cambios. Reintentá.");
    } finally {setOcupado(false);}
  }
  const descripcion=accion.tipo==="asignar"?"Se crea una copia independiente como borrador. El plan activo del alumno y el modelo se conservan.":accion.tipo==="borrar"?"Las copias que ya asignaste a alumnos se conservan.":accion.tipo==="crear"?"Armá una base reutilizable, sin alumno ni fecha de inicio.":"Los cambios del modelo no modifican los planes de los alumnos.";
  return <Dialog open onOpenChange={(o)=>!o&&!ocupado&&onCerrar()}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!ocupado}>
    <form className="space-y-5" onSubmit={guardar}>
      <DialogHeader><DialogTitle>{titulos[accion.tipo]}</DialogTitle><DialogDescription>{descripcion}</DialogDescription></DialogHeader>
      <fieldset disabled={ocupado} className="min-w-0 space-y-4">
        {accion.tipo==="borrar"?<p className="break-words text-sm">¿Eliminar «{modelo?.nombre}» de tu biblioteca?</p>:<>
          {accion.tipo==="asignar"&&<div className="space-y-1 text-sm"><label htmlFor="modelo-alumno">Alumno</label>
            <Combobox items={alumnos.map((a)=>a.id)} value={destino} onValueChange={setDestino} itemToStringLabel={etiqueta} filter={(id,q)=>etiqueta(id).toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es"))}>
              <ComboboxInput id="modelo-alumno" aria-label="Alumno" placeholder="Buscá por nombre o email" className="w-full" />
              <ComboboxContent><ComboboxEmpty>No se encontraron alumnos.</ComboboxEmpty><ComboboxList>{(id:string)=><ComboboxItem key={id} value={id}><span className="truncate">{etiqueta(id)}</span></ComboboxItem>}</ComboboxList></ComboboxContent>
            </Combobox>
          </div>}
          <label className="block space-y-1 text-sm">Nombre<Input name="nombre" defaultValue={modelo?(accion.tipo==="duplicar"?`${modelo.nombre.slice(0,112)} (copia)`:modelo.nombre):""} placeholder="Ej: Fuerza inicial" maxLength={120} required autoFocus /></label>
          {(accion.tipo==="crear"||accion.tipo==="editar")&&<label className="block space-y-1 text-sm">Duración en semanas<Input name="semanas" type="number" min={1} max={MAX_SEMANAS_PLAN} defaultValue={modelo?.semanas??4} required /></label>}
          {accion.tipo==="crear"&&<ActividadesIniciales />}
          {accion.tipo==="asignar"&&<label className="block space-y-1 text-sm">Fecha de inicio<FechaInput name="inicio" defaultValue={hoyISO()} min="2000-01-01" max="2100-01-01" required /></label>}
        </>}
      </fieldset>
      {error&&<p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" variant={accion.tipo==="borrar"?"destructive":"default"} disabled={ocupado||(accion.tipo==="asignar"&&!destino)}>{ocupado?"Guardando…":accion.tipo==="asignar"?"Asignar como borrador":accion.tipo==="borrar"?"Eliminar modelo":accion.tipo==="crear"?"Crear modelo":accion.tipo==="duplicar"?"Duplicar modelo":"Guardar cambios"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
