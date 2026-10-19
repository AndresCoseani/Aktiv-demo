"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { NotasCard } from "@/components/notas-card";
import { PesoInput } from "@/components/peso-input";
import { SemanaCard } from "@/components/semana-card";
import { PagoTexto } from "@/components/estado";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { admitePeso, categoriaDe } from "@/lib/data";
import { formatFecha, formatFechaLarga, hoyISO } from "@/lib/format";
import { useRol } from "@/lib/guards";
import { actualizarAlumno, actualizarEjercicio, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function MiPlanPage() {
  const session = useRol("alumno");
  const { alumnos } = useStore();
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  const alumno = alumnos.find((a) => a.id === session?.alumnoId);
  if (!session || !alumno) return null;

  const plan =
    alumno.planes.find((p) => p.id === seleccionId) ??
    alumno.planes.find((p) => p.id === alumno.planActivoId) ??
    alumno.planes[0];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{formatFechaLarga()}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Hola, {session.nombre}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este es el plan que armó Lucas para vos.
          </p>
        </div>
        {alumno.activo && alumno.proximoPago && (
          <div className="rounded-xl border bg-card px-4 py-2.5 text-sm">
            <p className="text-xs text-muted-foreground">Próximo pago</p>
            <PagoTexto fecha={alumno.proximoPago} />
          </div>
        )}
      </header>

      <SemanaCard semana={alumno.semana} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card>
          <CardHeader>
            <CardTitle>Mi plan</CardTitle>
            <CardDescription>
              {plan
                ? plan.nombre
                : "Todavía no tenés un plan cargado. Lucas lo va a subir pronto."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {alumno.planes.length > 1 && (
              <div
                role="tablist"
                aria-label="Mis planes"
                className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
              >
                {alumno.planes.map((p) => {
                  const sel = p.id === plan?.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={sel}
                      onClick={() => setSeleccionId(p.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        sel
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {p.id === alumno.planActivoId && (
                        <CircleCheck className="size-3.5 text-primary" />
                      )}
                      {p.nombre}
                    </button>
                  );
                })}
              </div>
            )}

            {plan &&
              (plan.ejercicios.length ? (
                <ol className="divide-y rounded-xl border">
                  {plan.ejercicios.map((ej, i) => (
                    <li key={ej.id} className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground tabular-nums">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {ej.nombre || "Ejercicio sin elegir"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {categoriaDe(ej.nombre) ?? "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2 text-center text-xs">
                          <Dato valor={String(ej.series)} etiqueta="series" />
                          <Dato valor={ej.repeticiones || "—"} etiqueta="reps" />
                        </div>
                      </div>
                      {admitePeso(ej.nombre) && (
                        <div className="mt-2.5 flex items-center gap-2.5 pl-10">
                          <span className="text-xs whitespace-nowrap text-muted-foreground">Peso usado</span>
                          <PesoInput
                            value={ej.peso ?? ""}
                            onChange={(peso) =>
                              actualizarEjercicio(alumno.id, plan.id, ej.id, {
                                peso,
                                pesoFecha: hoyISO(),
                              })
                            }
                            label={`Peso usado en ${ej.nombre}`}
                            className="w-24"
                          />
                          {ej.peso && ej.pesoFecha && (
                            <span className="text-xs whitespace-nowrap text-muted-foreground">
                              Anotado el {formatFecha(ej.pesoFecha)}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Este plan todavía no tiene ejercicios.
                </p>
              ))}
          </CardContent>
        </Card>

        <NotasCard
          titulo="Mis notas"
          descripcion="Cómo te sentiste, dudas para Lucas, marcas…"
          placeholder="Ej: hoy hice las series a buen ritmo, sentí un poco de cansancio al final…"
          value={alumno.notasAlumno}
          onChange={(notasAlumno) => actualizarAlumno(alumno.id, { notasAlumno })}
        />
      </div>
    </div>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="min-w-14 rounded-lg bg-muted px-2.5 py-1.5">
      <p className="text-sm font-semibold tabular-nums">{valor}</p>
      <p className="text-muted-foreground">{etiqueta}</p>
    </div>
  );
}
