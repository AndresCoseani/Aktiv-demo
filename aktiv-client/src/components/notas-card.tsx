"use client";

import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LIMITES } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** Campo de texto con guardado automático (el store ya persiste cada cambio) */
export function NotasCard({
  titulo,
  descripcion,
  placeholder,
  value,
  onChange,
  className,
}: {
  titulo: string;
  descripcion: string;
  placeholder: string;
  value: string;
  onChange: (valor: string) => void;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={titulo}
          maxLength={LIMITES.notas}
          className="min-h-48 flex-1 resize-y leading-relaxed lg:min-h-64"
        />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="size-3.5 text-success" />
          Se guarda automáticamente
        </p>
      </CardContent>
    </Card>
  );
}
