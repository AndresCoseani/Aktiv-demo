"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Dumbbell, Search } from "lucide-react";
import { type ResumenModelo, type SesionEntrenamiento, planModeloSchema, resumenModeloSchema, altaSesionApi, altaEjercicioMensualApi, parcheCeldaProfeApi } from "@aktiv/contrato";
import { api } from "@/lib/api";
import { nuevoId } from "@/lib/format";
import { avisarCambioMensual } from "@/lib/mensual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlanEditor } from "./plan-editor-context";


export function AsignarDiaDesdeModelo({ planId, dia, numeroDia, planSemanas, sesiones=[], disabled=false, asignado=false, alDesasignar, alAsignar }: { planId: string; dia: string; numeroDia: number; planSemanas: number; sesiones?: SesionEntrenamiento[]; disabled?:boolean; asignado?:boolean; alDesasignar: () => void; alAsignar: (sesionId: string) => void }) {
  const {api:editorApi}=usePlanEditor();
  const [abierto,setAbierto]=useState(false),[busqueda,setBusqueda]=useState(""),[modelos,setModelos]=useState<ResumenModelo[]>([]),[cargando,setCargando]=useState(false),[cargado,setCargado]=useState(false),[modeloId,setModeloId]=useState(""),[modelo,setModelo]=useState<ReturnType<typeof planModeloSchema.parse>|null>(null),[rutinaId,setRutinaId]=useState(""),[guardando,setGuardando]=useState(false),[error,setError]=useState("");
  const visibles=useMemo(()=>modelos.filter(m=>["fuerza","gym"].includes(m.tipo.toLocaleLowerCase("es"))&&m.nombre.toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es"))),[modelos,busqueda]);
  const rutinas=(modelo?.sesiones??[]).filter(s=>["fuerza","gym"].includes(s.tipo.toLocaleLowerCase("es")));
  async function abrir(){if(disabled)return;setAbierto(true);setError("");if(cargado)return;setCargando(true);try{setModelos(resumenModeloSchema.array().parse(await api.get<unknown>("/planes-modelo")));setCargado(true);}catch(e){setError(e instanceof Error?e.message:"No pudimos cargar los modelos.");}finally{setCargando(false);}}
  async function elegirModelo(m:ResumenModelo){setModeloId(m.id);setModelo(null);setRutinaId("");setError("");try{setModelo(planModeloSchema.parse(await api.get<unknown>(`/planes-modelo/${m.id}`)));}catch(e){setError(e instanceof Error?e.message:"No pudimos abrir el modelo.");}}
  async function asignar(){const fuente=rutinas.find(s=>s.id===rutinaId);if(!fuente||guardando)return;setGuardando(true);setError("");let id="";try{
    id=nuevoId();const numero=numeroDia;const sesion=altaSesionApi.parse({id,tipo:"Fuerza",nombre:`Fuerza - Día ${numero}`,dia:null,dias:[],franja:fuente.franja,calentamiento:fuente.calentamiento,enfriamiento:fuente.enfriamiento,bloques:fuente.bloques,actividadesBloques:fuente.actividadesBloques,activacion:fuente.activacion.map(a=>({...a,id:nuevoId()}))});
    await editorApi.post(`/planes-mensuales/${planId}/sesiones`,sesion);
    for(const ejercicio of fuente.ejercicios){const ejercicioId=nuevoId();const dto=altaEjercicioMensualApi.parse({id:ejercicioId,grupo:ejercicio.grupo,nombre:ejercicio.nombre,descanso:ejercicio.descanso});await editorApi.post(`/sesiones/${id}/ejercicios`,dto);for(const celda of ejercicio.semanas){const semana=celda.semana<=planSemanas?celda:null;if(semana?.prescripcion.trim())await editorApi.patch(`/sesion-ejercicios/${ejercicioId}/semanas/${semana.semana}`,parcheCeldaProfeApi.parse({prescripcion:semana.prescripcion}));}}
    avisarCambioMensual();alAsignar(id);setAbierto(false);
  }catch(e){if(id)await editorApi.delete(`/sesiones/${id}`).catch(()=>{});setError(e instanceof Error?e.message:"No se pudo copiar el entrenamiento.");}finally{setGuardando(false);}}
  return <>
    <Button type="button" variant="ghost" aria-label={`Asignar entrenamiento a ${dia}`} title={`Asignar entrenamiento a ${dia}`} disabled={disabled} onClick={()=>void abrir()} className="h-auto min-h-10 w-full rounded-lg px-2 py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary"><span>{dia.slice(0,3)}</span><Dumbbell aria-hidden="true" className="size-4 text-primary" /></Button>
    <Dialog open={abierto} onOpenChange={v=>!guardando&&setAbierto(v)}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Asignar entrenamiento a {dia}</DialogTitle><DialogDescription>Elegí un día de este plan o copiá uno de un modelo. La asignación se aplica a todas las semanas y reemplaza las variaciones de ese día.</DialogDescription></DialogHeader>
      {sesiones.some(s=>["Fuerza","GYM"].includes(s.tipo))&&<div className="space-y-2"><p className="text-sm font-medium">Días de este plan</p>{sesiones.filter(s=>["Fuerza","GYM"].includes(s.tipo)).map(s=><Button key={s.id} type="button" variant="outline" className="w-full min-w-0 justify-between" disabled={guardando} onClick={()=>{alAsignar(s.id);setAbierto(false);}}><span className="min-w-0 truncate">{s.nombre||"Día de fuerza"}</span><span className="shrink-0 text-xs text-muted-foreground">{s.ejercicios.filter(e=>e.nombre.trim()).length} ejercicios de bloque</span></Button>)}</div>}
      {asignado&&<Button type="button" variant="outline" disabled={guardando} onClick={()=>{alDesasignar();setAbierto(false);}}>Desasignar día de fuerza</Button>}
      <label className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input aria-label="Buscar plan modelo" placeholder="Buscar plan" value={busqueda} onChange={e=>setBusqueda(e.target.value)} className="pl-9"/></label>
      {cargando?<p role="status" className="text-sm text-muted-foreground">Cargando planes…</p>:<div role="listbox" aria-label="Modelos de fuerza" className="max-h-44 space-y-1 overflow-y-auto">{visibles.map(m=><button type="button" role="option" aria-selected={modeloId===m.id} key={m.id} onClick={()=>void elegirModelo(m)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${modeloId===m.id?"border-primary bg-primary/10":"border-transparent hover:bg-muted"}`}><span className="block font-medium">{m.nombre}</span><span className="text-xs text-muted-foreground">{m.semanas} semanas · {m.dias} días</span></button>)}{!visibles.length&&cargado&&<p className="p-3 text-sm text-muted-foreground">No hay modelos de fuerza que coincidan.</p>}</div>}
      {modelo&&!rutinas.length&&<p className="text-sm text-muted-foreground">Este modelo no tiene días de fuerza para copiar.</p>}
      {modelo&&<fieldset disabled={guardando} className="space-y-2"><legend className="text-sm font-medium">Día de fuerza del modelo</legend>{rutinas.map((s,i)=><label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${rutinaId===s.id?"border-primary bg-primary/10":"border-border/70"}`}><input type="radio" name={`rutina-${dia}`} value={s.id} checked={rutinaId===s.id} onChange={()=>setRutinaId(s.id)} className="accent-primary"/><span className="min-w-0 flex-1"><span className="block font-medium">{s.nombre||`Fuerza - Día ${i+1}`}</span><span className="text-xs text-muted-foreground">{s.ejercicios.length} ejercicios · {s.bloques.length} bloques</span></span></label>)}</fieldset>}
      {error&&<p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <DialogFooter className="flex-col sm:flex-row"><Link href="/planes" onClick={()=>setAbierto(false)} className="mr-auto inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 hover:underline">Crear un plan en Planes</Link><Button type="button" variant="outline" disabled={guardando} onClick={()=>setAbierto(false)}>Cancelar</Button><Button type="button" disabled={!rutinaId||guardando} onClick={()=>void asignar()}>{guardando?"Copiando…":`Asignar a ${dia}`}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
