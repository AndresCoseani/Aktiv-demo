"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Activity, ArrowLeft, ArrowRight, BedDouble, Dumbbell, Footprints } from "lucide-react";
import { toast } from "sonner";
import { actividadesDelDia, actualizarDistribucion, asignarDiaApi, DIAS_PLAN, DIAS_RUNNING, semanaDelPlan, type ActividadDia, type Distribucion, type PlanMensual, type Running, type SesionEntrenamiento } from "@aktiv/contrato";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { CeldaRunning } from "./running-semanal";
import { useActividadesPlan } from "./actividades-plan";
import { usePlanEditor } from "./plan-editor-context";
import { avisarCambioDistribucion, avisarCambioRunning, hayBorradoresMensuales, registrarBorradorMensual } from "@/lib/mensual";
import { formatFecha, hoyISO } from "@/lib/format";

type Plan = Pick<PlanMensual,"id"|"semanas"|"sesiones"|"running"|"distribucion"> & {inicio?:string;nombre?:string};
type Props = {plan:Plan;editable:boolean;renderRutina:(s:SesionEntrenamiento,semana:number,cerrar:()=>void)=>ReactNode};
const textoError=(e:unknown)=>e instanceof Error?e.message:"No se pudo guardar. Reintentá.";
const tipoVisual=(tipo:string)=>tipo.trim().toLocaleLowerCase("es")==="gym"?"Fuerza":tipo;
const icono=(tipo:string)=>tipo==="Running"?Footprints:tipo==="Fuerza"||tipo==="GYM"?Dumbbell:tipo==="Descanso"?BedDouble:Activity;
const numeroRutina=(p:Plan,s:SesionEntrenamiento)=>p.sesiones.filter(v=>v.tipo===s.tipo).findIndex(v=>v.id===s.id)+1;
const nombreRutina=(p:Plan,s:SesionEntrenamiento)=>`${s.tipo} · Día ${numeroRutina(p,s)}`;
const selector="w-full min-w-0 rounded-lg border border-input bg-background px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function Asignador({valor,sesiones,label,onGuardar,onPendiente,soloRutina=false,mostrarRutina=true,disabled=false}:{valor:ActividadDia[];tipos:string[];sesiones:SesionEntrenamiento[];label:string;onGuardar:(a:ActividadDia[])=>Promise<void>;onPendiente:(id:string,v:boolean)=>void;soloRutina?:boolean;mostrarRutina?:boolean;disabled?:boolean}) {
 const [lista,setLista]=useState(valor),[guardada,setGuardada]=useState(JSON.stringify(valor)),[ocupado,setOcupado]=useState(false),[error,setError]=useState("");
 const serial=JSON.stringify(valor),sucio=JSON.stringify(lista)!==guardada;
 if(!sucio&&!ocupado&&serial!==guardada){setLista(JSON.parse(serial));setGuardada(serial);}
 const controlId=(soloRutina?"rutina:":"actividad:")+label;
 const anteriores=useRef<ActividadDia[]>(valor.filter(a=>a.tipo!=="Descanso"));
 const descansa=lista.length>0&&lista.every(a=>a.tipo==="Descanso");
 useEffect(()=>{onPendiente(controlId,sucio||ocupado);return()=>onPendiente(controlId,false);},[controlId,sucio,ocupado,onPendiente]);
 useEffect(()=>{
  if(!sucio||ocupado||error)return;
  const timer=setTimeout(async()=>{setOcupado(true);try{await onGuardar(lista);setGuardada(JSON.stringify(lista));}catch(e){setError(textoError(e));}finally{setOcupado(false);}},400);
  return()=>clearTimeout(timer);
 },[lista,sucio,ocupado,error,onGuardar]);
 function actualizar(nueva:ActividadDia[]){onPendiente(controlId,JSON.stringify(nueva)!==guardada);setLista(nueva);setError("");}
 function cambiar(i:number,a:ActividadDia){actualizar(lista.map((actual,n)=>n===i?a:actual));}
 return <div className="min-w-0 space-y-2">
  {!soloRutina&&<><div className="flex min-w-0 items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{label.includes(",")?"Entrenamiento":label.slice(0,3)}</span><Switch size="sm" aria-label={`Entrena el ${label}`} checked={!descansa} disabled={disabled} onCheckedChange={entrena=>{if(entrena)actualizar(anteriores.current.filter(a=>sesiones.some(s=>s.id===a.sesionId)||!a.sesionId));else{anteriores.current=lista.filter(a=>a.tipo!=="Descanso");actualizar([{tipo:"Descanso"}]);}}} /></div>
   <div role="group" aria-label={`Actividades de ${label}`} className="flex min-h-24 flex-col items-center justify-center gap-2">
    {descansa?<div role="status" aria-label={`Descanso de ${label}`} className="flex size-14 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground"><BedDouble aria-hidden="true" className="size-6" /><span className="sr-only">Descanso</span></div>:[...new Set(["Fuerza","Running",...lista.map(a=>a.tipo)].map(tipoVisual))].filter(t=>t!=="Descanso").map(tipo=>{const activo=lista.some(a=>tipoVisual(a.tipo)===tipo),Icono=icono(tipo);return <Button key={tipo} type="button" variant="ghost" aria-label={`${tipo} de ${label}`} title={tipo} aria-pressed={activo} disabled={disabled||(!activo&&lista.length>=8)} className={`h-9 w-12 shrink-0 rounded-lg border p-0 transition-colors ${activo?"border-primary/35 bg-primary/10 text-primary":"border-border/70 bg-muted/25 text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground"}`} onClick={()=>actualizar(activo?lista.filter(a=>tipoVisual(a.tipo)!==tipo):[...lista.filter(a=>a.tipo!=="Descanso"),{tipo}])}><Icono aria-hidden="true" className="size-5" /></Button>;})}
   </div>
  </>}
  {mostrarRutina&&lista.map((a,i)=>!["Running","Descanso"].includes(a.tipo)&&<select key={a.sesionId??a.tipo+i} disabled={disabled} aria-label={`Rutina de ${tipoVisual(a.tipo)} para ${label}`} className={selector} value={a.sesionId??""} onChange={e=>{const sesion=sesiones.find(s=>s.id===e.target.value);cambiar(i,{tipo:sesion?.tipo??a.tipo,...(sesion?{sesionId:sesion.id}:{})});}}>
   <option value="">Sin asignar</option>{sesiones.filter(s=>tipoVisual(s.tipo)===tipoVisual(a.tipo)).map((s,n)=><option key={s.id} value={s.id}>{s.nombre||`${tipoVisual(s.tipo)} · Día ${n+1}`}</option>)}
  </select>)}
  {error?<div role="alert" className="space-y-1 text-xs text-destructive"><p>{error}</p><Button size="sm" variant="outline" onClick={()=>setError("")}>Reintentar asignación</Button></div>:sucio||ocupado?<p role="status" className="text-xs text-muted-foreground">Guardando asignación…</p>:null}
 </div>;
}

