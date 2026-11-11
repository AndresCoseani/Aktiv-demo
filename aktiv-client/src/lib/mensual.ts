"use client";

import { useEffect, useRef, useState } from "react";
import { planesMensualesRespuesta, type Distribucion, type Running, type PlanMensual, type SesionEntrenamiento } from "@aktiv/contrato";
import { api } from "./api";
import { useStore } from "./store";

export const EVENTO_DISTRIBUCION="aktiv:distribucion-confirmada";
export function avisarCambioDistribucion(planId:string,distribucion:Distribucion){window.dispatchEvent(new CustomEvent(EVENTO_DISTRIBUCION,{detail:{planId,distribucion}}));}
export const EVENTO_RUNNING="aktiv:running-confirmado";
export function avisarCambioRunning(planId:string,running:Running){window.dispatchEvent(new CustomEvent(EVENTO_RUNNING,{detail:{planId,running}}));}
export const EVENTO_MENSUAL = "aktiv:planes-mensuales";
export function avisarCambioMensual(sesion?: SesionEntrenamiento) {
  window.dispatchEvent(new CustomEvent(EVENTO_MENSUAL, { detail: { sesion } }));
}
const borradores = new Set<string>();
export function hayBorradoresMensuales() { return borradores.size > 0; }
export function registrarBorradorMensual(id: string, sucio: boolean) {
  if (sucio) borradores.add(id); else borradores.delete(id);
  return () => { borradores.delete(id); };
}

/** Lectura independiente del store optimista: los cambios mensuales se confirman al guardar. */
export function usePlanesMensuales(alumnoId?: string) {
  const { session } = useStore();
  const identidad = `${session?.userId ?? ""}:${alumnoId ?? ""}`;
  const [revision, setRevision] = useState(0);
  const confirmaciones = useRef(new Map<string, { version: number; sesion: SesionEntrenamiento }>());
  const versionConfirmada = useRef(0);
  const distribucionConfirmada=useRef(new Map<string,{version:number;distribucion:Distribucion}>());
  const runningConfirmado=useRef(new Map<string,{version:number;running:Running}>());
  const [estado, setEstado] = useState<{ identidad: string; planes: PlanMensual[]; error: string | null }>({ identidad: "", planes: [], error: null });
  useEffect(() => {
    confirmaciones.current.clear(); runningConfirmado.current.clear();distribucionConfirmada.current.clear();
    const alAsignar=(e:Event)=>{const {planId,distribucion}=(e as CustomEvent<{planId:string;distribucion:Distribucion}>).detail;distribucionConfirmada.current.set(planId,{version:++versionConfirmada.current,distribucion});setEstado(prev=>({...prev,planes:prev.planes.map(p=>p.id===planId?{...p,distribucion}:p)}));};
    window.addEventListener(EVENTO_DISTRIBUCION,alAsignar);
    const alGuardarRunning=(e:Event)=>{const {planId,running}=(e as CustomEvent<{planId:string;running:Running}>).detail;runningConfirmado.current.set(planId,{version:++versionConfirmada.current,running});setEstado(prev=>({...prev,planes:prev.planes.map(p=>p.id===planId?{...p,running}:p)}));};
    window.addEventListener(EVENTO_RUNNING,alGuardarRunning);
    const refrescar = (evento?: Event) => {
      const sesion = evento instanceof CustomEvent ? (evento.detail as { sesion?: SesionEntrenamiento } | undefined)?.sesion : undefined;
      if (!sesion) { setRevision((v) => v + 1); return; }
      confirmaciones.current.set(sesion.id, { version: ++versionConfirmada.current, sesion });
      // El editor ya confirmó esta sesión: no volver a descargar todas las semanas.
      setEstado((anterior) => {
        if (!anterior.planes.some((p) => p.sesiones.some((s) => s.id === sesion.id))) return anterior;
        return { ...anterior, planes: anterior.planes.map((p) => ({ ...p, sesiones: p.sesiones.map((s) => s.id === sesion.id ? sesion : s) })) };
      });
    };
    const alVolver = () => { if (document.visibilityState === "visible") refrescar(); };
    window.addEventListener(EVENTO_MENSUAL, refrescar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener(EVENTO_DISTRIBUCION,alAsignar);window.removeEventListener(EVENTO_MENSUAL, refrescar); window.removeEventListener(EVENTO_RUNNING,alGuardarRunning);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [identidad]);
  useEffect(() => {
    if (!alumnoId || !session?.userId) return;
    let vigente = true;
    const versionAlLeer = versionConfirmada.current;
    api.get<unknown>(`/alumnos/${alumnoId}/planes-mensuales`).then((r) => {
      const planes = planesMensualesRespuesta.parse(r).map((p) => ({ ...p, distribucion:(distribucionConfirmada.current.get(p.id)?.version??-1)>versionAlLeer?distribucionConfirmada.current.get(p.id)!.distribucion:p.distribucion, running:(runningConfirmado.current.get(p.id)?.version ?? -1)>versionAlLeer?runningConfirmado.current.get(p.id)!.running:p.running, sesiones: p.sesiones.map((s) => {
        const confirmada = confirmaciones.current.get(s.id);
        return confirmada && confirmada.version > versionAlLeer ? confirmada.sesion : s;
      }) }));
      if (vigente) setEstado({ identidad, planes, error: null });
    }).catch((e: unknown) => {
      if (vigente) setEstado({ identidad, planes: [], error: e instanceof Error ? e.message : "No pudimos cargar el plan mensual." });
    });
    return () => { vigente = false; };
  }, [alumnoId, session?.userId, identidad, revision]);
  const coincide = estado.identidad === identidad;
  return {
    planes: coincide ? estado.planes : [],
    cargando: Boolean(alumnoId && session?.userId && !coincide),
    error: coincide ? estado.error : null,
    reintentar: () => setRevision((v) => v + 1),
  };
}
