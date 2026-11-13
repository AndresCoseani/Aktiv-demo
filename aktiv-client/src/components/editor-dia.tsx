"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { prescripcionEfectiva, type EjercicioMensual, type SesionEntrenamiento } from "@aktiv/contrato";
import { bloquesDelPlan, primerBloqueLibre } from "./editor-ejercicios-plan";
import { EjercicioCombobox } from "./ejercicio-combobox";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { separarDosis, separarIndicacion, unirDosis, unirIndicacion } from "@/lib/dosis";
import { nuevoId } from "@/lib/format";

type Props = {
  sesion: SesionEntrenamiento; semana: number; editable: boolean; bloqueado?: boolean;
  onSesion?: (sesion: SesionEntrenamiento) => void;
  onEjercicio?: (id: string, cambio: Partial<EjercicioMensual>) => void;
  onAgregar?: (grupo: number) => void; onQuitar?: (id: string) => void;
  onDuplicar?: () => void; duplicarBloqueado?: boolean; onEliminarDia?: () => void;
};
const fila = "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem]";

function CamposDosis({texto,descanso,etiqueta,editable,maxLength=60,onChange}:{texto:string;descanso:string;etiqueta:string;editable:boolean;maxLength?:number;onChange:(texto:string,descanso:string)=>void}) {
  const dosis=separarDosis(texto);
  return <div className="col-span-full grid grid-cols-3 gap-2 sm:col-span-3">{(["Series","Repeticiones","Descanso"] as const).map((campo,i)=><label key={campo} className={`min-w-0 space-y-1 text-muted-foreground ${editable?"text-[10px]":"text-xs"}`}><span>{campo}</span>{editable?<Input aria-label={`${campo} de ${etiqueta}`} className="h-9 text-sm text-foreground" maxLength={i===2?30:maxLength} value={i===0?dosis.series:i===1?dosis.repeticiones:descanso} onChange={e=>{const valor=e.target.value;const nuevo=i===0?unirDosis(valor,dosis.repeticiones):i===1?unirDosis(dosis.series,valor):texto;if(nuevo.length<=maxLength)onChange(nuevo,i===2?valor:descanso);}} />:<p className="min-h-9 break-words py-2 text-base font-medium text-foreground">{i===2?(descanso.trim()||"60 s"):(i===0?dosis.series:dosis.repeticiones)||"—"}</p>}</label>)}</div>;
}