export function PlanificacionUnificada({plan,editable,renderRutina}:Props) {
 const {api}=usePlanEditor();const {actividades,error:errorActividades}=useActividadesPlan(editable);
 const [distribucion,setDistribucion]=useState<Distribucion>(plan.distribucion??{}),[running,setRunning]=useState<Running>(plan.running??{});
 const [semana,setSemana]=useState(()=>plan.inicio?(semanaDelPlan(plan.inicio,hoyISO(),plan.semanas)??1):1);
 const [fuente,setFuente]=useState({distribucion:plan.distribucion,running:plan.running});
 if(fuente.distribucion!==plan.distribucion||fuente.running!==plan.running){setFuente({distribucion:plan.distribucion,running:plan.running});setDistribucion(plan.distribucion??{});setRunning(plan.running??{});}
 const [pendientes,setPendientes]=useState<Record<string,boolean>>({});const [rutina,setRutina]=useState<{id:string;semana:number}|null>(null);
 const ocupado=false,version=0;
 const edicionDist=useRef(false),edicionRunning=useRef(false);
 useEffect(()=>{if(edicionDist.current)avisarCambioDistribucion(plan.id,distribucion);},[plan.id,distribucion]);
 useEffect(()=>{if(edicionRunning.current)avisarCambioRunning(plan.id,running);},[plan.id,running]);
 const tipos=[...new Set([...actividades,...plan.sesiones.map(s=>s.tipo),"Descanso"])];
 const actual=plan.inicio?semanaDelPlan(plan.inicio,hoyISO(),plan.semanas):null;
 const desde=Math.floor((semana-1)/4)*4+1,columnas=Array.from({length:Math.min(4,plan.semanas-desde+1)},(_,i)=>desde+i);
 const datos={...plan,distribucion,running};const pendiente=ocupado||Object.values(pendientes).some(Boolean);
 const onPendiente=useCallback((id:string,v:boolean)=>setPendientes(p=>p[id]===v?p:{...p,[id]:v}),[]);
 useEffect(()=>registrarBorradorMensual(`planificacion:${plan.id}`,pendiente),[plan.id,pendiente]);
 useEffect(()=>{if(!pendiente)return;const salir=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",salir);return()=>window.removeEventListener("beforeunload",salir);},[pendiente]);
 function navegar(accion:()=>void){if(hayBorradoresMensuales())toast.error("Esperá a que se guarden los cambios.");else accion();}
 async function asignar(dia:number,a:ActividadDia[],s?:number){const dto=asignarDiaApi.parse({dia,actividades:a,...(s?{semana:s}:{})});await api.patch(`/planes-mensuales/${plan.id}/distribucion`,dto);edicionDist.current=true;setDistribucion(prev=>actualizarDistribucion(prev,dto));}
 const alGuardarRunning=useCallback((s:number,campo:Parameters<typeof CeldaRunning>[0]["campo"],texto:string)=>{edicionRunning.current=true;setRunning(prev=>{const siguiente={...prev,[s]:{...prev[s],[campo]:texto}};return siguiente;});},[]);
 const abierta=plan.sesiones.find(s=>s.id===rutina?.id);
 return <section aria-label="Planificación unificada" className="min-w-0 space-y-5">
  <div className="space-y-3 rounded-xl border border-primary/20 p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 aria-label="Actividades de la semana" className="text-base font-medium tracking-tight">Semana</h3></div></div>
   {errorActividades&&editable&&<p role="alert" className="text-sm text-destructive">{errorActividades}</p>}
   <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-7">{DIAS_PLAN.map((dia,i)=><section key={dia} aria-label={`Asignación de ${dia}`} className="w-28 min-w-0 shrink-0 rounded-xl border border-border/70 p-3 lg:w-auto">{!editable&&<h4 className="text-xs font-medium text-muted-foreground">{dia.slice(0,3)}</h4>}{editable?<Asignador mostrarRutina={false} disabled={pendiente&&!pendientes["actividad:"+dia]} valor={distribucion.base?.[i+1]??actividadesDelDia({...plan,distribucion:{}},i+1,1)} tipos={tipos} sesiones={plan.sesiones} label={dia} onPendiente={onPendiente} onGuardar={a=>asignar(i+1,a)} />:<p className="break-words text-sm text-muted-foreground">{actividadesDelDia(datos,i+1,semana).map(a=>a.tipo).join(" + ")||"Sin asignar"}</p>}{Object.values(distribucion.semanas??{}).some(d=>d[i+1]!==undefined)&&<p className="text-xs text-primary">Varía por semana</p>}</section>)}</div>
  </div>
  {pendiente&&<p role="status" className="sr-only">Hay cambios pendientes de guardar</p>}
  <div className="flex items-center justify-between gap-3 md:hidden"><Button variant="outline" size="icon-sm" aria-label="Semana anterior de planificación" disabled={pendiente||semana===1} onClick={()=>navegar(()=>setSemana(s=>s-1))}><ArrowLeft /></Button><label className="flex items-center gap-2 text-sm">Semana<select className={selector} aria-label="Semana de planificación" value={semana} disabled={pendiente} onChange={e=>navegar(()=>setSemana(Number(e.target.value)))}>{Array.from({length:plan.semanas},(_,i)=><option key={i} value={i+1}>{i+1} de {plan.semanas}</option>)}</select></label><Button variant="outline" size="icon-sm" aria-label="Semana siguiente de planificación" disabled={pendiente||semana===plan.semanas} onClick={()=>navegar(()=>setSemana(s=>s+1))}><ArrowRight /></Button></div>
  {plan.semanas>4&&<div className="hidden items-center justify-between md:flex"><Button variant="outline" size="sm" disabled={pendiente||desde===1} onClick={()=>navegar(()=>setSemana(desde-4))}><ArrowLeft />Anteriores</Button><span className="text-sm">Semanas {desde}–{columnas.at(-1)} de {plan.semanas}</span><Button variant="outline" size="sm" disabled={pendiente||desde+4>plan.semanas} onClick={()=>navegar(()=>setSemana(desde+4))}>Siguientes<ArrowRight /></Button></div>}
  <div className="max-w-full overflow-x-auto rounded-xl border" style={{"--semanas":columnas.length} as CSSProperties}>
   <div className="hidden grid-cols-[160px_repeat(var(--semanas),minmax(0,1fr))] bg-card md:grid"><div className="p-4 text-sm font-semibold text-primary">{plan.nombre}</div>{columnas.map(s=><div key={s} className={`border-l p-4 text-center ${actual===s?"bg-primary/15 text-primary":""}`}><p className="text-sm font-semibold">Semana {s}</p>{plan.inicio&&<p className="mt-1 text-xs text-muted-foreground">{formatFecha(new Date(Date.parse(plan.inicio+"T12:00:00Z")+(s-1)*7*86400000).toISOString().slice(0,10))} – {formatFecha(new Date(Date.parse(plan.inicio+"T12:00:00Z")+((s-1)*7+6)*86400000).toISOString().slice(0,10))}</p>}</div>)}</div>
   {DIAS_PLAN.map((dia,i)=><div key={dia} className="border-t bg-card/30 md:grid md:grid-cols-[160px_repeat(var(--semanas),minmax(0,1fr))]"><div className="space-y-2 bg-card p-3 md:p-4"><h4 className="flex items-center gap-2 text-sm font-medium"><span>{dia.slice(0,3)}</span>{actividadesDelDia(datos,i+1,semana).filter(a=>a.tipo!=="Descanso").map((a,n)=>{const Icono=icono(a.tipo);return <Icono key={n} aria-label={tipoVisual(a.tipo)} className="size-4 text-primary" />;})}</h4>{editable&&(distribucion.base?.[i+1]??actividadesDelDia({...plan,distribucion:{}},i+1,1)).some(a=>!["Running","Descanso"].includes(a.tipo))&&<Asignador soloRutina disabled={pendiente&&!pendientes["rutina:"+dia]} valor={distribucion.base?.[i+1]??actividadesDelDia({...plan,distribucion:{}},i+1,1)} tipos={tipos} sesiones={plan.sesiones} label={dia} onPendiente={onPendiente} onGuardar={a=>asignar(i+1,a)} />}</div>{columnas.map(s=>{const a=actividadesDelDia(datos,i+1,s);return <div key={s} className={(s===semana?"block":"hidden md:block")+" min-w-0 space-y-3 p-3 md:border-l"}>
    {a.length?a.map((v,n)=>{const sesion=plan.sesiones.find(r=>r.id===v.sesionId);return <div key={v.sesionId??v.tipo+n} className="min-w-0">
     {v.tipo==="Running"&&!sesion?<div className="space-y-2">{editable?<CeldaRunning key={`${version}:${s}:${i}`} soloTexto planId={plan.id} semana={s} campo={DIAS_RUNNING[i]} valor={running[s]?.[DIAS_RUNNING[i]]??""} onGuardado={alGuardarRunning} onPendiente={onPendiente} />:<p className="whitespace-pre-wrap break-words text-sm leading-6">{running[s]?.[DIAS_RUNNING[i]]||"Sin cargar"}</p>}</div>:sesion?<Button className="h-auto w-full min-w-0 justify-center whitespace-normal rounded-xl border-primary/25 bg-primary/5 p-3 text-left hover:bg-primary/10" aria-label={`Abrir ${nombreRutina(plan,sesion)}, ${dia}, semana ${s}`} onClick={()=>navegar(()=>setRutina({id:sesion.id,semana:s}))}><span className="block min-w-0 break-words text-sm font-medium">{sesion.nombre||nombreRutina(plan,sesion)}</span></Button>:<div className="flex min-h-16 items-center justify-center text-muted-foreground">{v.tipo==="Descanso"?<BedDouble aria-label="Descanso" className="size-7" />:<span className="text-sm">Sin asignar</span>}</div>}
    </div>;}):<p className="py-3 text-sm text-muted-foreground">Sin asignar</p>}

   </div>;})}</div>)}
   {(["volumen","sugerencias"] as const).map(campo=><div key={campo} className="border-t bg-muted/20 md:grid md:grid-cols-[160px_repeat(var(--semanas),minmax(0,1fr))]"><h4 className="min-w-0 break-words p-4 text-sm font-semibold">{campo==="volumen"?"Volumen":"Sugerencias"}</h4>{columnas.map(s=><div key={s} className={(s===semana?"block":"hidden md:block")+" min-w-0 p-3 md:border-l"}>{campo==="volumen"&&!DIAS_PLAN.some((_,i)=>actividadesDelDia(datos,i+1,s).some(a=>a.tipo==="Running"))?<p className="py-2 text-sm text-muted-foreground">—</p>:editable?<CeldaRunning key={`${version}:${s}:${campo}`} soloTexto planId={plan.id} semana={s} campo={campo} valor={running[s]?.[campo]??""} onGuardado={alGuardarRunning} onPendiente={onPendiente} />:<p className="whitespace-pre-wrap break-words text-sm">{running[s]?.[campo]?(running[s]?.[campo]+(campo==="volumen"?" km":"")):"—"}</p>}</div>)}</div>)}
  </div>
  {abierta&&rutina&&renderRutina(abierta,rutina.semana,()=>setRutina(null))}
 </section>;
}
