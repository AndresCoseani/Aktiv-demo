"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil } from "lucide-react";
import { agendaRespuestaSchema, desplazarFecha, diaSemanal, fechaArgentina, DIAS_PLAN, type AgendaRespuesta, type ClaseAgenda } from "@aktiv/contrato";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { formatFecha } from "@/lib/format";
import { FechaInput } from "@/components/fecha-input";
import { Button } from "@/components/ui/button";
import { NuevoHorarioDialog } from "@/components/nuevo-horario-dialog";
import { EditarHorarioDialog } from "@/components/editar-horario-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

function proximaOcurrencia(fecha: string, hoy: string) { let proxima = fecha; while (proxima < hoy) proxima = desplazarFecha(proxima, 7); return proxima; }

function inicioSemana(fecha: string) { return desplazarFecha(fecha, 1 - diaSemanal(fecha)); }

export default function AgendaPage() {
  const { session } = useStore();
  const coach = session?.role === "coach";
  const [desde, setDesde] = useState(() => inicioSemana(fechaArgentina()));
  const [revision, setRevision] = useState(0);
  const [estado, setEstado] = useState<{ clave: string; datos?: AgendaRespuesta; error?: string }>({ clave: "" });
  const [ocupado, setOcupado] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [nuevoDia, setNuevoDia] = useState<number | undefined>();
  const [nuevaFecha, setNuevaFecha] = useState<string | undefined>();
  const [editando, setEditando] = useState<ClaseAgenda | null>(null);
  const [confirmar, setConfirmar] = useState<{ titulo: string; detalle: string; accion: () => Promise<unknown> } | null>(null);
  const hasta = desplazarFecha(desde, 6);
  const clave = `${session?.userId}:${desde}`;
  useEffect(() => {
    if (!session?.userId) return;
    let vigente = true;
    api.get<unknown>(`/agenda?desde=${desde}&hasta=${hasta}`).then((r) => {
      if (vigente) setEstado({ clave, datos: agendaRespuestaSchema.parse(r) });
    }).catch((e: unknown) => { if (vigente) setEstado({ clave, error: e instanceof Error ? e.message : "No pudimos cargar la agenda." }); });
    return () => { vigente = false; };
  }, [clave, desde, hasta, revision, session?.userId]);
  const datos = estado.clave === clave ? estado.datos : undefined;
  const error = estado.clave === clave ? estado.error : undefined;
  const hoy = fechaArgentina();
  useEffect(() => {
    const refrescar = () => { if (document.visibilityState === "visible") setRevision((v) => v + 1); };
    document.addEventListener("visibilitychange", refrescar);
    return () => document.removeEventListener("visibilitychange", refrescar);
  }, []);
  async function actuar(accion: () => Promise<unknown>, mensaje: string) {
    if (ocupado) return;
    setOcupado(true);
    try { await accion(); setRevision((v) => v + 1); toast.success(mensaje); setConfirmar(null); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo completar la acción."); }
    finally { setOcupado(false); }
  }
  function cancelarClase(c: ClaseAgenda) {
    setConfirmar({ titulo: c.cancelada ? "¿Reabrir esta clase?" : "¿Cancelar esta clase?", detalle: `${c.titulo}, ${formatFecha(c.fecha)} a las ${c.hora}. ${c.cancelada ? "Se conservan las confirmaciones anteriores." : "Aparecerá cancelada para los alumnos. El resto de las fechas no cambia."}`, accion: () => c.cancelada ? api.delete("/agenda/cancelaciones", { horarioId: c.horarioId, fecha: c.fecha }) : api.post("/agenda/cancelaciones", { horarioId: c.horarioId, fecha: c.fecha }) });
  }
  async function editarBloque(clase: ClaseAgenda) {
    if (clase.fecha >= hoy) { setEditando(clase); return; }
    setOcupado(true);
    try {
      const fecha = proximaOcurrencia(clase.fecha, hoy);
      const agenda = agendaRespuestaSchema.parse(await api.get(`/agenda?desde=${fecha}&hasta=${fecha}`));
      const proximo = agenda.clases.find((c) => c.horarioId === clase.horarioId);
      if (!proximo) throw new Error("Ese bloque ya no está activo. Actualizá la agenda.");
      setEditando(proximo);
    } catch (e) { toast.error(e instanceof Error ? e.message : "No pudimos abrir el horario."); }
    finally { setOcupado(false); }
  }
  if (!session) return null;
  return <div className="space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Clases</h1><p className="mt-2 max-w-prose text-sm text-muted-foreground">{coach ? "Tus horarios y quiénes asistiran a cada clase." : "Elegí cuándo vas a ir. Podés cancelar tu confirmación y elegir otro horario."}</p></div>{coach && <Button size="sm" onClick={() => { setNuevoDia(undefined); setNuevaFecha(desde < hoy ? hoy : desde); setNuevo(true); }}><Plus />Nuevo horario</Button>}</header>
    <div className="flex flex-wrap items-center gap-3"><Button size="icon-sm" variant="outline" aria-label="Semana anterior" onClick={() => setDesde(desplazarFecha(desde, -7))}><ChevronLeft /></Button><div className="w-40"><FechaInput aria-label="Ver clases desde" value={desde} onChange={(e) => { if (e.target.value) setDesde(inicioSemana(e.target.value)); }} /></div><Button size="icon-sm" variant="outline" aria-label="Semana siguiente" onClick={() => setDesde(desplazarFecha(desde, 7))}><ChevronRight /></Button><Button size="sm" variant="ghost" onClick={() => setDesde(inicioSemana(hoy))}>Hoy</Button><Button size="sm" variant="ghost" onClick={() => setRevision((v) => v + 1)}>Actualizar</Button><span className="text-xs text-muted-foreground">Semana del {formatFecha(desde)} al {formatFecha(hasta)}</span></div>
    {error ? <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm"><p>{error}</p><Button variant="outline" onClick={() => setRevision((v) => v + 1)}>Reintentar</Button></div> : !datos ? <p role="status" className="text-sm text-muted-foreground">Cargando clases…</p> : <>
      {!datos.clases.length && <div className="space-y-2 rounded-xl border border-dashed p-8 text-center"><CalendarDays className="mx-auto size-6 text-muted-foreground" /><p className="text-sm">No hay clases esta semana.</p>{coach && <p className="text-xs text-muted-foreground">Creá tus horarios semanales para que los alumnos confirmen cuándo van.</p>}</div>}
      <div className="min-w-0" role="region" aria-label="Calendario semanal"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" aria-label="Clases de la semana">{Array.from({ length: 7 }, (_, i) => desplazarFecha(desde, i)).map((fecha, i) => <section key={fecha} className={`col-span-2 flex h-60 min-w-0 flex-col rounded-xl border p-4 ${i === 4 ? "lg:col-start-2" : i === 6 ? "sm:col-start-2 lg:col-start-auto" : ""} ${fecha === hoy ? "border-primary/50 bg-primary/5" : "border-border/60"}`}><h2 className="text-sm font-semibold">{DIAS_PLAN[i]}{fecha === hoy ? " · Hoy" : ""}<span className="mt-1 block text-xs font-normal text-muted-foreground">{formatFecha(fecha)}</span></h2>{!datos.clases.some((c) => c.fecha === fecha) && <p className="py-3 text-xs text-muted-foreground">Sin clases</p>}<div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">{datos.clases.filter((c) => c.fecha === fecha).map((c) => <article key={c.horarioId} className={`space-y-2 border-b border-border/50 pb-3 last:border-0 last:pb-0 ${c.cancelada ? "opacity-60" : ""}`}>
        <div className="space-y-2"><div className="min-w-0"><div className="flex items-start justify-between gap-1"><p className="break-words text-xs font-semibold leading-relaxed">{c.hora}{c.fin ? `–${c.fin}` : ""} · {c.titulo}</p>{coach && <Button size="icon-sm" variant="ghost" className="size-6 shrink-0" aria-label={`Editar bloque ${c.titulo}, ${c.fecha}, ${c.hora}`} disabled={ocupado || fecha > desplazarFecha(hoy, 60)} onClick={() => void editarBloque(c)}><Pencil className="size-3" /></Button>}</div>{c.personalizada && <p className="text-[11px] text-primary">Solo esta fecha</p>}{c.lugar && <p className="mt-1 break-words text-xs text-muted-foreground">{c.lugar}</p>}{c.cancelada && <p className="mt-1 text-xs text-destructive">Clase cancelada</p>}{!coach && c.asistire && !c.cancelada && <p className="mt-1 text-xs text-primary">Confirmaste que vas a asistir</p>}</div>
          {!coach && <Button size="sm" className="h-auto w-full whitespace-normal px-2 py-1.5 text-xs" variant={c.asistire ? "outline" : "default"} disabled={ocupado || fecha < hoy || fecha > desplazarFecha(hoy, 60) || (c.cancelada && !c.asistire)} onClick={() => void actuar(() => c.asistire ? api.delete("/agenda/confirmaciones", { horarioId: c.horarioId, fecha }) : api.post("/agenda/confirmaciones", { horarioId: c.horarioId, fecha }), c.asistire ? "Confirmación cancelada" : "Confirmaste tu asistencia")}>{c.asistire ? "Cancelar mi confirmación" : "Voy a asistir"}</Button>}
        </div>
        {coach && <>
          <div className="border-t border-border/50 pt-2 text-xs"><p className="text-muted-foreground">{c.confirmados.length} {c.cancelada ? "confirmaciones previas" : "confirmaciones"}</p>{c.confirmados.length > 0 && <ul aria-label={`Alumnos confirmados, ${fecha}, ${c.hora}`} className="mt-2 space-y-1">{c.confirmados.map((a) => <li key={a.alumnoId} className="break-words font-medium">{a.nombre}</li>)}</ul>}</div>
          <Button variant="outline" size="sm" className={`h-8 px-3 text-xs ${c.cancelada ? "border-primary/40 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"}`} disabled={ocupado || fecha < hoy || fecha > desplazarFecha(hoy,60)} title={fecha < hoy ? "Este entrenamiento ya pasó" : undefined} onClick={() => cancelarClase(c)}>{c.cancelada ? "Reabrir entrenamiento" : "Cancelar entrenamiento"}</Button>
        </>}

      </article>)}</div>{coach && <Button size="sm" variant="ghost" className="mt-2 h-7 shrink-0 justify-start px-0 text-xs text-primary" disabled={ocupado || fecha > desplazarFecha(hoy,60)} onClick={() => { setNuevoDia(i+1); setNuevaFecha(proximaOcurrencia(fecha, hoy)); setNuevo(true); }}><Plus className="size-3" />Agregar bloque</Button>}</section>)}</div></div>
      {coach && datos.horarios.length > 0 && <section className="space-y-3 border-t border-border/60 pt-6" aria-label="Horarios semanales"><h2 className="text-base font-semibold">Horarios semanales</h2><p className="my-3 text-xs leading-relaxed text-muted-foreground">Editá cada bloque con el lápiz de la semana. Desactivar oculta sus clases y conserva los registros.</p><ul className="divide-y">{[...datos.horarios].sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora)).map((h) => <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">{DIAS_PLAN[h.dia - 1]} · {h.hora} · {h.titulo}{!h.activo && " · Inactivo"}</span><Button size="sm" variant="outline" disabled={ocupado} onClick={() => setConfirmar({ titulo: h.activo ? "¿Desactivar este horario?" : "¿Reactivar este horario?", detalle: h.activo ? "Sus clases dejarán de aparecer para los alumnos. Las confirmaciones existentes se conservan; al reactivarlo volverán a verse." : "Sus clases y confirmaciones volverán a aparecer.", accion: () => api.patch(`/agenda/horarios/${h.id}`, { activo: !h.activo }) })}>{h.activo ? "Desactivar" : "Reactivar"}</Button></li>)}</ul></section>}
    </>}
    {nuevo && <NuevoHorarioDialog diaInicial={nuevoDia} fechaDesde={nuevaFecha} onCreado={() => { if (nuevaFecha && nuevaFecha > hasta) setDesde(inicioSemana(nuevaFecha)); }} onCerrar={() => setNuevo(false)} onActualizado={() => setRevision((v) => v + 1)} />}
    {editando && <EditarHorarioDialog clase={editando} onCerrar={() => setEditando(null)} onActualizado={() => setRevision((v) => v + 1)} />}
    <Dialog open={Boolean(confirmar)} onOpenChange={(v) => { if (!v && !ocupado) setConfirmar(null); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{confirmar?.titulo}</DialogTitle><DialogDescription>{confirmar?.detalle}</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" disabled={ocupado} onClick={() => setConfirmar(null)}>Volver</Button><Button disabled={ocupado} onClick={() => { if (confirmar) void actuar(confirmar.accion, "Agenda actualizada"); }}>{ocupado ? "Guardando…" : "Confirmar"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
