"use client";

import { useRef, useState } from "react";
import { DIAS_PLAN, agendaRespuestaSchema, altaHorarioApi, fechaArgentina } from "@aktiv/contrato";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatFecha, nuevoId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { HoraSelector } from "@/components/hora-selector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export type CamposHorarioClase = { titulo: string; hora: string; fin: string; lugar: string };
type Campos = CamposHorarioClase;
const vacio: Campos = { titulo: "", hora: "", fin: "", lugar: "" };


export function CamposHorario({ valor, onCambiar, prefijo }: { valor: Campos; onCambiar: (valor: Campos) => void; prefijo: string }) {
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <label className="space-y-2 text-sm font-medium">Actividad<Input aria-label={`${prefijo} actividad`} className="h-11 font-normal" required value={valor.titulo} maxLength={80} onChange={(e) => onCambiar({ ...valor, titulo: e.target.value })} placeholder="Ej: Running" /></label>
    <label className="space-y-2 text-sm font-medium">Lugar<Input aria-label={`${prefijo} lugar`} required className="h-11 font-normal" value={valor.lugar} maxLength={120} onChange={(e) => onCambiar({ ...valor, lugar: e.target.value })} /></label>
    <div className="min-w-0 space-y-2 text-sm font-medium"><p>Hora de inicio</p><HoraSelector etiqueta={`${prefijo} inicio`} value={valor.hora} onChange={(hora) => onCambiar({ ...valor, hora })} /></div>
    <div className="min-w-0 space-y-2 text-sm font-medium"><p>Hora de fin</p><HoraSelector etiqueta={`${prefijo} fin`} value={valor.fin} onChange={(fin) => onCambiar({ ...valor, fin })} /></div>
  </div>;
}

export function NuevoHorarioDialog({ onCerrar, onActualizado, onCreado, diaInicial, fechaDesde }: { onCerrar: () => void; onActualizado: () => void; onCreado?: () => void; diaInicial?: number; fechaDesde?: string }) {
  const [comunes, setComunes] = useState<Campos>(vacio);
  const [dias, setDias] = useState<number[]>(diaInicial ? [diaInicial] : []);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [guardados, setGuardados] = useState<number[]>([]);
  const ids = useRef<Record<number, string>>({});

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dias.length) { setError("Seleccioná al menos un día."); return; }
    // Validar todos antes de enviar el primero. IDs estables permiten recuperar
    // un alta confirmada en DB cuya respuesta se perdió, sin duplicarla al reintentar.
    const pendientes = [];
    for (const dia of dias) {
      if (guardados.includes(dia)) continue;
      ids.current[dia] ??= nuevoId();
      const resultado = altaHorarioApi.safeParse({ id: ids.current[dia], dia, ...comunes, ...(fechaDesde ? { desde: fechaDesde } : {}) });
      if (!resultado.success) { setError(`${DIAS_PLAN[dia - 1]}: ${resultado.error.issues[0]?.message ?? "Revisá los datos."}`); return; }
      pendientes.push(resultado.data);
    }
    setOcupado(true); setError("");
    try {
      const hoy = fechaArgentina();
      const actuales = agendaRespuestaSchema.parse(await api.get(`/agenda?desde=${hoy}&hasta=${hoy}`));
      const existentes = new Set(actuales.horarios.map((h) => h.id));
      for (const horario of pendientes) {
        if (!existentes.has(horario.id)) await api.post("/agenda/horarios", horario);
        setGuardados((anteriores) => [...anteriores, horario.dia]);
      }
      onActualizado(); onCerrar(); onCreado?.(); toast.success(dias.length === 1 ? "Horario habitual creado" : "Horarios habituales creados");
    } catch (e) {
      onActualizado();
      setError(`${e instanceof Error ? e.message : "No se pudieron crear todos los horarios."} Los días guardados se conservan. Reintentá para completar los pendientes.`);
    } finally { setOcupado(false); }
  }

  return <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onCerrar(); }}>
    <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none flex-col overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl" showCloseButton={!ocupado}>
      <DialogHeader className="shrink-0 px-5 pt-6 sm:px-8"><DialogTitle>Nuevo horario semanal</DialogTitle><DialogDescription>Se repite cada semana hasta que lo cambies.{fechaDesde && ` Disponible desde el ${formatFecha(fechaDesde, { conAnio: true })}.`} Los días seleccionados comparten actividad, horario y lugar.</DialogDescription></DialogHeader>
      <form onSubmit={guardar} className="flex min-h-0 flex-col">
        <div className="min-h-0 overflow-y-auto px-5 pb-6 sm:px-8">
        <fieldset disabled={ocupado || guardados.length > 0} className="min-w-0 space-y-6">
          <div className="space-y-3"><h3 className="text-sm font-medium">Días de clase</h3>
            <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-7">
              {DIAS_PLAN.map((nombre, i) => {
                const dia = i + 1, elegido = dias.includes(dia), listo = guardados.includes(dia);
                return <label key={dia} className={`flex min-h-14 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${elegido ? "border-primary/60 bg-primary/10" : "border-border/70 hover:bg-muted/30"}`}>
                  <span>{nombre}{listo && <span className="mt-1 block text-xs font-normal text-muted-foreground">Guardado</span>}</span><Checkbox aria-label={nombre} checked={elegido} disabled={ocupado || guardados.length > 0} onCheckedChange={(marcado) => setDias((antes) => marcado ? [...antes, dia].sort((a, b) => a - b) : antes.filter((d) => d !== dia))} />
                </label>;
              })}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">¿Un día tiene otro horario? Dejalo sin marcar y creá un horario aparte para ese día.</p>
          <div className="border-t border-border/60 pt-6"><CamposHorario valor={comunes} onCambiar={setComunes} prefijo="Horario común" /></div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 border-t bg-muted/10 px-5 py-4 sm:px-8"><Button type="button" variant="ghost" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Guardando…" : guardados.length ? "Completar pendientes" : "Guardar horario"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
