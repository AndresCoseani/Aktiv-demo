"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SENSACIONES, seguimientoRespuesta, type Seguimiento } from "@aktiv/contrato";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { registrarBorradorMensual } from "@/lib/mensual";

const contenido = (r: Seguimiento | null) => r && JSON.stringify([r.completado, r.sensacion, r.nota.trim()]);
const mensaje = (e: unknown) => e instanceof Error ? e.message : "No se pudo guardar el seguimiento.";

/** Montar con key sesión:semana para mantener los borradores separados. */
export function SeguimientoSesion({ sesionId, semana, lectura = false }: { sesionId: string; semana: number; lectura?: boolean }) {
  const [borrador, setBorrador] = useState<Seguimiento | null>(null);
  const [guardado, setGuardado] = useState<Seguimiento | null>(null);
  const [habilitado, setHabilitado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const sucio = contenido(borrador) !== contenido(guardado);
  const ruta = `/sesiones/${sesionId}/seguimiento/${semana}`;
  useEffect(() => {
    let cancelado = false;
    api.get(ruta).then((r) => {
      if (cancelado) return;
      const datos = seguimientoRespuesta.parse(r);
      setBorrador(datos.registro); setGuardado(datos.registro); setHabilitado(datos.habilitado); setError("");
    }).catch((e) => { if (!cancelado) setError(mensaje(e)); });
    return () => { cancelado = true; };
  }, [ruta, revision]);
  useEffect(() => registrarBorradorMensual(`seguimiento:${sesionId}:${semana}`, sucio || ocupado), [sesionId, semana, sucio, ocupado]);
  useEffect(() => {
    if (!sucio && !ocupado) return;
    const salir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const navegar = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("a[href], [role=tab]")) { e.preventDefault(); e.stopPropagation(); toast.error("Esperá a que se guarde el seguimiento antes de cambiar de vista."); }
    };
    window.addEventListener("beforeunload", salir); document.addEventListener("click", navegar, true);
    return () => { window.removeEventListener("beforeunload", salir); document.removeEventListener("click", navegar, true); };
  }, [sucio, ocupado]);
  useEffect(() => {
    if (!borrador || !sucio || ocupado || error || lectura || !habilitado) return;
    const timer = setTimeout(async () => {
      setOcupado(true);
      try {
        const { completado, sensacion, nota } = borrador;
        const datos = seguimientoRespuesta.parse(await api.patch(ruta, { completado, sensacion, nota: nota.trim() }));
        setGuardado(datos.registro);
        setBorrador((actual) => actual ? { ...actual, fecha: datos.registro.fecha } : actual);
      } catch (e) { setError(mensaje(e)); }
      finally { setOcupado(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [borrador, sucio, ocupado, error, lectura, habilitado, ruta]);

  function cambiar(datos: Partial<Seguimiento>) { setError(""); setBorrador((actual) => actual ? { ...actual, ...datos } : actual); }
  const reintentar = () => { setError(""); if (!borrador || lectura) setRevision((r) => r + 1); };
  return <section aria-label={`Seguimiento de semana ${semana}`} className="space-y-3 border-t border-border/60 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{lectura ? "Seguimiento del alumno" : "Tu entrenamiento"}</h3>
      {lectura && <Button type="button" size="sm" variant="ghost" onClick={() => setRevision((r) => r + 1)}>Actualizar seguimiento</Button>}
    </div>
    {!borrador ? !error && <p role="status" className="text-xs text-muted-foreground">Cargando seguimiento…</p> : lectura ? <div className="space-y-2 text-sm">
      <p className={borrador.completado ? "flex items-center gap-2 text-primary" : "text-muted-foreground"}>{borrador.completado && <CheckCircle2 className="size-4" />}{borrador.completado ? "Completado" : "Todavía no marcó este entrenamiento como completado."}</p>
      {borrador.sensacion && <p>Cómo se sintió: <span className="font-medium">{borrador.sensacion}</span></p>}
      {borrador.nota && <p className="whitespace-pre-wrap break-words text-muted-foreground">{borrador.nota}</p>}
    </div> : !habilitado ? <p className="text-xs text-muted-foreground">Podés registrar entrenamientos del plan activo cuando haya comenzado la semana.</p> : <>
      <Button type="button" variant={borrador.completado ? "secondary" : "outline"} aria-pressed={borrador.completado} disabled={ocupado} onClick={() => cambiar(borrador.completado ? { completado: false, sensacion: null, nota: "" } : { completado: true })}>
        <Check className="size-4" />{borrador.completado ? "Completado" : "Marcar como completado"}
      </Button>
      {borrador.completado && <div className="space-y-3">
        <div className="space-y-2"><p className="text-sm">¿Cómo te sentiste? <span className="text-xs text-muted-foreground">Opcional</span></p>
          <div role="group" aria-label="Cómo te sentiste" className="flex flex-wrap gap-2">{SENSACIONES.map((sensacion) => <Button key={sensacion} type="button" size="sm" variant={borrador.sensacion === sensacion ? "default" : "outline"} aria-pressed={borrador.sensacion === sensacion} onClick={() => cambiar({ sensacion: borrador.sensacion === sensacion ? null : sensacion })}>{sensacion}</Button>)}</div>
        </div>
        <label className="block space-y-1 text-sm">Comentario para Lucas <span className="text-xs text-muted-foreground">Opcional</span><Textarea aria-label="Comentario para Lucas" rows={2} className="min-h-16" maxLength={500} placeholder="Algo que quieras contarle sobre este entrenamiento" value={borrador.nota} onChange={(e) => cambiar({ nota: e.target.value })} /></label>
      </div>}
      <p role="status" className="text-xs text-muted-foreground">{ocupado ? "Guardando…" : error ? "Sin guardar" : sucio ? "Pendiente…" : guardado?.completado ? "Guardado automáticamente" : ""}</p>
    </>}
    {error && <div className="space-y-2"><p role="alert" className="text-xs text-destructive">{error}</p><Button type="button" size="sm" variant="outline" onClick={reintentar}>Reintentar seguimiento</Button></div>}
  </section>;
}
