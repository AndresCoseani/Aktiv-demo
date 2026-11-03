"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { EjercicioActivacion } from "@aktiv/contrato";
import { EjercicioCombobox } from "@/components/ejercicio-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { nuevoId } from "@/lib/format";

export function EntradaEnCalorEditor({ texto, ejercicios, onTexto, onEjercicios }: {
  texto: string; ejercicios: EjercicioActivacion[];
  onTexto: (texto: string) => void; onEjercicios: (ejercicios: EjercicioActivacion[]) => void;
}) {
  const [soloMovilidad, setSoloMovilidad] = useState(true);
  function cambiar(id: string, campos: Partial<EjercicioActivacion>) {
    onEjercicios(ejercicios.map((e) => e.id === id ? { ...e, ...campos } : e));
  }
  return <section aria-label="Entrada en calor" className="min-w-0 space-y-3 rounded-xl border p-3">
    <h3 className="text-sm font-semibold">Entrada en calor</h3>
    <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={soloMovilidad} className="size-4 accent-primary" onChange={(e) => setSoloMovilidad(e.target.checked)} />Solo movilidad y activación</label>
    {ejercicios.map((e, indice) => <div key={e.id} className="grid min-w-0 items-end gap-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Ejercicio {indice + 1}</p><EjercicioCombobox value={e.nombre} categorias={soloMovilidad ? ["Movilidad"] : undefined} onChange={(nombre) => cambiar(e.id, { nombre })} /></div>
      <label className="min-w-0 space-y-1 text-xs text-muted-foreground">Indicación<Input aria-label={`Indicación de activación ${indice + 1}`} maxLength={300} value={e.indicacion} onChange={(evento) => cambiar(e.id, { indicacion: evento.target.value })} placeholder="Ej: 1 min por grupo muscular" /></label>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Quitar ejercicio de entrada en calor ${indice + 1}`} onClick={() => onEjercicios(ejercicios.filter((ej) => ej.id !== e.id))}><Trash2 /></Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal text-left" disabled={ejercicios.length >= 20} onClick={() => onEjercicios([...ejercicios, { id: nuevoId(), nombre: "", indicacion: "" }])}><Plus />Agregar ejercicio de entrada en calor</Button>
    <label className="block space-y-1 border-t pt-3 text-xs text-muted-foreground">Indicaciones generales (opcional)
      <Textarea aria-label="Entrada en calor" className="min-h-20 text-sm text-foreground" maxLength={4000} value={texto} onChange={(e) => onTexto(e.target.value)} placeholder="Ej: una sola serie por ejercicio, sin pausas…" />
    </label>
    <p className="text-xs text-muted-foreground">Podés combinar ejercicios del catálogo con indicaciones escritas. Se mantienen durante las semanas de este día.</p>
  </section>;
}
