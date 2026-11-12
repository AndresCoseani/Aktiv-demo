"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { type ResumenModelo, planModeloSchema, resumenModeloSchema, altaSesionApi, altaEjercicioMensualApi, parcheCeldaProfeApi } from "@aktiv/contrato";
import { api } from "@/lib/api";
import { nuevoId } from "@/lib/format";
import { avisarCambioMensual } from "@/lib/mensual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";


export function AsignarDiaDesdeModelo({ planId, dia, numeroDia, planSemanas, disabled=false, alAsignar }: { planId: string; dia: string; numeroDia: number; planSemanas: number; disabled?:boolean; alAsignar: (sesionId: string) => void }) {
  const [abierto,setAbierto]=useState(false),[busqueda,setBusqueda]=useState(""),[modelos,setModelos]=useState<ResumenModelo[]>([]),[cargando,setCargando]=useState(false),[cargado,setCargado]=useState(false),[modeloId,setModeloId]=useState(""),[modelo,setModelo]=useState<ReturnType<typeof planModeloSchema.parse>|null>(null),[rutinaId,setRutinaId]=useState(""),[guardando,setGuardando]=useState(false),[error,setError]=useState("");
  const visibles=useMemo(()=>modelos.filter(m=>m.tipos.some(t=>["fuerza","gym"].includes(t.toLocaleLowerCase("es")))&&m.nombre.toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es"))),[modelos,busqueda]);
  const rutinas=(modelo?.sesiones??[]).filter(s=>["fuerza","gym"].includes(s.tipo.toLocaleLowerCase("es")));
  async function abrir(){if(disabled)return;setAbierto(true);setError("");if(cargado)return;setCargando(true);try{setModelos(resumenModeloSchema.array().parse(await api.get<unknown>("/planes-modelo")));setCargado(true);}catch(e){setError(e instanceof Error?e.message:"No pudimos cargar los modelos.");}finally{setCargando(false);}}
  async function elegirModelo(m:ResumenModelo){setModeloId(m.id);setModelo(null);setRutinaId("");setError("");try{setModelo(planModeloSchema.parse(await api.get<unknown>(`/planes-modelo/${m.id}`)));}catch(e){setError(e instanceof Error?e.message:"No pudimos abrir el modelo.");}}
  async function asignar(){const fuente=rutinas.find(s=>s.id===rutinaId);if(!fuente||guardando)return;setGuardando(true);setError("");let id="";try{
    id=nuevoId();const numero=numeroDia;const sesion=altaSesionApi.parse({id,tipo:"Fuerza",nombre:`Fuerza - Día ${numero}`,dia:null,dias:[],franja:fuente.franja,calentamiento:fuente.calentamiento,enfriamiento:fuente.enfriamiento,bloques:fuente.bloques,actividadesBloques:fuente.actividadesBloques,activacion:fuente.activacion.map(a=>({...a,id:nuevoId()}))});
    await api.post(`/planes-mensuales/${planId}/sesiones`,sesion);
    for(const ejercicio of fuente.ejercicios){const ejercicioId=nuevoId();const dto=altaEjercicioMensualApi.parse({id:ejercicioId,grupo:ejercicio.grupo,orden:ejercicio.orden,nombre:ejercicio.nombre,descanso:ejercicio.descanso});await api.post(`/sesiones/${id}/ejercicios`,dto);for(const celda of ejercicio.semanas){const semana=celda.semana<=planSemanas?celda:null;if(semana?.prescripcion.trim())await api.patch(`/sesion-ejercicios/${ejercicioId}/semanas/${semana.semana}`,parcheCeldaProfeApi.parse({prescripcion:semana.prescripcion}));}}
    avisarCambioMensual();alAsignar(id);setAbierto(false);
  }catch(e){if(id)await api.delete(`/sesiones/${id}`).catch(()=>{});setError(e instanceof Error?e.message:"No se pudo copiar el entrenamiento.");}finally{setGuardando(false);}}
  return <>
    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Buscar un plan para ${dia}`} title="Buscar un plan en Planes" disabled={disabled} onClick={()=>void abrir()} className="size-7 rounded-md text-muted-foreground hover:bg-muted hover:text-primary"><ChevronRight aria-hidden="true" className="size-4"/></Button>
    <Dialog open={abierto} onOpenChange={v=>!guardando&&setAbierto(v)}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Asignar entrenamiento a {dia}</DialogTitle><DialogDescription>Buscá un modelo de Planes y elegí el día de fuerza que querés copiar. La copia queda editable en este plan.</DialogDescription></DialogHeader>
      <label className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input aria-label="Buscar plan modelo" placeholder="Buscar plan" value={busqueda} onChange={e=>setBusqueda(e.target.value)} className="pl-9"/></label>
      {cargando?<p role="status" className="text-sm text-muted-foreground">Cargando planes…</p>:<div role="listbox" aria-label="Modelos de fuerza" className="max-h-44 space-y-1 overflow-y-auto">{visibles.map(m=><button type="button" role="option" aria-selected={modeloId===m.id} key={m.id} onClick={()=>void elegirModelo(m)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${modeloId===m.id?"border-primary bg-primary/10":"border-transparent hover:bg-muted"}`}><span className="block font-medium">{m.nombre}</span><span className="text-xs text-muted-foreground">{m.semanas} semanas · {m.dias} días</span></button>)}{!visibles.length&&cargado&&<p className="p-3 text-sm text-muted-foreground">No hay modelos de fuerza que coincidan.</p>}</div>}
      {modelo&&!rutinas.length&&<p className="text-sm text-muted-foreground">Este modelo no tiene días de fuerza para copiar.</p>}
      {modelo&&<fieldset disabled={guardando} className="space-y-2"><legend className="text-sm font-medium">Día de fuerza del modelo</legend>{rutinas.map((s,i)=><label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${rutinaId===s.id?"border-primary bg-primary/10":"border-border/70"}`}><input type="radio" name={`rutina-${dia}`} value={s.id} checked={rutinaId===s.id} onChange={()=>setRutinaId(s.id)} className="accent-primary"/><span className="min-w-0 flex-1"><span className="block font-medium">{s.nombre||`Fuerza - Día ${i+1}`}</span><span className="text-xs text-muted-foreground">{s.ejercicios.length} ejercicios · {s.bloques.length} bloques</span></span></label>)}</fieldset>}
      {error&&<p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <DialogFooter className="flex-col sm:flex-row"><Link href="/planes" onClick={()=>setAbierto(false)} className="mr-auto inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 hover:underline">Crear un plan en Planes</Link><Button type="button" variant="outline" disabled={guardando} onClick={()=>setAbierto(false)}>Cancelar</Button><Button type="button" disabled={!rutinaId||guardando} onClick={()=>void asignar()}>{guardando?"Copiando…":`Asignar a ${dia}`}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
