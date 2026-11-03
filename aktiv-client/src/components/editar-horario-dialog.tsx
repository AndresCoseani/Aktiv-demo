"use client";

import { useState } from "react";
import { cambioHorarioApi, type ClaseAgenda } from "@aktiv/contrato";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatFecha } from "@/lib/format";
import { CamposHorario, type CamposHorarioClase } from "@/components/nuevo-horario-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function EditarHorarioDialog({ clase, onCerrar, onActualizado }: { clase: ClaseAgenda; onCerrar: () => void; onActualizado: () => void }) {
  const [campos, setCampos] = useState<CamposHorarioClase>({ titulo: clase.titulo, hora: clase.hora, fin: clase.fin, lugar: clase.lugar });
  const [alcance, setAlcance] = useState<"habitual" | "solo_fecha">(clase.personalizada ? "solo_fecha" : "habitual");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const dto = cambioHorarioApi.safeParse({ ...campos, fecha: clase.fecha, alcance });
    if (!dto.success) { setError(dto.error.issues[0]?.message ?? "Revisá los datos."); return; }
    setOcupado(true);
    try {
      await api.post(`/agenda/horarios/${clase.horarioId}/cambios`, dto.data);
      onActualizado(); onCerrar(); toast.success("Horario actualizado");
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos guardar el horario."); }
    finally { setOcupado(false); }
  }
  return <Dialog open onOpenChange={(v) => { if (!v && !ocupado) onCerrar(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl" showCloseButton={!ocupado}>
    <form onSubmit={guardar} className="space-y-5"><DialogHeader><DialogTitle>Editar bloque horario</DialogTitle><DialogDescription>{formatFecha(clase.fecha, { conAnio: true })}. Los registros anteriores no cambian.</DialogDescription></DialogHeader>
      <fieldset disabled={ocupado} className="min-w-0 space-y-5">
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Aplicar cambio a"><Button type="button" className="h-auto whitespace-normal py-3" variant={alcance === "habitual" ? "default" : "outline"} aria-pressed={alcance === "habitual"} onClick={() => setAlcance("habitual")}>Esta y las próximas semanas</Button><Button type="button" className="h-auto whitespace-normal py-3" variant={alcance === "solo_fecha" ? "default" : "outline"} aria-pressed={alcance === "solo_fecha"} onClick={() => setAlcance("solo_fecha")}>Solo esta fecha</Button></div>
        <CamposHorario valor={campos} onCambiar={setCampos} prefijo="Editar horario" />
      </fieldset>
      <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">Al guardar, los alumnos de los turnos afectados deberán confirmar otra vez. Los cambios puntuales de otras fechas se conservan.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
