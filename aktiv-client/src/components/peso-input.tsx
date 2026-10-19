"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Campo de kg para anotar el peso usado en un ejercicio de fuerza o core */
export function PesoInput({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (valor: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
        inputMode="decimal"
        placeholder="0"
        aria-label={label}
        className="pr-8 tabular-nums"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
        kg
      </span>
    </div>
  );
}
