"use client";
import { useMemo } from "react";
import type { PlanModelo } from "@aktiv/contrato";
import { api } from "@/lib/api";
import { PlanEditorContext } from "./plan-editor-context";
import { ContenidoMes } from "./plan-mensual";

export function ModeloContenido({ modelo }: {modelo:PlanModelo}) {
  const transporte=useMemo<typeof api>(()=>({
    ...api,
    post:<T,>(ruta:string,datos:unknown)=>api.post<T>(`/planes-modelo/${modelo.id}/contenido`,{metodo:"POST",ruta,datos}),
    patch:<T,>(ruta:string,datos:unknown)=>api.post<T>(`/planes-modelo/${modelo.id}/contenido`,{metodo:"PATCH",ruta,datos}),
    delete:(ruta:string)=>api.post<void>(`/planes-modelo/${modelo.id}/contenido`,{metodo:"DELETE",ruta}),
  }),[modelo.id]);
  return <PlanEditorContext.Provider value={{api:transporte,modelo:true}}><ContenidoMes plan={modelo} editable /></PlanEditorContext.Provider>;
}
