"use client";

import { useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const numero = (valor: number) => String(valor).padStart(2, "0");
function normalizarHora(texto: string) {
  const limpio = texto.trim();
  if (/^\d{4}$/.test(limpio)) return `${limpio.slice(0, 2)}:${limpio.slice(2)}`;
  if (/^\d{1}:\d{2}$/.test(limpio)) return `0${limpio}`;
  return limpio;
}

/** Selector 24 h compuesto con shadcn/Base UI, sin el popup nativo del navegador. */
export function HoraSelector({ value, onChange, etiqueta }: { value: string; onChange: (valor: string) => void; etiqueta: string }) {
  const [abierto, setAbierto] = useState(false);
  const [hora, setHora] = useState("");
  const [minuto, setMinuto] = useState("00");
  const columnas = useRef<HTMLDivElement>(null);

  return <Popover open={abierto} onOpenChange={(abrir) => { if (abrir) { const texto = normalizarHora(value); const valida = /^([01]\d|2[0-3]):[0-5]\d$/.test(texto); const [h, m] = valida ? texto.split(":") : ["", "00"]; setHora(h); setMinuto(m); } setAbierto(abrir); }}>
    <div className="relative min-w-0">
      <Input aria-label={etiqueta} type="text" value={value} maxLength={5} placeholder="HH:mm" autoComplete="off" className="h-11 pr-11 font-normal tabular-nums" onChange={(e) => onChange(e.target.value)} onBlur={(e) => onChange(normalizarHora(e.target.value))} />
      <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" className="absolute right-2 top-2 text-muted-foreground" aria-label={`Elegir ${etiqueta.toLowerCase()}`} title="Elegir hora" />}><Clock3 className="size-4" /></PopoverTrigger>
    </div>
    <PopoverContent align="start" className="w-60 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0" aria-label={`Seleccionar ${etiqueta.toLowerCase()}`} initialFocus={() => { const seleccionados = columnas.current?.querySelectorAll<HTMLElement>('[aria-pressed="true"]'); seleccionados?.forEach((elemento) => elemento.scrollIntoView({ block: "nearest" })); return seleccionados?.[0] ?? true; }}>
      <div className="border-b px-4 py-3"><p className="text-sm font-medium tabular-nums">{hora ? `${hora}:${minuto}` : "Elegí una hora"}<span className="float-right text-xs font-normal text-muted-foreground">24 h</span></p></div>
      <div ref={columnas} className="grid grid-cols-2 divide-x">
        {[{ titulo: "Hora", cantidad: 24, actual: hora, elegir: setHora }, { titulo: "Minutos", cantidad: 60, actual: minuto, elegir: setMinuto }].map((columna) => <div key={columna.titulo} className="min-w-0">
          <p className="py-2 text-center text-xs text-muted-foreground">{columna.titulo}</p>
          <div role="group" aria-label={columna.titulo} className="h-48 overflow-y-auto overscroll-contain px-2 pb-2">
            {Array.from({ length: columna.cantidad }, (_, i) => numero(i)).map((n) => <Button key={n} type="button" variant={columna.actual === n ? "secondary" : "ghost"} className={`mb-1 h-9 w-full font-normal tabular-nums ${columna.actual === n ? "bg-primary/15 text-primary" : ""}`} aria-label={`${columna.titulo} ${n}`} aria-pressed={columna.actual === n} onClick={() => columna.elegir(n)}>{n}</Button>)}
          </div>
        </div>)}
      </div>
      <div className="flex items-center justify-between border-t p-2"><Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setAbierto(false); }}>Limpiar</Button><Button type="button" size="sm" disabled={!hora} onClick={() => { onChange(`${hora}:${minuto}`); setAbierto(false); }}>Listo</Button></div>
    </PopoverContent>
  </Popover>;
}
