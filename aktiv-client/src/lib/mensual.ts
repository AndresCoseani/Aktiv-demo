"use client";

import { useEffect, useRef, useState } from "react";
import { planesMensualesRespuesta, type PlanMensual, type SesionEntrenamiento } from "@aktiv/contrato";
import { api } from "./api";
import { useStore } from "./store";

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
  const [estado, setEstado] = useState<{ identidad: string; planes: PlanMensual[]; error: string | null }>({ identidad: "", planes: [], error: null });
  useEffect(() => {
    confirmaciones.current.clear();
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
      window.removeEventListener(EVENTO_MENSUAL, refrescar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [identidad]);
  useEffect(() => {
    if (!alumnoId || !session?.userId) return;
    let vigente = true;
    const versionAlLeer = versionConfirmada.current;
    api.get<unknown>(`/alumnos/${alumnoId}/planes-mensuales`).then((r) => {
      const planes = planesMensualesRespuesta.parse(r).map((p) => ({ ...p, sesiones: p.sesiones.map((s) => {
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
