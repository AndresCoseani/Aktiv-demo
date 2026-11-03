"use client";

import { useEffect, useState } from "react";
import { planesMensualesRespuesta, type PlanMensual } from "@aktiv/contrato";
import { api } from "./api";
import { useStore } from "./store";

export const EVENTO_MENSUAL = "aktiv:planes-mensuales";
export function avisarCambioMensual() { window.dispatchEvent(new Event(EVENTO_MENSUAL)); }
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
  const [estado, setEstado] = useState<{ identidad: string; planes: PlanMensual[]; error: string | null }>({ identidad: "", planes: [], error: null });
  useEffect(() => {
    const refrescar = () => setRevision((v) => v + 1);
    const alVolver = () => { if (document.visibilityState === "visible") refrescar(); };
    window.addEventListener(EVENTO_MENSUAL, refrescar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener(EVENTO_MENSUAL, refrescar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);
  useEffect(() => {
    if (!alumnoId || !session?.userId) return;
    let vigente = true;
    api.get<unknown>(`/alumnos/${alumnoId}/planes-mensuales`).then((r) => {
      const planes = planesMensualesRespuesta.parse(r);
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
