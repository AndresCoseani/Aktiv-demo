"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Check } from "lucide-react";
import { agendaRespuestaSchema, fechaArgentina, type ClaseAgenda } from "@aktiv/contrato";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function ClasesHoyCard() {
  const { session } = useStore();
  const hoy = fechaArgentina();
  const identidad = `${session?.userId}:${hoy}`;
  const [revision, setRevision] = useState(0);
  const [estado, setEstado] = useState<{ identidad: string; clases: ClaseAgenda[]; error?: string }>({ identidad: "", clases: [] });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState("");
  useEffect(() => {
    if (!session?.userId) return;
    let vigente = true;
    api.get(`/agenda?desde=${hoy}&hasta=${hoy}`).then((respuesta) => {
      if (vigente) setEstado({ identidad, clases: agendaRespuestaSchema.parse(respuesta).clases });
    }).catch((e: unknown) => { if (vigente) setEstado({ identidad, clases: [], error: e instanceof Error ? e.message : "No pudimos cargar las clases de hoy." }); });
    return () => { vigente = false; };
  }, [hoy, identidad, revision, session?.userId]);
  useEffect(() => {
    const actualizar = () => { if (document.visibilityState === "visible") setRevision((r) => r + 1); };
    document.addEventListener("visibilitychange", actualizar);
    return () => document.removeEventListener("visibilitychange", actualizar);
  }, []);
  async function confirmar(clase: ClaseAgenda) {
    setOcupado(clase.horarioId); setErrorAccion("");
    try {
      const datos = { horarioId: clase.horarioId, fecha: hoy };
      if (clase.asistire) await api.delete("/agenda/confirmaciones", datos);
      else await api.post("/agenda/confirmaciones", datos);
      setRevision((r) => r + 1);
    } catch (e) { setErrorAccion(e instanceof Error ? e.message : "No pudimos guardar tu confirmación."); }
    finally { setOcupado(null); }
  }
  const cargando = estado.identidad !== identidad;
  return <section aria-label="Clases de hoy" className="rounded-xl border border-primary/20 bg-card px-4 py-4 sm:px-5">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-primary" />Hoy entrenamos</h2><Link href="/agenda" className="text-xs text-primary hover:underline">Ver semana</Link></div>
    {cargando ? <p role="status" className="text-sm text-muted-foreground">Cargando clases de hoy…</p> : estado.error ? <div role="alert" className="text-sm"><p>{estado.error}</p><Button size="sm" variant="ghost" onClick={() => setRevision((r) => r + 1)}>Reintentar</Button></div> : estado.clases.length === 0 ? <p className="text-sm text-muted-foreground">Hoy no hay clases programadas.</p> : <ul className="divide-y divide-border/50">{estado.clases.map((clase) => <li key={clase.horarioId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0"><p className="break-words text-sm font-medium">{clase.lugar || clase.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{clase.hora}–{clase.fin || "Sin fin informado"} · {clase.titulo}{clase.cancelada && " · Cancelada"}</p></div>
      <Button size="sm" variant={clase.asistire ? "outline" : "default"} disabled={Boolean(ocupado) || (clase.cancelada && !clase.asistire)} onClick={() => void confirmar(clase)}>{ocupado === clase.horarioId ? "Guardando…" : clase.asistire ? <><Check />Cancelar mi confirmación</> : "Asistiré"}</Button>
    </li>)}</ul>}
    {errorAccion && <p role="alert" className="mt-3 text-sm text-destructive">{errorAccion}</p>}
  </section>;
}
