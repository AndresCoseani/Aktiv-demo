"use client";

import { useState } from "react";
import { CircleCheck, ClipboardList, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { EjercicioCombobox } from "@/components/ejercicio-combobox";
import { PesoInput } from "@/components/peso-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { admitePeso } from "@/lib/data";
import { hoyISO } from "@/lib/format";
import {
  activarPlan,
  actualizarEjercicio,
  agregarEjercicio,
  crearPlan,
  eliminarPlan,
  quitarEjercicio,
  renombrarPlan,
} from "@/lib/store";
import type { Alumno } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlanEditor({ alumno }: { alumno: Alumno }) {
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [borrarAbierto, setBorrarAbierto] = useState(false);

  const plan =
    alumno.planes.find((p) => p.id === seleccionId) ??
    alumno.planes.find((p) => p.id === alumno.planActivoId) ??
    alumno.planes[0];
  const esActivo = plan?.id === alumno.planActivoId;
  const totalSeries = plan?.ejercicios.reduce((n, e) => n + e.series, 0) ?? 0;

  function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nombre = String(new FormData(e.currentTarget).get("nombre")).trim();
    const nuevo = crearPlan(alumno.id, nombre || `Plan ${alumno.planes.length + 1}`);
    setSeleccionId(nuevo.id);
    setNuevoAbierto(false);
    toast.success("Plan creado");
  }

  function borrar() {
    if (!plan) return;
    eliminarPlan(alumno.id, plan.id);
    setSeleccionId(null);
    setBorrarAbierto(false);
    toast.success("Plan eliminado");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
        <CardDescription>
          {alumno.planes.length
            ? `${alumno.planes.length} ${alumno.planes.length === 1 ? "plan" : "planes"} · el activo es el que ve el alumno`
            : "Todavía no tiene planes cargados"}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setNuevoAbierto(true)}>
            <Plus data-icon="inline-start" />
            Nuevo plan
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {!plan ? (
          <Vacio onCrear={() => setNuevoAbierto(true)} />
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Planes del alumno"
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
            >
              {alumno.planes.map((p) => {
                const sel = p.id === plan.id;
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
                    {p.nombre || "Sin nombre"}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={plan.nombre}
                onChange={(e) => renombrarPlan(alumno.id, plan.id, e.target.value)}
                aria-label="Nombre del plan"
                className="h-9 min-w-0 flex-1 basis-32 border-transparent bg-transparent px-2 text-base font-semibold hover:border-input focus-visible:border-ring dark:bg-transparent"
              />
              {esActivo ? (
                <Badge className="gap-1 bg-primary/15 text-primary">
                  <CircleCheck className="size-3" />
                  Plan activo
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    activarPlan(alumno.id, plan.id);
                    toast.success("Ahora es el plan activo del alumno");
                  }}
                >
                  Marcar como activo
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar plan"
                onClick={() => setBorrarAbierto(true)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </div>

            {plan.ejercicios.length > 0 ? (
              <div>
                <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_5.5rem_2rem] gap-2 px-1 pb-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>Ejercicio</span>
                  <span>Series</span>
                  <span>Repeticiones</span>
                  <span>Peso</span>
                  <span />
                </div>
                <ul className="space-y-2">
                  {plan.ejercicios.map((ej, i) => (
                    <li
                      key={ej.id}
                      className="grid grid-cols-[4rem_minmax(0,1fr)_4.75rem_2rem] items-end gap-2 rounded-xl border bg-muted/30 p-2.5 md:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_5.5rem_2rem] md:items-center md:border-0 md:bg-transparent md:p-0"
                    >
                      <div className="col-span-full md:col-span-1">
                        <EjercicioCombobox
                          value={ej.nombre}
                          onChange={(nombre) =>
                            actualizarEjercicio(alumno.id, plan.id, ej.id, { nombre })
                          }
                        />
                      </div>
                      <label className="space-y-1 md:space-y-0">
                        <span className="block text-[0.7rem] text-muted-foreground md:hidden">
                          Series
                        </span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={99}
                          value={ej.series || ""}
                          onChange={(e) =>
                            actualizarEjercicio(alumno.id, plan.id, ej.id, {
                              series: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          aria-label={`Series del ejercicio ${i + 1}`}
                          className="tabular-nums"
                        />
                      </label>
                      <label
                        className={cn(
                          "space-y-1 md:space-y-0",
                          !admitePeso(ej.nombre) && "max-md:col-span-2",
                        )}
                      >
                        <span className="block text-[0.7rem] text-muted-foreground md:hidden">
                          Repeticiones
                        </span>
                        <Input
                          value={ej.repeticiones}
                          onChange={(e) =>
                            actualizarEjercicio(alumno.id, plan.id, ej.id, {
                              repeticiones: e.target.value,
                            })
                          }
                          aria-label={`Repeticiones del ejercicio ${i + 1}`}
                          placeholder="12"
                        />
                      </label>
                      {admitePeso(ej.nombre) ? (
                        <label className="space-y-1 md:space-y-0">
                          <span className="block text-[0.7rem] text-muted-foreground md:hidden">
                            Peso
                          </span>
                          <PesoInput
                            value={ej.peso ?? ""}
                            onChange={(peso) =>
                              actualizarEjercicio(alumno.id, plan.id, ej.id, {
                                peso,
                                pesoFecha: hoyISO(),
                              })
                            }
                            label={`Peso del ejercicio ${i + 1}`}
                          />
                        </label>
                      ) : (
                        <div className="hidden md:block" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar ejercicio ${i + 1}`}
                        onClick={() => quitarEjercicio(alumno.id, plan.id, ej.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                Este plan todavía no tiene ejercicios.
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => agregarEjercicio(alumno.id, plan.id)}
              >
                <Plus data-icon="inline-start" />
                Agregar ejercicio
              </Button>
              {plan.ejercicios.length > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {plan.ejercicios.length} ejercicios · {totalSeries} series
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={crear} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nuevo plan</DialogTitle>
              <DialogDescription>
                Después le agregás los ejercicios, series y repeticiones.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="plan-nombre">Nombre del plan</Label>
              <Input
                id="plan-nombre"
                name="nombre"
                placeholder="Ej: Semana 3 · Velocidad"
                autoComplete="off"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNuevoAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={borrarAbierto} onOpenChange={setBorrarAbierto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar este plan?</DialogTitle>
            <DialogDescription>
              Se borra “{plan?.nombre}” con todos sus ejercicios. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBorrarAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={borrar}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Vacio({ onCrear }: { onCrear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
      <ClipboardList className="size-8 text-muted-foreground/60" />
      <div>
        <p className="text-sm font-medium">Sin planes todavía</p>
        <p className="text-sm text-muted-foreground">
          Creá el primero para que el alumno lo vea en su cuenta.
        </p>
      </div>
      <Button onClick={onCrear}>
        <Plus data-icon="inline-start" />
        Crear plan
      </Button>
    </div>
  );
}
