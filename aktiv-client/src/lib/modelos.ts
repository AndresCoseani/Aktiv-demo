"use client";
import { useEffect, useRef, useState } from "react";
import { planModeloSchema, resumenModeloSchema, type Running, type PlanModelo, type ResumenModelo, type SesionEntrenamiento } from "@aktiv/contrato";
import { api } from "./api";
import { EVENTO_MENSUAL, EVENTO_RUNNING } from "./mensual";
import { useStore } from "./store";

export function useModelos(id: string | null) {
  const { session }=useStore();
  const [revision,setRevision]=useState(0);
  const confirmaciones=useRef(new Map<string,{version:number;sesion:SesionEntrenamiento}>());
  const version=useRef(0);
  const runningConfirmado=useRef(new Map<string,{version:number;running:Running}>());
  const [datos,setDatos]=useState<{usuario:string;lista:ResumenModelo[];modelo:PlanModelo|null;error:string|null}>({usuario:"",lista:[],modelo:null,error:null});
  useEffect(()=>{confirmaciones.current.clear();runningConfirmado.current.clear();},[id,session?.userId]);
  useEffect(()=>{
    const actualizar=(evento:Event)=>{
      const sesion=evento instanceof CustomEvent?(evento.detail as {sesion?:SesionEntrenamiento})?.sesion:undefined;
      if(!sesion){setRevision((v)=>v+1);return;}
      confirmaciones.current.set(sesion.id,{version:++version.current,sesion});
      // El editor ya confirmó estos datos: no descargar la biblioteca al escribir.
      setDatos((d)=>{
        if(!d.modelo?.sesiones.some((s)=>s.id===sesion.id))return d;
        const modelo={...d.modelo,sesiones:d.modelo.sesiones.map((s)=>s.id===sesion.id?sesion:s)};
        return {...d,modelo,lista:d.lista.map((p)=>p.id===modelo.id?{...p,tipos:[...new Set(modelo.sesiones.map((s)=>s.tipo))]}:p)};
      });
    };
    const alGuardarRunning=(e:Event)=>{const {planId,running}=(e as CustomEvent<{planId:string;running:Running}>).detail;runningConfirmado.current.set(planId,{version:++version.current,running});setDatos(d=>d.modelo?.id===planId?{...d,modelo:{...d.modelo,running},lista:d.lista.map(p=>p.id===planId?{...p,tipos:[...new Set([...p.tipos,"Running"])]}:p)}:d);};
    window.addEventListener(EVENTO_RUNNING,alGuardarRunning);
    window.addEventListener(EVENTO_MENSUAL,actualizar);
    return ()=>{window.removeEventListener(EVENTO_MENSUAL,actualizar);window.removeEventListener(EVENTO_RUNNING,alGuardarRunning);};
  },[]);
  useEffect(()=>{
    if(!session?.userId || session.role!=="coach")return;
    let vigente=true;
    const alLeer=version.current;
    Promise.all([api.get<unknown>("/planes-modelo"),id?api.get<unknown>(`/planes-modelo/${id}`):Promise.resolve(null)]).then(([lista,modelo])=>{
      const modeloValidado=modelo?planModeloSchema.parse(modelo):null;
      if(modeloValidado&&(runningConfirmado.current.get(modeloValidado.id)?.version??-1)>alLeer)modeloValidado.running=runningConfirmado.current.get(modeloValidado.id)!.running;
      if(modeloValidado)modeloValidado.sesiones=modeloValidado.sesiones.map((s)=>{
        const confirmada=confirmaciones.current.get(s.id);return confirmada&&confirmada.version>alLeer?confirmada.sesion:s;
      });
      if(vigente)setDatos({usuario:session.userId!,lista:resumenModeloSchema.array().parse(lista),modelo:modeloValidado,error:null});
    }).catch((e)=>{if(vigente)setDatos((d)=>({...d,usuario:session.userId!,error:e instanceof Error?e.message:"No pudimos cargar los modelos."}));});
    return ()=>{vigente=false;};
  },[session?.userId,session?.role,id,revision]);
  const coincide=datos.usuario===session?.userId;
  return {lista:coincide?datos.lista:[],modelo:coincide&&datos.modelo?.id===id?datos.modelo:null,error:coincide?datos.error:null,cargando:!coincide,reintentar:()=>setRevision((v)=>v+1)};
}
