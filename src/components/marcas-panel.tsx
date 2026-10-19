"use client";

import { useMemo, useState } from "react";
import { Medal, Pencil, Plus, Timer, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DISTANCIAS, distanciaLabel } from "@/lib/dominio";
import { LIMITES, nuevaMarcaSchema, validar } from "@/lib/schemas";
import {
  formatFecha,
  formatRitmo,
  formatTiempo,
  hoyISO,
  parseTiempo,
} from "@/lib/format";
import { actualizarMarca, agregarMarca, quitarMarca } from "@/lib/store";
import type { Alumno, Marca } from "@/lib/types";

const clave = (km: number) => km.toFixed(3);

/** Mejor marca (menor tiempo) de cada distancia, de la más corta a la más larga */
function mejoresMarcas(marcas: Marca[]) {
  const mejores = new Map<string, Marca>();
  for (const m of marcas) {
    const actual = mejores.get(clave(m.distanciaKm));
    if (!actual || m.tiempoSeg < actual.tiempoSeg) {
      mejores.set(clave(m.distanciaKm), m);
    }
  }
  return [...mejores.values()].sort((a, b) => a.distanciaKm - b.distanciaKm);
}

/** Mejores marcas y tiempos del alumno; lo editan el profe y el propio alumno */
export function MarcasPanel({ alumno }: { alumno: Alumno }) {
  const [filtro, setFiltro] = useState("todas");
  const [dialogo, setDialogo] = useState<Marca | "nueva" | null>(null);

  const mejores = useMemo(() => mejoresMarcas(alumno.marcas), [alumno.marcas]);
  const idsMejores = useMemo(() => new Set(mejores.map((m) => m.id)), [mejores]);

  const distancias = useMemo(
    () => [...new Set(alumno.marcas.map((m) => clave(m.distanciaKm)))].sort(),
    [alumno.marcas],
  );
  const opcionesFiltro: Record<string, string> = {
    todas: "Todas las distancias",
    ...Object.fromEntries(distancias.map((d) => [d, distanciaLabel(Number(d))])),
  };

  const historial = useMemo(
    () =>
      alumno.marcas
        .filter((m) => filtro === "todas" || clave(m.distanciaKm) === filtro)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [alumno.marcas, filtro],
  );

  return (
    <div className="space-y-6">
      <section aria-label="Mejores marcas" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Mejores marcas</h2>
          <Button onClick={() => setDialogo("nueva")}>
            <Plus data-icon="inline-start" />
            Nueva marca
          </Button>
        </div>

        {mejores.length ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {mejores.map((m) => (
              <li key={m.id}>
                <Card className="h-full gap-0 border-primary/25 bg-primary/[0.05] py-4">
                  <CardContent className="space-y-1 px-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {distanciaLabel(m.distanciaKm)}
                      </span>
                      <Medal className="size-4 text-primary" />
                    </div>
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">
                      {formatTiempo(m.tiempoSeg)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatRitmo(m.tiempoSeg, m.distanciaKm)} /km
                    </p>
                    <p className="truncate pt-1 text-xs text-muted-foreground">
                      {formatFecha(m.fecha, { conAnio: true })}
                      {m.carrera && ` · ${m.carrera}`}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
            <Timer className="size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">Todavía no hay marcas</p>
            <p className="text-sm text-muted-foreground">
              Anotá tu mejor tiempo en una distancia para empezar a seguirlo.
            </p>
          </div>
        )}
      </section>

      {alumno.marcas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>Todas las marcas, de la más reciente a la más antigua.</CardDescription>
            <CardAction>
              <Select
                value={filtro}
                onValueChange={(v) => v && setFiltro(v)}
                items={opcionesFiltro}
              >
                <SelectTrigger size="sm" aria-label="Filtrar por distancia" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {Object.entries(opcionesFiltro).map(([v, t]) => (
                    <SelectItem key={v} value={v}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {historial.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="w-12 shrink-0 text-sm font-semibold">
                    {distanciaLabel(m.distanciaKm)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="font-medium tabular-nums">
                        {formatTiempo(m.tiempoSeg)}
                      </span>
                      {idsMejores.has(m.id) && (
                        <Badge className="h-5 bg-primary/15 px-1.5 text-[0.65rem] text-primary">
                          MEJOR
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatFecha(m.fecha, { conAnio: true })}
                      {m.carrera && ` · ${m.carrera}`}
                    </p>
                  </div>
                  <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
                    {formatRitmo(m.tiempoSeg, m.distanciaKm)} /km
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar marca"
                      onClick={() => setDialogo(m)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar marca"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => quitarMarca(alumno.id, m.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(abierto) => !abierto && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          {dialogo !== null && (
            <MarcaForm
              key={dialogo === "nueva" ? "nueva" : dialogo.id}
              alumnoId={alumno.id}
              editando={dialogo === "nueva" ? null : dialogo}
              onClose={() => setDialogo(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────── Formulario ───────────── */

const OTRA = "otra";

export function SelectorDistancia({
  km,
  onChange,
}: {
  km: number;
  onChange: (km: number) => void;
}) {
  const esPreset = DISTANCIAS.some((d) => Math.abs(d.km - km) < 0.001);
  const [otra, setOtra] = useState(!esPreset);
  const items: Record<string, string> = {
    ...Object.fromEntries(DISTANCIAS.map((d) => [String(d.km), d.label])),
    [OTRA]: "Otra distancia",
  };
  const valor = otra ? OTRA : String(DISTANCIAS.find((d) => Math.abs(d.km - km) < 0.001)?.km);

  return (
    <div className="space-y-2">
      <Select
        value={valor}
        onValueChange={(v) => {
          if (!v) return;
          if (v === OTRA) {
            setOtra(true);
            return;
          }
          setOtra(false);
          onChange(Number(v));
        }}
        items={items}
      >
        <SelectTrigger className="w-full" aria-label="Distancia">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {Object.entries(items).map(([v, t]) => (
            <SelectItem key={v} value={v}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {otra && (
        <div className="relative">
          <Input
            type="number"
            inputMode="decimal"
            min={0.1}
            step="0.1"
            value={km || ""}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            placeholder="Ej: 12"
            aria-label="Kilómetros"
            className="pr-10"
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
            km
          </span>
        </div>
      )}
    </div>
  );
}

function MarcaForm({
  alumnoId,
  editando,
  onClose,
}: {
  alumnoId: string;
  editando: Marca | null;
  onClose: () => void;
}) {
  const [km, setKm] = useState(editando?.distanciaKm ?? 5);
  const [tiempo, setTiempo] = useState(editando ? formatTiempo(editando.tiempoSeg) : "");
  const [error, setError] = useState("");

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const seg = parseTiempo(tiempo);
    if (!seg) {
      setError("Escribilo como mm:ss o h:mm:ss. Ej: 24:35 o 1:45:10");
      return;
    }
    const f = new FormData(e.currentTarget);
    const v = validar(nuevaMarcaSchema, {
      distanciaKm: km,
      tiempoSeg: seg,
      fecha: String(f.get("fecha")) || hoyISO(),
      carrera: String(f.get("carrera")).trim(),
    });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (editando) actualizarMarca(alumnoId, editando.id, v.datos);
    else agregarMarca(alumnoId, v.datos);
    onClose();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{editando ? "Editar marca" : "Nueva marca"}</DialogTitle>
        <DialogDescription>Distancia, tiempo, día y en qué carrera la hiciste.</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label>Distancia</Label>
        <SelectorDistancia km={km} onChange={setKm} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="m-tiempo">Tiempo</Label>
          <Input
            id="m-tiempo"
            value={tiempo}
            onChange={(e) => {
              setTiempo(e.target.value);
              setError("");
            }}
            placeholder="mm:ss o h:mm:ss"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={Boolean(error) && !parseTiempo(tiempo)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="m-fecha">Día</Label>
          <Input
            id="m-fecha"
            name="fecha"
            type="date"
            max={hoyISO()}
            defaultValue={editando?.fecha ?? hoyISO()}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="m-carrera">Carrera</Label>
        <Input
          id="m-carrera"
          name="carrera"
          defaultValue={editando?.carrera}
          maxLength={LIMITES.nombreCarrera}
          placeholder="Ej: 10K Parque Centenario (o “Entrenamiento”)"
          autoComplete="off"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">Guardar</Button>
      </DialogFooter>
    </form>
  );
}
