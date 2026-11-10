"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { prescripcionEfectiva, type EjercicioMensual, type SesionEntrenamiento } from "@aktiv/contrato";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EjercicioCombobox } from "@/components/ejercicio-combobox";
import { cn } from "@/lib/utils";

const TIPO_ARRASTRE = "application/x-aktiv-ejercicio";
export function bloquesDelPlan(ejercicios: EjercicioMensual[], bloques: number[] = []) {
  return [...new Set([...bloques, ...ejercicios.map((e) => e.grupo)])];
}
export function primerBloqueLibre(ejercicios: EjercicioMensual[], bloques: number[] = []) {
  const existentes = bloquesDelPlan(ejercicios, bloques);
  return Array.from({ length: 20 }, (_, i) => i + 1).find((g) => !existentes.includes(g));
}

export function EditorEjerciciosPlan({ ejercicios, bloques, semana, semanasVisibles: semanas, ocupado, altaPendiente, sucio, onCambiar, onCrearBloque, onQuitarBloque, onAgregar, onQuitar }: {
  ejercicios: EjercicioMensual[]; tipo: SesionEntrenamiento["tipo"]; semana: number; semanasVisibles: number[];
  bloques: number[];
  ocupado: boolean; altaPendiente: boolean; sucio: boolean;
  onCambiar: (id: string, campos: Partial<EjercicioMensual>) => void;
  onCrearBloque: () => void; onQuitarBloque: (grupo: number) => void;
  onAgregar: (grupo: number) => void; onQuitar: (id: string) => void;
}) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!contenedor.current) return;
    const observer = new ResizeObserver(([entrada]) => setAncho(entrada.contentRect.width));
    observer.observe(contenedor.current);
    return () => observer.disconnect();
  }, []);
  const tabla = ancho >= 700;
  // Reservar espacio para nombre, descanso, acciones y separación entre campos.
  const capacidad = tabla ? Math.max(1, Math.floor((ancho - 340) / 112)) : 1;
  const inicio = Math.floor((semana - 1) / capacidad) * capacidad;
  const semanasVisibles = semanas.slice(inicio, inicio + capacidad);
  // El número interno identifica el bloque; el orden visual sigue los ejercicios.
  const grupos = bloquesDelPlan(ejercicios, bloques);
  const libre = primerBloqueLibre(ejercicios, bloques);
  const columnas = { "--columnas-ejercicio": `minmax(10rem,1.5fr) repeat(${semanasVisibles.length},minmax(0,1fr)) 6rem 2rem` } as CSSProperties;
  function soltar(e: React.DragEvent, grupo: number) {
    e.preventDefault();
    const id = e.dataTransfer.getData(TIPO_ARRASTRE);
    if (ejercicios.some((ej) => ej.id === id)) onCambiar(id, { grupo });
    setArrastrando(null);
  }
  return <div ref={contenedor} className="space-y-4" style={columnas}>
    <p className="text-xs text-muted-foreground">{semanasVisibles.length === 1 ? `Editando semana ${semana} de ${semanas.length}` : `Semanas ${semanasVisibles[0]} a ${semanasVisibles.at(-1)} de ${semanas.length}`}{semanasVisibles.length < semanas.length && ". Elegí otra semana arriba para cambiar la vista."}</p>
    {grupos.map((grupo, indice) => {
      const delBloque = ejercicios.filter((e) => e.grupo === grupo);
      return <section key={grupo} aria-label={`Bloque ${indice + 1}`} onDragOver={(e) => { if (arrastrando) e.preventDefault(); }} onDrop={(e) => soltar(e, grupo)} className={cn("min-w-0 rounded-xl bg-muted/20 p-4 space-y-4 ring-1 ring-border/40", arrastrando && "ring-primary/60 bg-primary/5")}>
        <div className="flex flex-wrap items-center justify-between gap-1"><h4 className="text-sm font-medium">Bloque {indice + 1}</h4><div className="flex items-center gap-2"><p className="text-xs text-muted-foreground">{delBloque.length > 1 ? `${delBloque.length} ejercicios juntos` : delBloque.length ? "1 ejercicio" : "Vacío"}</p>{!delBloque.length && <Button type="button" size="icon-sm" variant="ghost" aria-label={`Eliminar bloque ${indice + 1} vacío`} disabled={ocupado} onClick={() => onQuitarBloque(grupo)}><Trash2 /></Button>}</div></div>
        {tabla && delBloque.length > 0 && <div className="grid grid-cols-[var(--columnas-ejercicio)] gap-3 text-xs text-muted-foreground"><span>Ejercicio</span>{semanasVisibles.map((s) => <span key={s}>Semana {s}</span>)}<span>Descanso</span><span className="sr-only">Acciones</span></div>}
        {delBloque.map((ej) => <div key={ej.id} className={cn("grid min-w-0 gap-3 border-t pt-3", tabla && "grid-cols-[var(--columnas-ejercicio)]")}>
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 items-center gap-1"><button type="button" draggable aria-label={`Arrastrar ${ej.nombre || "ejercicio"} a otro bloque`} title="Arrastrar a otro bloque" onDragStart={(e) => { e.dataTransfer.setData(TIPO_ARRASTRE, ej.id); e.dataTransfer.effectAllowed = "move"; setArrastrando(ej.id); }} onDragEnd={() => setArrastrando(null)} className="cursor-grab rounded p-1 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"><GripVertical className="size-4" /></button><div className="min-w-0 flex-1"><EjercicioCombobox value={ej.nombre}  onChange={(nombre) => onCambiar(ej.id, { nombre })} /></div></div>
            <details className="text-xs text-muted-foreground"><summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-ring">Mover a otro bloque</summary><label className="mt-2 flex items-center gap-2">Mover a<select aria-label={`Mover ${ej.nombre || "ejercicio"} a bloque`} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs" value={grupo} onChange={(e) => onCambiar(ej.id, { grupo: Number(e.target.value) })}>{grupos.map((g, i) => <option key={g} value={g}>Bloque {i + 1}</option>)}{libre && delBloque.length > 1 && <option value={libre}>Nuevo bloque individual</option>}</select></label></details>
          </div>
          {semanasVisibles.map((s) => {
            const celda = ej.semanas.find((c) => c.semana === s);
            const heredado = prescripcionEfectiva(ej.semanas, s - 1);
            return <label key={s} className="min-w-0 space-y-1 text-xs"><span className={cn("text-muted-foreground", tabla && "sr-only")}>Semana {s}</span><Input aria-label={`${ej.nombre || "Ejercicio"}, semana ${s}`} maxLength={60} value={celda?.prescripcion ?? ""} disabled={!celda} placeholder={heredado || "Ej: 4×8"} onChange={(e) => onCambiar(ej.id, { semanas: ej.semanas.map((c) => c.semana === s ? { ...c, prescripcion: e.target.value } : c) })} />{!celda ? <span className="text-destructive">Falta crear esta celda.</span> : null}{celda?.peso && <span className="block text-muted-foreground">Usado: {celda.peso} kg</span>}</label>;
          })}
          <label className="min-w-0 space-y-1 text-xs text-muted-foreground"><span className={cn(tabla && "sr-only")}>Descanso</span><Input aria-label={`Descanso de ${ej.nombre || "ejercicio"}`} maxLength={30} value={ej.descanso} onChange={(e) => onCambiar(ej.id, { descanso: e.target.value })} placeholder="60 s" /></label>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={`Quitar ${ej.nombre || "ejercicio"}`} disabled={ocupado || sucio} onClick={() => onQuitar(ej.id)}><Trash2 /></Button>
        </div>)}
        {!delBloque.length && <p className="py-3 text-sm text-muted-foreground">Agregá los ejercicios que se hacen en este bloque.</p>}
        <Button type="button" variant="ghost" size="sm" className="text-primary" disabled={altaPendiente} onClick={() => onAgregar(grupo)}><Plus />Agregar ejercicio</Button>
      </section>;
    })}
    {arrastrando && libre && <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => soltar(e, libre)} className="rounded-xl border border-dashed border-primary/60 p-5 text-center text-sm text-muted-foreground">Soltá acá para separar en un bloque individual</div>}
    {!grupos.length && <p className="py-4 text-sm text-muted-foreground">Creá el primer bloque y después agregá sus ejercicios.</p>}
    <Button type="button" variant="outline" size="sm" disabled={!libre} onClick={onCrearBloque}><Plus />Crear bloque</Button>
    {grupos.length > 0 && <details className="text-xs text-muted-foreground"><summary className="w-fit cursor-pointer py-1">Cómo organizar los ejercicios</summary><p className="mt-2 max-w-prose leading-relaxed">Los ejercicios del mismo bloque se hacen juntos. Arrastralos entre bloques o desplegá “Mover a otro bloque”. Una semana vacía repite la última indicación anterior.</p></details>}
  </div>;
}
