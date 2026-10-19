"use client";

import { Dumbbell, Footprints } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { diaDeHoy } from "@/lib/format";
import type { DiaEntrenamiento } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_LARGOS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

/** Semana de entrenamiento: editable para Lucas, de solo lectura para el alumno */
export function SemanaCard({
  semana,
  onAlternar,
  descripcion,
  className,
}: {
  semana: DiaEntrenamiento[];
  /** si no se pasa, la semana es de solo lectura */
  onAlternar?: (dia: number, tipo: "correr" | "fuerza") => void;
  descripcion?: string;
  className?: string;
}) {
  const hoy = diaDeHoy();
  const diasCorrer = semana.filter((d) => d.correr).length;
  const diasFuerza = semana.filter((d) => d.fuerza).length;
  const tocaHoy = [
    semana[hoy]?.correr && "correr",
    semana[hoy]?.fuerza && "fuerza",
  ].filter(Boolean);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{onAlternar ? "Semana de entrenamiento" : "Mi semana"}</CardTitle>
        <CardDescription>
          {descripcion ??
            `${diasCorrer} ${diasCorrer === 1 ? "día" : "días"} de running · ${diasFuerza} de fuerza`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {semana.map((d, i) => {
            const esHoy = i === hoy;
            return (
              <li
                key={DIAS[i]}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2 sm:py-2.5",
                  esHoy && "border-primary/50 bg-primary/[0.07]",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium",
                    esHoy ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-label={DIAS_LARGOS[i]}
                >
                  {DIAS[i]}
                </span>
                {onAlternar ? (
                  <div className="flex flex-col gap-1">
                    <Toggle
                      activo={d.correr}
                      tipo="correr"
                      dia={DIAS_LARGOS[i]}
                      onClick={() => onAlternar(i, "correr")}
                    />
                    <Toggle
                      activo={d.fuerza}
                      tipo="fuerza"
                      dia={DIAS_LARGOS[i]}
                      onClick={() => onAlternar(i, "fuerza")}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1">
                    {d.correr && <Insignia tipo="correr" />}
                    {d.fuerza && <Insignia tipo="fuerza" />}
                    {!d.correr && !d.fuerza && (
                      <span className="text-[0.6rem] text-muted-foreground/70 sm:text-[0.65rem]">
                        Descanso
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Footprints className="size-3.5 text-primary" />
              Correr
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Dumbbell className="size-3.5 text-warning" />
              Fuerza
            </span>
          </div>
          {!onAlternar && (
            <p className="text-sm text-foreground">
              {tocaHoy.length
                ? `Hoy te toca: ${tocaHoy.join(" + ")}`
                : "Hoy es día de descanso"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const ESTILO = {
  correr: {
    icon: Footprints,
    activo: "bg-primary/15 text-primary border-primary/40",
    etiqueta: "Correr",
  },
  fuerza: {
    icon: Dumbbell,
    activo: "bg-warning/15 text-warning border-warning/40",
    etiqueta: "Fuerza",
  },
} as const;

function Toggle({
  activo,
  tipo,
  dia,
  onClick,
}: {
  activo: boolean;
  tipo: "correr" | "fuerza";
  dia: string;
  onClick: () => void;
}) {
  const { icon: Icon, activo: estiloActivo, etiqueta } = ESTILO[tipo];
  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label={`${etiqueta} el ${dia}`}
      onClick={onClick}
      className={cn(
        "grid size-9 place-items-center rounded-lg border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-10",
        activo
          ? estiloActivo
          : "border-dashed text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Insignia({ tipo }: { tipo: "correr" | "fuerza" }) {
  const { icon: Icon, activo, etiqueta } = ESTILO[tipo];
  return (
    <span
      title={etiqueta}
      className={cn("grid size-9 place-items-center rounded-lg border sm:size-10", activo)}
    >
      <Icon className="size-4" />
      <span className="sr-only">{etiqueta}</span>
    </span>
  );
}
