"use client";
import { useMemo,useState } from "react";
import type { PlanModelo } from "@aktiv/contrato";
import { hayBorradoresMensuales } from "@/lib/mensual";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { PlanEditorContext } from "./plan-editor-context";
import { PlanificacionUnificada } from "./planificacion-unificada";
import { RutinaPlanModal, ContenidoMes } from "./plan-mensual";

export function ModeloContenido({ modelo }: {modelo:PlanModelo}) {
  const [editor,setEditor]=useState(false);
  const transporte=useMemo<typeof api>(()=>({
    ...api,
    post:<T,>(ruta:string,datos:unknown)=>api.post<T>(`/planes-modelo/${modelo.id}/contenido`,{metodo:"POST",ruta,datos}),
    patch:<T,>(ruta:string,datos:unknown)=>api.post<T>(`/planes-modelo/${modelo.id}/contenido`,{metodo:"PATCH",ruta,datos}),
    delete:(ruta:string)=>api.post<void>(`/planes-modelo/${modelo.id}/contenido`,{metodo:"DELETE",ruta}),
  }),[modelo.id]);
  return <PlanEditorContext.Provider value={{api:transporte,modelo:true}}><div className="space-y-6"><div className="flex justify-end"><Button size="sm" variant="outline" onClick={()=>{if(!hayBorradoresMensuales())setEditor(v=>!v);else toast.error("Esperá a que se guarden los cambios.");}}>{editor?"Ver planificación":"Editor de rutinas"}</Button></div>{editor?<ContenidoMes plan={modelo} editable />:<PlanificacionUnificada key={modelo.id+":"+modelo.semanas} plan={modelo} editable renderRutina={(s,semana,cerrar,soloLectura)=><RutinaPlanModal key={s.id} plan={modelo} sesion={s} editable={!soloLectura} semanaInicial={semana} onCerrar={cerrar} />} />}</div></PlanEditorContext.Provider>;
}
