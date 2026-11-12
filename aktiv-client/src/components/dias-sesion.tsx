"use client";

import { useState } from "react";
import { ChevronDown, CalendarDays } from "lucide-react";
import { DIAS_PLAN } from "@aktiv/contrato";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function DiasSesion({ value, onChange, disabled, name }: { value: number[]; onChange: (dias: number[]) => void; disabled?: boolean; name?: string }) {
  const [abierto, setAbierto] = useState(false);
  return <>
    {name && <input type="hidden" name={name} value={JSON.stringify(value)} />}
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger render={<Button type="button" variant="outline" disabled={disabled} aria-label="Asignar días de la semana" className="h-auto max-w-full justify-start whitespace-normal text-left" />}>
        <CalendarDays className="shrink-0" /><span>{value.length ? value.map(d => DIAS_PLAN[d - 1]).join(", ") : "Asignar días"}</span><ChevronDown className="shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-[calc(100vw-2rem)]" aria-label="Días de la semana">
        <p className="px-2 text-sm text-muted-foreground">Elegí uno o varios días. Comparten la misma rutina.</p>
        {DIAS_PLAN.map((dia, i) => <label key={dia} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted">
          <input type="checkbox" checked={value.includes(i + 1)} disabled={disabled} className="size-4 accent-primary" onChange={e => onChange(e.target.checked ? [...value, i + 1].sort((a,b)=>a-b) : value.filter(d => d !== i + 1))} />{dia}
        </label>)}
        <div className="flex justify-between border-t pt-2"><Button type="button" variant="ghost" size="sm" disabled={disabled || !value.length} onClick={()=>onChange([])}>Sin asignar</Button><Button type="button" size="sm" onClick={()=>setAbierto(false)}>Listo</Button></div>
      </PopoverContent>
    </Popover>
  </>;
}