/** Vista compacta compartida por el profesor y el alumno. Los formatos anteriores se conservan. */
export function EditorDia({sesion,semana,editable,bloqueado=false,onSesion,onEjercicio,onAgregar,onQuitar,onDuplicar,duplicarBloqueado=false,onEliminarDia}:Props) {
  const [nuevo,setNuevo]=useState(false),[actividad,setActividad]=useState(["Movilidad","Activación"].includes(sesion.tipo)?sesion.tipo:"Fuerza");
  const [borrarBloque,setBorrarBloque]=useState<number|null>(null);
  const grupos=bloquesDelPlan(sesion.ejercicios,sesion.bloques);
  const fases=(["Movilidad","Activación"] as const).filter(f=>sesion.activacion.some(e=>(e.fase??"Activación")===f));
  function mover(id:string,direccion:number) {
    const grupo=sesion.ejercicios.find(e=>e.id===id)?.grupo;
    const lista=sesion.ejercicios.filter(e=>e.grupo===grupo).sort((a,b)=>a.orden-b.orden),i=lista.findIndex(e=>e.id===id),otra=lista[i+direccion];
    if(i<0||!otra)return;
    // Un único borrador contiene ambos cambios de orden.
    onSesion?.({...sesion,ejercicios:sesion.ejercicios.map(e=>e.id===id?{...e,orden:otra.orden}:e.id===otra.id?{...e,orden:lista[i].orden}:e)});
  }
  function crearBloque() {
    const grupo=primerBloqueLibre(sesion.ejercicios,sesion.bloques);
    if(grupo)onSesion?.({...sesion,bloques:[...grupos,grupo],actividadesBloques:{...sesion.actividadesBloques,[grupo]:actividad as "Movilidad"|"Activación"|"Fuerza"}});
    setNuevo(false);
  }
  function moverBloque(indice:number,direccion:number) {
    const destino=indice+direccion;
    if(destino<0||destino>=grupos.length)return;
    const orden=[...grupos];
    [orden[indice],orden[destino]]=[orden[destino],orden[indice]];
    onSesion?.({...sesion,bloques:orden});
  }
  return <div className="min-w-0 space-y-5">
    {editable&&<div className="flex flex-wrap justify-end gap-2">{onEliminarDia&&<Button type="button" variant="outline" size="sm" className="text-destructive" disabled={bloqueado} onClick={onEliminarDia}><Trash2 />Eliminar día</Button>}{onDuplicar&&<Button type="button" variant="outline" size="sm" disabled={bloqueado||duplicarBloqueado} onClick={onDuplicar}><Copy />Duplicar día</Button>}<Button type="button" size="sm" disabled={bloqueado} onClick={()=>setNuevo(true)}><Plus />Nuevo bloque</Button></div>}
    {fases.map(fase=><section key={fase} aria-label={fase} className="space-y-3 rounded-2xl border border-border/60 p-4"><h3 className="border-b border-border/60 pb-3 text-sm font-medium">{fase}</h3>{sesion.activacion.filter(e=>(e.fase??"Activación")===fase).map((e,i)=>{const dosis=separarIndicacion(e.indicacion);const cambiar=(campos:Partial<typeof e>)=>onSesion?.({...sesion,activacion:sesion.activacion.map(v=>v.id===e.id?{...v,...campos}:v)});return <div key={e.id} className={`${fila} ${editable?"":"border-b border-foreground/20 pb-4 last:border-b-0 last:pb-0"}`}><div className="min-w-0 sm:self-end">{editable?<EjercicioCombobox className="h-9" value={e.nombre} onChange={nombre=>cambiar({nombre})} />:<p className="break-words text-base font-semibold text-foreground sm:pb-2">{e.nombre}</p>}</div><CamposDosis texto={unirDosis(dosis.series,dosis.repeticiones)} descanso={dosis.descanso} maxLength={240} etiqueta={`${fase.toLowerCase()} ${i+1}`} editable={editable} onChange={(texto,descanso)=>{const d=separarDosis(texto);cambiar({indicacion:unirIndicacion(d.series,d.repeticiones,descanso)});}} />{editable&&<Button type="button" size="icon-sm" variant="ghost" className="col-start-2 row-start-1 h-9 w-8 text-destructive sm:col-start-auto sm:row-start-auto sm:self-end" aria-label={`Quitar ${fase.toLowerCase()} ${i+1}`} onClick={()=>onSesion?.({...sesion,activacion:sesion.activacion.filter(v=>v.id!==e.id)})}><Trash2 /></Button>}</div>;})}{editable&&<div className="pt-2"><Button type="button" size="sm" variant="outline" disabled={bloqueado||sesion.activacion.length>=20} onClick={()=>onSesion?.({...sesion,activacion:[...sesion.activacion,{id:nuevoId(),nombre:"",indicacion:"3×8 · Descanso: 60 s",fase}]})}><Plus />Agregar ejercicio<span className="sr-only"> de {fase.toLowerCase()}</span></Button></div>}</section>)}
    {grupos.map((grupo,indice)=><section key={grupo} aria-label={`${sesion.actividadesBloques?.[grupo]??(sesion.tipo==="GYM"?"Fuerza":sesion.tipo)}, bloque ${indice+1}`} className="space-y-3 rounded-2xl border border-border/60 p-4" onDragOver={e=>{if(editable)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(!editable)return;const id=e.dataTransfer.getData("application/x-aktiv-ejercicio");if(sesion.ejercicios.some(v=>v.id===id))onEjercicio?.(id,{grupo});}}><div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3"><h3 className="text-sm font-medium">{sesion.actividadesBloques?.[grupo]??(sesion.tipo==="GYM"?"Fuerza":sesion.tipo)}</h3>{editable&&<div className="flex items-center"><Button type="button" variant="ghost" size="icon-sm" aria-label={`Subir bloque ${indice+1}`} disabled={bloqueado||indice===0} onClick={()=>moverBloque(indice,-1)}><ArrowUp /></Button><Button type="button" variant="ghost" size="icon-sm" aria-label={`Bajar bloque ${indice+1}`} disabled={bloqueado||indice===grupos.length-1} onClick={()=>moverBloque(indice,1)}><ArrowDown /></Button><Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Eliminar bloque ${indice+1}`} disabled={bloqueado} onClick={()=>setBorrarBloque(grupo)}><Trash2 /></Button></div>}</div>{sesion.ejercicios.filter(e=>e.grupo===grupo).sort((a,b)=>a.orden-b.orden).map(e=><div key={e.id} className={`${fila} ${editable?"":"border-b border-foreground/20 pb-4 last:border-b-0 last:pb-0"}`}><div className="flex min-w-0 items-center gap-1 sm:self-end">{editable&&<button type="button" draggable aria-label={`Mover ${e.nombre||"ejercicio"}`} title="Arrastrar a otro bloque. Flechas arriba y abajo para ordenar." className="rounded p-1 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring" onDragStart={v=>v.dataTransfer.setData("application/x-aktiv-ejercicio",e.id)} onKeyDown={v=>{if(v.key==="ArrowUp"||v.key==="ArrowDown"){v.preventDefault();mover(e.id,v.key==="ArrowUp"?-1:1);}}}><GripVertical className="size-4" /></button>}<div className="min-w-0 flex-1">{editable?<EjercicioCombobox className="h-9" value={e.nombre} onChange={nombre=>onEjercicio?.(e.id,{nombre})} />:<p className="break-words text-base font-semibold text-foreground sm:pb-2">{e.nombre}</p>}</div></div><CamposDosis texto={e.semanas.find(c=>c.semana===semana)?.prescripcion||prescripcionEfectiva(e.semanas,semana)} descanso={e.descanso} etiqueta={`${e.nombre||"ejercicio"}, semana ${semana}`} editable={editable} onChange={(prescripcion,descanso)=>onEjercicio?.(e.id,{descanso,semanas:e.semanas.map(c=>c.semana===semana?{...c,prescripcion}:c)})} />{editable&&<Button type="button" size="icon-sm" variant="ghost" className="col-start-2 row-start-1 h-9 w-8 text-destructive sm:col-start-auto sm:row-start-auto sm:self-end" aria-label={`Quitar ${e.nombre||"ejercicio"}`} disabled={bloqueado} onClick={()=>onQuitar?.(e.id)}><Trash2 /></Button>}</div>)}{editable&&<div className="pl-7 pt-2"><Button type="button" variant="outline" size="sm" disabled={bloqueado} onClick={()=>onAgregar?.(grupo)}><Plus />Agregar ejercicio<span className="sr-only"> al bloque {indice+1}</span></Button></div>}</section>)}
    {editable?<Textarea aria-label="Indicaciones generales (opcional)" placeholder="Indicaciones generales (opcional)" maxLength={4000} value={sesion.calentamiento} onChange={e=>onSesion?.({...sesion,calentamiento:e.target.value})} className="min-h-16" />:sesion.calentamiento&&<p className="whitespace-pre-wrap break-words rounded-xl border p-4 text-sm">{sesion.calentamiento}</p>}
    <Dialog open={borrarBloque!==null} onOpenChange={v=>{if(!v)setBorrarBloque(null);}}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>?Eliminar bloque?</DialogTitle><DialogDescription>Se quitar?n el bloque y sus ejercicios al guardar la rutina, incluidos sus registros de peso. Esta acci?n no se puede deshacer despu?s de guardar.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={()=>setBorrarBloque(null)}>Cancelar</Button><Button type="button" variant="destructive" onClick={()=>{if(borrarBloque===null)return;const actividades={...sesion.actividadesBloques};delete actividades[borrarBloque];onSesion?.({...sesion,bloques:grupos.filter(g=>g!==borrarBloque),ejercicios:sesion.ejercicios.filter(e=>e.grupo!==borrarBloque),actividadesBloques:actividades});setBorrarBloque(null);}}>Eliminar bloque</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={nuevo} onOpenChange={setNuevo}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Nuevo bloque</DialogTitle><DialogDescription className="sr-only">Elegí la actividad del bloque.</DialogDescription></DialogHeader><label className="space-y-2 text-sm"><span>Actividad</span><select aria-label="Tipo de actividad" className="h-10 w-full rounded-lg border bg-background px-3" value={actividad} onChange={e=>setActividad(e.target.value)}>{["Movilidad","Activación","Fuerza"].map(a=><option key={a} disabled={!primerBloqueLibre(sesion.ejercicios,sesion.bloques)}>{a}</option>)}</select></label><DialogFooter><Button type="button" disabled={!primerBloqueLibre(sesion.ejercicios,sesion.bloques)} onClick={crearBloque}>Crear</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
