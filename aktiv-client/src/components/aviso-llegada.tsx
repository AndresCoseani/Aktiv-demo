"use client";

import { useState } from "react";
import { horaClaseSchema, type ClaseAgenda } from "@aktiv/contrato";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { HoraSelector } from "@/components/hora-selector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function AvisoLlegada({ clase, disabled, onActualizado }: { clase: ClaseAgenda; disabled?: boolean; onActualizado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [hora, setHora] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function guardar(cancelar = false) {
    if (ocupado) return;
    setError("");
    if (!cancelar && (!horaClaseSchema.safeParse(hora).success || hora < clase.hora || (clase.fin && hora > clase.fin))) {
      setError(`Elegí una hora entre ${clase.hora} y ${clase.fin || "23:59"}.`); return;
    }
    setOcupado(true);
    try {
      const datos = { horarioId: clase.horarioId, fecha: clase.fecha };
      if (cancelar) await api.delete("/agenda/confirmaciones", datos);
      else await api.post("/agenda/confirmaciones", { ...datos, horaLlegada: hora });
      setAbierto(false); onActualizado();
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos guardar tu aviso."); }
    finally { setOcupado(false); }
  }
  return <div className="space-y-2">
    {clase.asistire && <p className="text-xs font-medium text-primary">{clase.horaLlegada ? `Vas a las ${clase.horaLlegada}` : "Hora sin indicar"}</p>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={clase.asistire ? "outline" : "default"} disabled={disabled || ocupado || clase.cancelada} onClick={() => { setHora(clase.horaLlegada ?? ""); setError(""); setAbierto(true); }}>{clase.asistire ? "Cambiar hora" : "Avisar que voy"}</Button>
      {clase.asistire && <Button size="sm" variant="ghost" disabled={disabled || ocupado} onClick={() => void guardar(true)}>Cancelar mi confirmación</Button>}
    </div>
    {!abierto && error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <Dialog open={abierto} onOpenChange={(valor) => { if (!ocupado) setAbierto(valor); }}><DialogContent className="sm:max-w-sm"><form onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
      <DialogHeader><DialogTitle>¿A qué hora venís?</DialogTitle><DialogDescription>{clase.lugar || clase.titulo} · {clase.fecha.split("-").reverse().join("/")} · {clase.hora}–{clase.fin || "23:59"}</DialogDescription></DialogHeader>
      <div className="space-y-2 py-6"><label className="text-sm font-medium">Hora estimada de llegada</label><HoraSelector value={hora} onChange={setHora} etiqueta="Hora estimada de llegada" /><p className="text-xs text-muted-foreground">Podés elegirla o escribirla. Después podés cambiarla.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
      <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={() => setAbierto(false)}>Volver</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Guardando…" : "Confirmar llegada"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
  </div>;
}
