"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIAS, EJERCICIOS_CATALOGO } from "@/lib/dominio";
import { useRol } from "@/lib/guards";
import { LIMITES, crearEjercicioCustomDto, validar } from "@/lib/schemas";
import { crearEjercicioPersonalizado, eliminarEjercicioPersonalizado, useStore } from "@/lib/store";
import type { CategoriaEjercicio, EjercicioCustom } from "@/lib/types";
import { cn } from "@/lib/utils";

type Fila = { nombre: string; categoria: CategoriaEjercicio; propio?: EjercicioCustom };

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function EjerciciosPage() {
  const session = useRol("coach");
  const { ejerciciosCustom, alumnos } = useStore();
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<CategoriaEjercicio | "todas">("todas");
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<EjercicioCustom | null>(null);
  const [error, setError] = useState("");
  const [categoriaNueva, setCategoriaNueva] = useState<CategoriaEjercicio>("Fuerza");

  const filas: Fila[] = useMemo(
    () => [
      ...EJERCICIOS_CATALOGO,
      ...ejerciciosCustom.map((e) => ({ nombre: e.nombre, categoria: e.categoria, propio: e })),
    ],
    [ejerciciosCustom],
  );

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return filas.filter(
      (f) => (categoria === "todas" || f.categoria === categoria) && sinTildes(f.nombre).includes(q),
    );
  }, [filas, busqueda, categoria]);

  /** cuántos planes usan cada ejercicio, para avisar al borrarlo */
  const usos = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alumnos) {
      for (const p of a.planes) for (const e of p.ejercicios) m.set(e.nombre, (m.get(e.nombre) ?? 0) + 1);
    }
    return m;
  }, [alumnos]);

  if (!session) return null;

  function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nombre = String(new FormData(e.currentTarget).get("nombre")).trim();
    const v = validar(crearEjercicioCustomDto, { nombre, categoria: categoriaNueva });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    const yaEstaba = filas.some((f) => f.nombre.toLowerCase() === v.datos.nombre.toLowerCase());
    if (yaEstaba) {
      setError("Ese ejercicio ya está en la lista");
      return;
    }
    crearEjercicioPersonalizado(v.datos.nombre, v.datos.categoria);
    setNuevoAbierto(false);
    setError("");
    setCategoria("todas");
    setBusqueda("");
    toast.success(`“${v.datos.nombre}” se sumó a la lista`);
  }

  function borrar() {
    if (!aBorrar) return;
    eliminarEjercicioPersonalizado(aBorrar.id);
    toast.success(`“${aBorrar.nombre}” se sacó de la lista`);
    setABorrar(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ejercicios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu lista de ejercicios. Los elegís al armar el plan de cada alumno.
          </p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setCategoriaNueva(categoria === "todas" ? "Fuerza" : categoria);
            setNuevoAbierto(true);
          }}
        >
          <Plus data-icon="inline-start" />
          <span className="hidden sm:inline">Nuevo ejercicio</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </header>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar ejercicio…"
            aria-label="Buscar ejercicio"
            className="h-10 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoría">
          {(["todas", ...CATEGORIAS] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={categoria === c}
              onClick={() => setCategoria(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                categoria === c
                  ? "border-primary/40 bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c === "todas" ? "Todos" : c}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {busqueda.trim()
            ? `No hay ejercicios que coincidan con “${busqueda.trim()}”.`
            : "Todavía no hay ejercicios en esta categoría."}
        </p>
      ) : (
        <div className="space-y-6">
          {CATEGORIAS.filter((c) => visibles.some((f) => f.categoria === c)).map((c) => {
            const delGrupo = visibles.filter((f) => f.categoria === c);
            return (
              <section key={c} aria-label={c} className="space-y-2">
                <h2 className="flex items-baseline gap-2 text-sm font-medium">
                  {c}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">{delGrupo.length}</span>
                </h2>
                <Card className="gap-0 divide-y py-0">
                  {delGrupo.map((f) => (
                    <div key={f.nombre} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm">{f.nombre}</span>
                      {(usos.get(f.nombre) ?? 0) > 0 && (
                        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                          en {usos.get(f.nombre)} {usos.get(f.nombre) === 1 ? "plan" : "planes"}
                        </span>
                      )}
                      {f.propio ? (
                        <>
                          <Badge variant="outline" className="border-transparent bg-primary/12 text-primary">
                            Tuyo
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Eliminar ${f.nombre}`}
                            onClick={() => setABorrar(f.propio!)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </>
                      ) : (
                        <span className="w-[3.25rem]" aria-hidden />
                      )}
                    </div>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={crear} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nuevo ejercicio</DialogTitle>
              <DialogDescription>
                Se suma a tu lista y ya lo podés elegir en los planes. En los de fuerza el alumno anota el peso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="e-nombre">Nombre</Label>
              <Input
                id="e-nombre"
                name="nombre"
                required
                autoFocus
                maxLength={LIMITES.nombre}
                autoComplete="off"
                placeholder="Ej: Hip thrust"
                onChange={() => setError("")}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={categoriaNueva}
                onValueChange={(v) => v && setCategoriaNueva(v as CategoriaEjercicio)}
              >
                <SelectTrigger className="w-full" aria-label="Categoría">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNuevoAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Agregar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={aBorrar !== null} onOpenChange={(o) => !o && setABorrar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Sacar “{aBorrar?.nombre}” de tu lista?</DialogTitle>
            <DialogDescription>
              {(usos.get(aBorrar?.nombre ?? "") ?? 0) > 0
                ? "Los planes que ya lo usan lo conservan; solo deja de aparecer para elegirlo."
                : "Ningún plan lo usa todavía."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setABorrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={borrar}>
              Sacar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
