"use client";

import { useCallback, useState } from "react";
import { DIAS_PLAN, DIAS_RUNNING } from "@aktiv/contrato";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { CeldaRunning } from "./running-semanal";

type Props = {
  planId: string; dia: number; semana: number; valor: string; editable: boolean;
  onGuardado: Parameters<typeof CeldaRunning>[0]["onGuardado"];
  onPendiente: (id: string, pendiente: boolean) => void;
};

/** La vista previa nunca crece; el detalle conserva el texto y los saltos de línea. */
export function RunningDetalle({planId,dia,semana,valor,editable,onGuardado,onPendiente}:Props) {
  const [abierto,setAbierto]=useState(false),[pendiente,setPendiente]=useState(false);
  const alPendiente=useCallback((id:string,v:boolean)=>{setPendiente(v);onPendiente(id,v);},[onPendiente]);
  const titulo=`${DIAS_PLAN[dia-1]} · Semana ${semana}`;
  return <>
    <Button type="button" variant="ghost" aria-label={`Abrir Running, ${DIAS_PLAN[dia-1]}, semana ${semana}`} className="h-12 max-h-12 w-full min-w-0 overflow-hidden rounded-xl border border-border/40 bg-muted/30 px-3 py-1 text-center font-normal" onClick={()=>setAbierto(true)}><span className="line-clamp-2 w-full whitespace-pre-wrap break-words text-sm leading-[18px] [overflow-wrap:anywhere]">{valor||<span className="text-muted-foreground">{editable?"Escribe aquí…":"Sin cargar"}</span>}</span></Button>
    <Dialog open={abierto} onOpenChange={v=>{if(v||!pendiente)setAbierto(v);}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>Running</DialogDescription></DialogHeader>
      {editable?<CeldaRunning key={`${dia}:${semana}`} detalle soloTexto planId={planId} semana={semana} campo={DIAS_RUNNING[dia-1]} valor={valor} onGuardado={onGuardado} onPendiente={alPendiente} />:<p className="min-h-32 whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-7 [overflow-wrap:anywhere]">{valor||"Sin cargar"}</p>}
    </DialogContent></Dialog>
  </>;
}
