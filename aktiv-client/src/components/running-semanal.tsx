"use client";
import {useCallback,useEffect,useRef,useState,type CSSProperties} from "react";
import {ArrowLeft,ArrowRight,Copy} from "lucide-react";
import {CAMPOS_RUNNING,DIAS_RUNNING,TIPOS_DIA_RUNNING,tipoDiaRunning,textoDiaRunning,DIAS_PLAN,guardarRunningApi,semanaDelPlan,type Running,type CampoRunning,type TipoDiaRunning} from "@aktiv/contrato";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {usePlanEditor} from "./plan-editor-context";
import {avisarCambioRunning,registrarBorradorMensual} from "@/lib/mensual";
import {hoyISO,formatFecha} from "@/lib/format";
import {toast} from "sonner";
type PlanRunning={id:string;semanas:number;inicio?:string;nombre?:string;running?:Running};
const nombreCampo=(campo:CampoRunning)=>campo==="volumen"?"Volumen semanal":campo==="sugerencias"?"Sugerencias":DIAS_PLAN[(CAMPOS_RUNNING as readonly string[]).indexOf(campo)];
function Celda({planId,semana,campo,valor,tipoValor,soloTexto=false,detalle=false,onGuardado,onPendiente}:{planId:string;semana:number;campo:CampoRunning;valor:string;tipoValor?:TipoDiaRunning;soloTexto?:boolean;detalle?:boolean;onGuardado:(s:number,c:CampoRunning,t:string)=>void;onPendiente:(id:string,pendiente:boolean)=>void}){
 const {api}=usePlanEditor(); const [texto,setTexto]=useState(valor);const [guardado,setGuardado]=useState(valor);const [ocupado,setOcupado]=useState(false);const [error,setError]=useState("");
 const esDia=!soloTexto&&(DIAS_RUNNING as readonly string[]).includes(campo);
 const [tipo,setTipo]=useState<TipoDiaRunning>(tipoValor??"Running");const [tipoGuardado,setTipoGuardado]=useState(tipoValor??"Running");
 const sucio=texto!==guardado||tipo!==tipoGuardado;const identidad=semana+":"+campo;
 useEffect(()=>{onPendiente(identidad,sucio||ocupado);return()=>onPendiente(identidad,false);},[identidad,sucio,ocupado,onPendiente]);
 useEffect(()=>{
  if(!sucio||ocupado||error)return;
  const timer=setTimeout(async()=>{
   const dto=guardarRunningApi.safeParse({semana,campo,texto});
   if(!dto.success){setError(dto.error.issues[0]?.message??"Revisá el texto.");return;}
   setOcupado(true);
   try{
    if(texto!==guardado){await api.patch("/planes-mensuales/"+planId+"/running",dto.data);setGuardado(texto);onGuardado(semana,campo,texto);}
    if(esDia&&tipo!==tipoGuardado){const modo={semana,campo:(campo+"_tipo") as CampoRunning,texto:tipo};await api.patch("/planes-mensuales/"+planId+"/running",guardarRunningApi.parse(modo));setTipoGuardado(tipo);onGuardado(semana,modo.campo,tipo);}
   }
   catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}finally{setOcupado(false);}
  },500);return()=>clearTimeout(timer);
 },[texto,guardado,sucio,ocupado,error,semana,campo,planId,api,onGuardado,tipo,tipoGuardado,esDia]);
 const label=nombreCampo(campo)+", semana "+semana;
 return <div className="min-w-0 space-y-2">{esDia&&<select aria-label={"Actividad de "+label} value={tipo} onChange={e=>{setTipo(e.target.value as TipoDiaRunning);setError("");}} className="w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm">{TIPOS_DIA_RUNNING.map(t=><option key={t}>{t}</option>)}</select>}{esDia&&tipo!=="Running"?<p className="rounded-md bg-muted/30 px-3 py-4 text-sm font-semibold text-muted-foreground">{tipo}<span className="mt-1 block text-xs font-normal">Sin running</span></p>:campo==="volumen"?<div className="flex items-center gap-2"><Input aria-label={label} inputMode="decimal" maxLength={7} value={texto} placeholder="Sin cargar" onChange={e=>{setTexto(e.target.value);setError("");}} /><span className="text-sm text-muted-foreground">km</span></div>:<Textarea rows={1} autoFocus={detalle} aria-label={label} value={texto} maxLength={4000} placeholder={campo==="sugerencias"?"Indicaciones para esta semana…":soloTexto?"Escribe aquí…":"Sin cargar"} onChange={e=>{setTexto(e.target.value);setError("");}} className={detalle?"min-h-56 max-h-[60dvh] field-sizing-content overflow-y-auto resize-y text-base leading-relaxed":"min-h-10 field-sizing-content resize-y border-transparent bg-transparent text-base leading-relaxed shadow-none focus-visible:border-primary"} />}{error?<div role="alert" className="space-y-1 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" onClick={()=>setError("")}>Reintentar guardado</Button></div>:(ocupado||sucio)?<span role="status" className="block text-xs text-muted-foreground">{ocupado?"Guardando…":"Cambios pendientes"}</span>:null}</div>;
}
export function RunningSemanal({plan,editable=false,semanaInicial,onDatos}:{plan:PlanRunning;editable?:boolean;semanaInicial?:number;onDatos?:(datos:Running)=>void}){
 const {api}=usePlanEditor();
 const [semana,setSemana]=useState(semanaInicial??(plan.inicio?semanaDelPlan(plan.inicio,hoyISO(),plan.semanas):null)??1);
 const [datos,setDatos]=useState<Running>(plan.running??{});const [pendientes,setPendientes]=useState<Record<string,boolean>>({});
 const [copiar,setCopiar]=useState(false);const [origen,setOrigen]=useState(1);const [destino,setDestino]=useState(Math.min(2,plan.semanas));const [ocupado,setOcupado]=useState(false);const [error,setError]=useState("");const [version,setVersion]=useState(0);
 const editado=useRef(false);
 const pendiente=Object.values(pendientes).some(Boolean)||ocupado;
 useEffect(()=>{onDatos?.(datos);if(editado.current)avisarCambioRunning(plan.id,datos);},[datos,onDatos,plan.id]);
 const onPendiente=useCallback((id:string,valor:boolean)=>setPendientes(prev=>prev[id]===valor?prev:{...prev,[id]:valor}),[]);
 const onGuardado=useCallback((s:number,c:CampoRunning,t:string)=>{editado.current=true;setDatos(prev=>({...prev,[s]:{...prev[s],[c]:t}}));},[]);
 useEffect(()=>registrarBorradorMensual("running:"+plan.id,pendiente),[plan.id,pendiente]);
 useEffect(()=>{
  if(!pendiente)return;
  const salir=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
  const navegar=(e:MouseEvent)=>{if(e.target instanceof Element&&e.target.closest("a[href],[role=tab]")){e.preventDefault();e.stopPropagation();toast.error("Esperá a que se guarde Running antes de salir.");}};
  window.addEventListener("beforeunload",salir);document.addEventListener("click",navegar,true);
  return()=>{window.removeEventListener("beforeunload",salir);document.removeEventListener("click",navegar,true);};
 },[pendiente]);
 const seleccionar=(s:number)=>{if(pendiente){toast.error("Esperá a que se guarden los cambios.");return;}setSemana(s);};
 const diaHoy=(new Date(hoyISO()+"T12:00:00Z").getUTCDay()+6)%7;
 const semanaHoy=plan.inicio?semanaDelPlan(plan.inicio,hoyISO(),plan.semanas):null;
 const desde=Math.floor((semana-1)/4)*4+1;const columnas=Array.from({length:Math.min(4,plan.semanas-desde+1)},(_,i)=>desde+i);
 async function confirmarCopia(){
  setOcupado(true);setError("");try{await api.post("/planes-mensuales/"+plan.id+"/running/copiar",{origen,destino});editado.current=true;setDatos(prev=>({...prev,[destino]:structuredClone(prev[origen]??{})}));setVersion(v=>v+1);setSemana(destino);setCopiar(false);toast.success("Semana copiada");}catch(e){setError(e instanceof Error?e.message:"No se pudo copiar.");}finally{setOcupado(false);}
 }
 return <section aria-label="Planilla de Running" className="min-w-0 space-y-5">
 <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">Running · Planificación semanal</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{plan.nombre&&<span>{plan.nombre} · </span>}{editable?"Elegí Running para escribir la sesión, o GYM y Descanso para los días sin carrera.":"Las indicaciones de tu profe, día por día."}</p></div>{editable&&plan.semanas>1&&<Button variant="outline" disabled={pendiente} onClick={()=>{setOrigen(semana);setDestino(semana===plan.semanas?1:semana+1);setError("");setCopiar(true);}}><Copy />Copiar semana</Button>}</header>
 <p role="status" className="text-sm text-muted-foreground">{editable?(pendiente?"Hay cambios de Running pendientes de guardar":"Guardado automáticamente"):"Solo lectura"}</p>
 <div className="flex flex-wrap items-center justify-between gap-3 md:hidden"><Button variant="outline" size="icon-sm" aria-label="Semana anterior de Running" disabled={semana===1||pendiente} onClick={()=>seleccionar(semana-1)}><ArrowLeft /></Button><label className="flex items-center gap-2 text-sm font-medium">Semana<select aria-label="Semana de Running" value={semana} disabled={pendiente} onChange={e=>seleccionar(Number(e.target.value))} className="rounded-lg border bg-background px-3 py-2">{Array.from({length:plan.semanas},(_,i)=><option key={i} value={i+1}>{i+1} de {plan.semanas}</option>)}</select></label><Button variant="outline" size="icon-sm" aria-label="Semana siguiente de Running" disabled={semana===plan.semanas||pendiente} onClick={()=>seleccionar(semana+1)}><ArrowRight /></Button></div>
 {plan.semanas>4&&<div className="hidden items-center justify-between gap-3 md:flex"><Button variant="outline" size="icon-sm" aria-label="Grupo anterior de Running" disabled={desde===1||pendiente} onClick={()=>seleccionar(desde-4)}><ArrowLeft /></Button><label className="flex items-center gap-2 text-sm">Semanas<select aria-label="Grupo de semanas de Running" value={desde} disabled={pendiente} onChange={e=>seleccionar(Number(e.target.value))} className="rounded-lg border bg-background px-3 py-2">{Array.from({length:Math.ceil(plan.semanas/4)},(_,i)=>{const d=i*4+1;return <option key={d} value={d}>{d}–{Math.min(d+3,plan.semanas)} de {plan.semanas}</option>;})}</select></label><Button variant="outline" size="icon-sm" aria-label="Grupo siguiente de Running" disabled={desde+4>plan.semanas||pendiente} onClick={()=>seleccionar(desde+4)}><ArrowRight /></Button></div>}
 <div className="max-w-full overflow-x-auto rounded-xl border"><div className="min-w-0 md:min-w-[760px]" style={{"--columnas":columnas.length} as CSSProperties}>
 <div className="hidden bg-primary/15 md:grid md:grid-cols-[140px_repeat(var(--columnas),minmax(0,1fr))]"><div className="p-4 font-semibold">Día</div>{columnas.map(s=><div key={s} className={"border-l p-4 text-center font-semibold "+(s===semana?"text-primary":"")}>Semana {s}{plan.inicio&&<span className="mt-1 block text-xs font-normal text-muted-foreground">{formatFecha(new Date(Date.parse(plan.inicio+"T12:00:00Z")+(s-1)*7*86400000).toISOString().slice(0,10))}</span>}</div>)}</div>
 {CAMPOS_RUNNING.map((campo,i)=><div key={campo} className={"border-t first:border-t-0 md:grid md:grid-cols-[140px_repeat(var(--columnas),minmax(0,1fr))] "+(campo==="volumen"?"bg-primary/10":i%2?"bg-card":"bg-muted/30")}><div className="min-w-0 break-words px-4 pt-4 text-sm font-semibold md:py-5">{nombreCampo(campo)}{i===diaHoy&&semanaHoy===semana&&<span className="mt-1 block text-xs font-medium text-primary">Hoy</span>}</div>{columnas.map(s=><div key={s} className={(s===semana?"block":"hidden md:block")+" min-w-0 px-3 py-3 md:border-l"}>{editable?<Celda key={version+":"+s+":"+campo} planId={plan.id} semana={s} campo={campo} valor={datos[s]?.[campo]??""} tipoValor={tipoDiaRunning(datos[s],campo)} onGuardado={onGuardado} onPendiente={onPendiente} />:<p className="whitespace-pre-wrap break-words text-base leading-7">{((DIAS_RUNNING as readonly string[]).includes(campo)?textoDiaRunning(datos[s],campo):datos[s]?.[campo])?.trim()?((DIAS_RUNNING as readonly string[]).includes(campo)?textoDiaRunning(datos[s],campo):datos[s]?.[campo])+(campo==="volumen"?" km":""):<span className="text-sm text-muted-foreground">Sin cargar</span>}</p>}</div>)}</div>)}
 </div></div>
 <p className="text-sm leading-relaxed text-muted-foreground">{editable?"El volumen se carga manualmente; no se calcula interpretando las indicaciones. Los campos vacíos no heredan otra semana.":"Si un día dice Sin cargar, tu profe todavía no dejó una indicación. No significa Descanso."}</p>
 <Dialog open={copiar} onOpenChange={v=>{if(!ocupado)setCopiar(v);}}><DialogContent><DialogTitle>Copiar semana de Running</DialogTitle><DialogDescription>Reemplaza los siete días, el volumen y las sugerencias de la semana de destino. El origen se conserva.</DialogDescription><fieldset disabled={ocupado} className="space-y-4">{[["Semana de origen",origen,setOrigen],["Semana de destino",destino,setDestino]].map(([titulo,valor,cambiar])=><label key={String(titulo)} className="block space-y-2"><span>{String(titulo)}</span><select aria-label={String(titulo)} className="w-full rounded-lg border bg-background p-2" value={valor as number} onChange={e=>(cambiar as (n:number)=>void)(Number(e.target.value))}>{Array.from({length:plan.semanas},(_,i)=><option key={i} value={i+1}>Semana {i+1}</option>)}</select></label>)}</fieldset>{error&&<p role="alert" className="text-destructive">{error}</p>}<DialogFooter><Button variant="ghost" disabled={ocupado} onClick={()=>setCopiar(false)}>Cancelar</Button><Button disabled={ocupado||origen===destino} onClick={()=>void confirmarCopia()}>{ocupado?"Copiando…":"Reemplazar semana de destino"}</Button></DialogFooter></DialogContent></Dialog>
 </section>;
}

export { Celda as CeldaRunning };
