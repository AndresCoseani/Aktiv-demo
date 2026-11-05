"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { duplicarPlanApi, type PlanMensual } from "@aktiv/contrato";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxList, ComboboxItem } from "@/components/ui/combobox";
import { FechaInput } from "@/components/fecha-input";
import { api } from "@/lib/api";
import { hoyISO, nuevoId } from "@/lib/format";
import { hayBorradoresMensuales } from "@/lib/mensual";
import { useStore } from "@/lib/store";

export function DuplicarPlanDialog({ plan, alumnoId, onCerrar, onDuplicado }: {
  plan: PlanMensual; alumnoId: string; onCerrar: () => void;
  onDuplicado: (id: string, destino: string) => void;
}) {
  const { alumnos } = useStore();
  const router = useRouter();
  const [id] = useState(nuevoId);
  const [destino, setDestino] = useState(alumnoId);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const etiqueta = (id: string) => {
    const alumno = alumnos.find((a) => a.id === id);
    return alumno ? `${alumno.nombre} · ${alumno.email}` : "";
  };
  async function duplicar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (hayBorradoresMensuales()) { setError("Esperá a que se guarden los cambios del plan."); return; }
    const f = new FormData(e.currentTarget);
    const dto = duplicarPlanApi.safeParse({ id, alumnoId: destino, nombre: f.get("nombre"), inicio: f.get("inicio") });
    if (!dto.success || !alumnos.some((a) => a.id === destino)) { setError("Revisá el alumno, el nombre y la fecha de inicio."); return; }
    setOcupado(true); setError("");
    try {
      await api.post(`/planes-mensuales/${plan.id}/duplicar`, dto.data);
      onDuplicado(id, destino);
      const nombre = alumnos.find((a) => a.id === destino)!.nombre;
      toast.success(`Plan copiado para ${nombre} como borrador`, destino === alumnoId ? undefined : {
        action: { label: "Ver alumno", onClick: () => router.push(`/alumnos/${destino}`) },
      });
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo duplicar el plan. Reintentá."); }
    finally { setOcupado(false); }
  }
  return <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onCerrar(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!ocupado}>
      <form onSubmit={duplicar} className="space-y-5">
        <DialogHeader><DialogTitle>Duplicar plan</DialogTitle>
          <DialogDescription>Copiá la rutina completa para este alumno o para otro. Conserva sus {plan.semanas} semanas y se crea como borrador, sin reemplazar el plan activo.</DialogDescription></DialogHeader>
        <fieldset disabled={ocupado} className="min-w-0 space-y-4">
          <div className="space-y-1 text-sm"><label htmlFor="destino-plan">Alumno de destino</label>
            <Combobox items={alumnos.map((a) => a.id)} value={destino} onValueChange={(v) => v && setDestino(v)}
              itemToStringLabel={etiqueta} filter={(id, consulta) => etiqueta(id).toLocaleLowerCase("es").includes(consulta.toLocaleLowerCase("es"))}>
              <ComboboxInput id="destino-plan" aria-label="Alumno de destino" placeholder="Buscá por nombre o email" disabled={ocupado} className="w-full" />
              <ComboboxContent><ComboboxEmpty>No se encontraron alumnos.</ComboboxEmpty>
                <ComboboxList>{(id: string) => <ComboboxItem key={id} value={id}><span className="min-w-0 truncate">{etiqueta(id)}</span></ComboboxItem>}</ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <label className="block space-y-1 text-sm">Nombre del plan<Input name="nombre" defaultValue={`${plan.nombre.slice(0, 112)} (copia)`} maxLength={120} required /></label>
          <label className="block space-y-1 text-sm">Fecha de inicio<FechaInput name="inicio" defaultValue={hoyISO()} min="2000-01-01" max="2100-01-01" required /></label>
          <p className="text-xs text-muted-foreground">Incluye días, entrada en calor, bloques y progresión. Los pesos registrados quedan en el plan original.</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" disabled={ocupado}>{ocupado ? "Duplicando…" : "Duplicar plan"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
