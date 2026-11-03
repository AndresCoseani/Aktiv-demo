"use client";

import { useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
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
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const destinoArrastre = useRef<string | null>(null);
  function mover(id: string, destino: number) {
    const origen = ejercicios.findIndex((e) => e.id === id);
    if (origen < 0 || destino < 0 || destino >= ejercicios.length || origen === destino) return;
    const nuevos = [...ejercicios];
    nuevos.splice(destino, 0, nuevos.splice(origen, 1)[0]);
    onEjercicios(nuevos);
  }
  function cambiar(id: string, campos: Partial<EjercicioActivacion>) {
    onEjercicios(ejercicios.map((e) => e.id === id ? { ...e, ...campos } : e));
  }
  return <section aria-label="Entrada en calor" className="min-w-0 space-y-3 rounded-xl border p-3">
    <h3 className="text-sm font-semibold">Entrada en calor</h3>
    <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={soloMovilidad} className="size-4 accent-primary" onChange={(e) => setSoloMovilidad(e.target.checked)} />Solo movilidad y activación</label>
    {ejercicios.map((e, indice) => <div key={e.id} data-activacion-id={e.id} className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-3 border-t pt-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] ${arrastrando === e.id ? "rounded-lg bg-accent/50 ring-1 ring-primary" : ""}`}>
      <button type="button" aria-label={`Reordenar activación ${indice + 1}`} title="Arrastrá para ordenar. Con teclado, usá las flechas arriba y abajo." aria-pressed={arrastrando === e.id}
        className="row-span-2 flex min-h-11 touch-none items-center rounded px-1 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring sm:row-span-1 cursor-grab active:cursor-grabbing"
        onPointerDown={(evento) => { if (evento.button !== 0) return; destinoArrastre.current = null; evento.currentTarget.setPointerCapture(evento.pointerId); setArrastrando(e.id); }}
        onPointerMove={(evento) => {
          if (!evento.currentTarget.hasPointerCapture(evento.pointerId)) return;
          const fila = document.elementFromPoint(evento.clientX, evento.clientY)?.closest<HTMLElement>("[data-activacion-id]");
          destinoArrastre.current = fila && evento.currentTarget.closest("section")?.contains(fila) ? fila.dataset.activacionId ?? null : null;
        }}
        onPointerUp={() => { mover(e.id, ejercicios.findIndex((ej) => ej.id === destinoArrastre.current)); destinoArrastre.current = null; setArrastrando(null); }} onPointerCancel={() => { destinoArrastre.current = null; setArrastrando(null); }} onLostPointerCapture={() => setArrastrando(null)}
        onKeyDown={(evento) => { if (evento.key === "ArrowUp" || evento.key === "ArrowDown") { evento.preventDefault(); mover(e.id, indice + (evento.key === "ArrowUp" ? -1 : 1)); } }}><GripVertical className="size-4" /></button>
      <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Ejercicio {indice + 1}</p><EjercicioCombobox value={e.nombre} categorias={soloMovilidad ? ["Movilidad"] : undefined} onChange={(nombre) => cambiar(e.id, { nombre })} /></div>
      <label className="col-start-2 row-start-2 min-w-0 space-y-1 text-xs text-muted-foreground sm:col-start-auto sm:row-start-auto">Indicación<Input className="text-foreground" aria-label={`Indicación de activación ${indice + 1}`} maxLength={300} value={e.indicacion} onChange={(evento) => cambiar(e.id, { indicacion: evento.target.value })} placeholder="Opcional" /></label>
      <Button type="button" size="icon-sm" variant="ghost" className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto" aria-label={`Quitar ejercicio de entrada en calor ${indice + 1}`} onClick={() => onEjercicios(ejercicios.filter((ej) => ej.id !== e.id))}><Trash2 /></Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal text-left" disabled={ejercicios.length >= 20} onClick={() => onEjercicios([...ejercicios, { id: nuevoId(), nombre: "", indicacion: "" }])}><Plus />Agregar ejercicio de entrada en calor</Button>
    <label className="block space-y-1 border-t pt-3 text-xs text-muted-foreground">Indicaciones generales (opcional)
      <Textarea aria-label="Entrada en calor" className="min-h-20 text-sm text-foreground" maxLength={4000} value={texto} onChange={(e) => onTexto(e.target.value)} placeholder="Opcional" />
    </label>
    <p className="text-xs text-muted-foreground">Podés combinar ejercicios del catálogo con indicaciones escritas. Se mantienen durante las semanas de este día.</p>
  </section>;
}
