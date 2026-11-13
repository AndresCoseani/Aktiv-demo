"use client";

import { useEffect, useState } from "react";
import { DIAS_PLAN, DIAS_RUNNING, guardarRunningApi } from "@aktiv/contrato";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { usePlanEditor } from "./plan-editor-context";
import type { CeldaRunning } from "./running-semanal";

type Props = {
  planId: string; dia: number; semana: number; valor: string; editable: boolean;
  destinos: { dia:number; semana:number; tieneContenido:boolean }[];
  onGuardado: Parameters<typeof CeldaRunning>[0]["onGuardado"];
  onPendiente: (id: string, pendiente: boolean) => void;
};

export function RunningDetalle({planId,dia,semana,valor,editable,destinos,onGuardado,onPendiente}:Props) {
  const {api}=usePlanEditor();
  const [abierto,setAbierto]=useState(false),[texto,setTexto]=useState(valor),[ocupado,setOcupado]=useState(false),[error,setError]=useState(""),[confirmar,setConfirmar]=useState(false);
  const [duplicando,setDuplicando]=useState(false),[seleccionados,setSeleccionados]=useState<string[]>([]);
  const campo=DIAS_RUNNING[dia-1],identidad=`${semana}:${campo}`,sucio=abierto&&texto!==valor;
  const opciones=destinos.filter(d=>d.dia!==dia||d.semana!==semana);
  useEffect(()=>{onPendiente(identidad,sucio||ocupado);return()=>onPendiente(identidad,false);},[identidad,sucio,ocupado,onPendiente]);
  function abrir(){setTexto(valor);setError("");setAbierto(true);}
  function cerrar(){if(ocupado)return;if(sucio)setConfirmar(true);else setAbierto(false);}
  async function guardar(salir=false){
    const dto=guardarRunningApi.safeParse({semana,campo,texto});
    if(!dto.success){setError(dto.error.issues[0]?.message??"Revisá el texto.");return;}
    setOcupado(true);setError("");
    try{await api.patch(`/planes-mensuales/${planId}/running`,dto.data);onGuardado(semana,campo,texto);if(salir)setAbierto(false);}
    catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}
    finally{setOcupado(false);}
  }
  async function duplicar(){
    const elegidos=opciones.filter(d=>seleccionados.includes(`${d.semana}:${d.dia}`));if(!elegidos.length)return;
    setOcupado(true);setError("");let copiados=0;
    try{for(const elegido of elegidos){const campoDestino=DIAS_RUNNING[elegido.dia-1];await api.patch(`/planes-mensuales/${planId}/running`,guardarRunningApi.parse({semana:elegido.semana,campo:campoDestino,texto:valor}));onGuardado(elegido.semana,campoDestino,valor);copiados++;setSeleccionados(actual=>actual.filter(id=>id!==`${elegido.semana}:${elegido.dia}`));}setDuplicando(false);}
    catch(e){setError(`${e instanceof Error?e.message:"No se pudo duplicar."} ${copiados} de ${elegidos.length} destinos se copiaron. Podés reintentar los restantes.`);}
    finally{setOcupado(false);}
  }
  return <>
    <Button type="button" variant="ghost" aria-label={`Abrir Running, ${DIAS_PLAN[dia-1]}, semana ${semana}`} className="h-12 max-h-12 w-full min-w-0 overflow-hidden rounded-xl border border-border/40 bg-muted/30 px-3 py-1 text-center font-normal" onClick={abrir}><span className="line-clamp-2 w-full whitespace-pre-wrap break-words text-sm leading-[18px] [overflow-wrap:anywhere]">{valor||<span className="text-muted-foreground">{editable?"Agregar running":"Sin cargar"}</span>}</span></Button>
    <Dialog open={abierto} onOpenChange={v=>{if(!v)cerrar();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{DIAS_PLAN[dia-1]} · Semana {semana}</DialogTitle><DialogDescription>Running</DialogDescription></DialogHeader>
      {editable?<><Textarea autoFocus disabled={ocupado} aria-label={`Running de ${DIAS_PLAN[dia-1]}, semana ${semana}`} value={texto} maxLength={4000} placeholder="Escribí el entrenamiento…" onChange={e=>{setTexto(e.target.value);setError("");}} className="min-h-56 max-h-[60dvh] resize-y text-base leading-relaxed" />{error&&!duplicando&&<p role="alert" className="text-sm text-destructive">{error} El texto sigue en el formulario.</p>}<DialogFooter><Button type="button" variant="outline" disabled={sucio||ocupado||!valor.trim()||!opciones.length} onClick={()=>{setSeleccionados([]);setError("");setDuplicando(true);}}>Duplicar día</Button><Button type="button" disabled={!sucio||ocupado} onClick={()=>void guardar()}>{ocupado?"Guardando…":"Guardar cambios"}</Button></DialogFooter></>:<p className="min-h-32 whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-7 [overflow-wrap:anywhere]">{valor||"Sin cargar"}</p>}
    </DialogContent></Dialog>
    <Dialog open={confirmar} onOpenChange={setConfirmar}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>¿Guardar los cambios?</DialogTitle><DialogDescription>Tenés cambios sin guardar en este entrenamiento.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="ghost" onClick={()=>setConfirmar(false)}>Seguir editando</Button><Button type="button" variant="outline" onClick={()=>{setConfirmar(false);setTexto(valor);setAbierto(false);}}>Descartar</Button><Button type="button" onClick={()=>{setConfirmar(false);void guardar(true);}}>Guardar y salir</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={duplicando} onOpenChange={v=>{if(!ocupado)setDuplicando(v);}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm"><DialogHeader><DialogTitle>Duplicar día de Running</DialogTitle><DialogDescription>Elegí uno o más días que tengan Running activado.</DialogDescription></DialogHeader><details className="rounded-lg border bg-background"><summary className="cursor-pointer px-3 py-2 text-sm">{seleccionados.length?`${seleccionados.length} ${seleccionados.length===1?"destino seleccionado":"destinos seleccionados"}`:"Elegir destinos"}</summary><fieldset disabled={ocupado} className="max-h-56 space-y-1 overflow-y-auto border-t p-2"><legend className="sr-only">Destinos de Running</legend>{opciones.map(d=>{const id=`${d.semana}:${d.dia}`;return <label key={id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"><input type="checkbox" checked={seleccionados.includes(id)} onChange={e=>{const checked=e.target.checked;setSeleccionados(actual=>checked?[...actual,id]:actual.filter(v=>v!==id));}} className="size-4 accent-primary"/><span>Semana {d.semana} · {DIAS_PLAN[d.dia-1]}{d.tieneContenido&&<span className="text-muted-foreground"> · tiene texto</span>}</span></label>;})}</fieldset></details>{opciones.some(d=>d.tieneContenido&&seleccionados.includes(`${d.semana}:${d.dia}`))&&<p className="text-sm text-destructive">Se reemplazará el texto de los destinos seleccionados que ya tienen contenido.</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={ocupado} onClick={()=>setDuplicando(false)}>Cancelar</Button><Button type="button" disabled={ocupado||!seleccionados.length} onClick={()=>void duplicar()}>{ocupado?"Copiando…":"Copiar texto"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
