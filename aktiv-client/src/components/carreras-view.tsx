"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Flag, MapPin, Pencil, Plus, Timer, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DISTANCIAS, distanciaLabel } from "@/lib/dominio";
import {
  LIMITES,
  crearCarreraDto,
  inscribirAlumnoDto,
  registrarResultadoDto,
  validar,
} from "@/lib/schemas";
import {
  diasHasta,
  formatFecha,
  formatRitmo,
  formatTiempo,
  hoyISO,
  parseISO,
  parseTiempo,
} from "@/lib/format";
import {
  actualizarCarrera,
  actualizarInscripcion,
  crearCarrera,
  inscribirAlumno,
  quitarCarrera,
  quitarInscripcion,
  registrarResultado,
  useStore,
} from "@/lib/store";
import type { Alumno, Carrera, Inscripcion } from "@/lib/types";
import { cn } from "@/lib/utils";

function cuentaRegresiva(fecha: string) {
  const d = diasHasta(fecha);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  return `En ${d} días`;
}

function FechaBloque({ fecha }: { fecha: string }) {
  const f = parseISO(fecha);
  const pasada = diasHasta(fecha) < 0;
  const mes = f.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  return (
    <div
      className={cn(
        "flex size-14 shrink-0 flex-col items-center justify-center rounded-lg",
        pasada ? "bg-muted text-muted-foreground" : "bg-primary/12 text-primary",
      )}
    >
      <span className="text-xl leading-none font-semibold tabular-nums">{f.getDate()}</span>
      <span className="mt-0.5 text-[0.65rem] tracking-wide uppercase">{mes}</span>
    </div>
  );
}

function KmChips({ kms }: { kms: number[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {[...kms]
        .sort((a, b) => a - b)
        .map((km) => (
          <Badge key={km} variant="outline" className="h-5 px-1.5 text-[0.7rem] font-medium">
            {distanciaLabel(km)}
          </Badge>
        ))}
    </span>
  );
}

/* ═════════════ Calendario del profe ═════════════ */

/** Carreras que carga el profe. Los alumnos se asignan después, desde su perfil. */
export function CarrerasCatalogo() {
  const { carreras, inscripciones } = useStore();
  const [tab, setTab] = useState("proximas");
  const [dialogo, setDialogo] = useState<Carrera | "nueva" | null>(null);
  const [inscriptos, setInscriptos] = useState<Carrera | null>(null);
  const [borrar, setBorrar] = useState<Carrera | null>(null);

  const hoy = hoyISO();
  const proximas = useMemo(
    () => carreras.filter((c) => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [carreras, hoy],
  );
  const pasadas = useMemo(
    () => carreras.filter((c) => c.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [carreras, hoy],
  );
  const cantidad = (id: string) => inscripciones.filter((i) => i.carreraId === id).length;

  const lista = (items: Carrera[], vacio: string) =>
    items.length ? (
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
            <FechaBloque fecha={c.fecha} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-medium">{c.nombre}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                {c.lugar && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {c.lugar}
                  </span>
                )}
                <KmChips kms={c.distanciasKm} />
              </div>
              {c.notas && (
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {c.notas}
                </p>
              )}
              <button
                type="button"
                onClick={() => setInscriptos(c)}
                className="inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Users className="size-3.5" />
                {cantidad(c.id) === 0
                  ? "Sin alumnos anotados"
                  : `${cantidad(c.id)} ${cantidad(c.id) === 1 ? "alumno anotado" : "alumnos anotados"}`}
              </button>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {diasHasta(c.fecha) >= 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border-transparent",
                    diasHasta(c.fecha) <= 7
                      ? "bg-warning/15 text-warning"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {cuentaRegresiva(c.fecha)}
                </Badge>
              )}
              <div className="flex gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Editar ${c.nombre}`}
                  onClick={() => setDialogo(c)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Eliminar ${c.nombre}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setBorrar(c)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
        <Flag className="size-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{vacio}</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cargá las carreras acá y después asignáselas a cada alumno desde su perfil.
        </p>
        <Button onClick={() => setDialogo("nueva")} className="shrink-0">
          <Plus data-icon="inline-start" />
          Nueva carrera
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="proximas" className="sm:px-4">
            Próximas ({proximas.length})
          </TabsTrigger>
          <TabsTrigger value="pasadas" className="sm:px-4">
            Pasadas ({pasadas.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="proximas" className="pt-2">
          {lista(proximas, "No hay carreras próximas. Cargá la siguiente.")}
        </TabsContent>
        <TabsContent value="pasadas" className="pt-2">
          {lista(pasadas, "Todavía no hay carreras pasadas.")}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogo !== null} onOpenChange={(a) => !a && setDialogo(null)}>
        <DialogContent className="sm:max-w-md">
          {dialogo !== null && (
            <CarreraForm
              key={dialogo === "nueva" ? "nueva" : dialogo.id}
              editando={dialogo === "nueva" ? null : dialogo}
              onClose={() => setDialogo(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={inscriptos !== null} onOpenChange={(a) => !a && setInscriptos(null)}>
        <DialogContent className="sm:max-w-md">
          {inscriptos && <InscriptosLista carrera={inscriptos} />}
        </DialogContent>
      </Dialog>

      <Dialog open={borrar !== null} onOpenChange={(a) => !a && setBorrar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar esta carrera?</DialogTitle>
            <DialogDescription>
              Se borra “{borrar?.nombre}”
              {borrar && cantidad(borrar.id) > 0
                ? ` y se quita a los ${cantidad(borrar.id)} alumnos anotados. Las marcas ya guardadas no se tocan.`
                : "."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBorrar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (borrar) quitarCarrera(borrar.id);
                setBorrar(null);
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Quiénes están anotados (se ve solo al tocar, no en cada tarjeta) */
function InscriptosLista({ carrera }: { carrera: Carrera }) {
  const { alumnos, inscripciones } = useStore();
  const filas = inscripciones
    .filter((i) => i.carreraId === carrera.id)
    .map((i) => ({ i, alumno: alumnos.find((a) => a.id === i.alumnoId) }))
    .filter((f): f is { i: Inscripcion; alumno: Alumno } => Boolean(f.alumno))
    .sort((a, b) => a.alumno.nombre.localeCompare(b.alumno.nombre));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Alumnos anotados</DialogTitle>
        <DialogDescription>{carrera.nombre}</DialogDescription>
      </DialogHeader>
      {filas.length ? (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {filas.map(({ i, alumno }) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <Link href={`/alumnos/${alumno.id}`} className="min-w-0 truncate font-medium hover:underline">
                {alumno.nombre}
              </Link>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                <Badge variant="outline" className="h-5 px-1.5">
                  {distanciaLabel(i.distanciaKm)}
                </Badge>
                {i.resultadoSeg
                  ? formatTiempo(i.resultadoSeg)
                  : i.objetivoSeg
                    ? `Obj. ${formatTiempo(i.objetivoSeg)}`
                    : "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Todavía no hay alumnos anotados. Asignalos desde el perfil de cada alumno.
        </p>
      )}
    </>
  );
}

/** Distancias disponibles: botones para las comunes y un campo para otras */
function SelectorDistancias({
  valor,
  onChange,
}: {
  valor: number[];
  onChange: (km: number[]) => void;
}) {
  const [otra, setOtra] = useState("");
  const esPreset = (km: number) => DISTANCIAS.some((d) => Math.abs(d.km - km) < 0.001);
  const tiene = (km: number) => valor.some((v) => Math.abs(v - km) < 0.001);
  const alternar = (km: number) =>
    onChange(tiene(km) ? valor.filter((v) => Math.abs(v - km) >= 0.001) : [...valor, km]);
  const personalizadas = valor.filter((v) => !esPreset(v));

  function agregarOtra() {
    const km = Number(otra.replace(",", "."));
    if (!(km > 0) || km > 1000) return;
    if (!tiene(km)) onChange([...valor, km]);
    setOtra("");
  }

  const chip = (km: number, texto: string) => (
    <button
      key={km}
      type="button"
      aria-pressed={tiene(km)}
      onClick={() => alternar(km)}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        tiene(km)
          ? "border-primary/50 bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {texto}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {DISTANCIAS.map((d) => chip(d.km, d.label))}
        {personalizadas.map((km) => chip(km, distanciaLabel(km)))}
      </div>
      <div className="flex gap-2">
        <Input
          value={otra}
          onChange={(e) => setOtra(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregarOtra();
            }
          }}
          inputMode="decimal"
          placeholder="Otra distancia (km)"
          aria-label="Otra distancia en kilómetros"
          className="h-8"
        />
        <Button type="button" variant="outline" size="sm" onClick={agregarOtra} className="h-8">
          Agregar
        </Button>
      </div>
    </div>
  );
}

function CarreraForm({ editando, onClose }: { editando: Carrera | null; onClose: () => void }) {
  const { inscripciones } = useStore();
  const [kms, setKms] = useState<number[]>(editando?.distanciasKm ?? []);
  const [error, setError] = useState("");

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editando) {
      // no se puede sacar una distancia que ya eligió algún alumno
      const enUso = inscripciones
        .filter((i) => i.carreraId === editando.id)
        .map((i) => i.distanciaKm)
        .filter((km) => !kms.some((k) => Math.abs(k - km) < 0.001));
      if (enUso.length) {
        setError(
          `Hay alumnos anotados en ${[...new Set(enUso)].map(distanciaLabel).join(", ")}. Sacalos de esa distancia primero.`,
        );
        return;
      }
    }
    const f = new FormData(e.currentTarget);
    const v = validar(crearCarreraDto, {
      nombre: String(f.get("nombre")).trim(),
      fecha: String(f.get("fecha")),
      lugar: String(f.get("lugar")).trim(),
      distanciasKm: [...kms].sort((a, b) => a - b),
      notas: String(f.get("notas")).trim(),
    });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (editando) actualizarCarrera(editando.id, v.datos);
    else crearCarrera(v.datos);
    onClose();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{editando ? "Editar carrera" : "Nueva carrera"}</DialogTitle>
        <DialogDescription>
          Después podés asignar alumnos desde el perfil de cada uno.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="c-nombre">Nombre de la carrera</Label>
        <Input
          id="c-nombre"
          name="nombre"
          required
          defaultValue={editando?.nombre}
          placeholder="Ej: Media Maratón de la Ciudad"
          maxLength={LIMITES.nombreCarrera}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="c-fecha">Fecha</Label>
          <Input id="c-fecha" name="fecha" type="date" required defaultValue={editando?.fecha} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-lugar">Ubicación</Label>
          <Input
            id="c-lugar"
            name="lugar"
            defaultValue={editando?.lugar}
            placeholder="Ciudad o lugar"
            maxLength={LIMITES.lugar}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Kms disponibles</Label>
        <SelectorDistancias
          valor={kms}
          onChange={(v) => {
            setKms(v);
            setError("");
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="c-notas">Notas</Label>
        <Textarea
          id="c-notas"
          name="notas"
          defaultValue={editando?.notas}
          placeholder="Inscripción, retiro de kit, horarios, recomendaciones…"
          maxLength={LIMITES.notasCarrera}
          className="min-h-20"
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

/* ═════════════ Carreras de un alumno ═════════════ */

/**
 * Las carreras en las que está anotado un alumno.
 * El profe puede asignarlo a una carrera ya creada; el alumno solo carga su
 * objetivo y su resultado.
 */
export function CarrerasDeAlumno({
  alumno,
  puedeAsignar,
  propia = false,
}: {
  alumno: Alumno;
  puedeAsignar: boolean;
  /** lo está viendo el propio alumno (cambia los textos: "anotarme" en vez de "asignar") */
  propia?: boolean;
}) {
  const { carreras, inscripciones } = useStore();
  const [asignar, setAsignar] = useState(false);
  const [editar, setEditar] = useState<Inscripcion | null>(null);
  const [resultado, setResultado] = useState<Inscripcion | null>(null);

  const propias = useMemo(
    () =>
      inscripciones
        .filter((i) => i.alumnoId === alumno.id)
        .map((i) => ({ i, carrera: carreras.find((c) => c.id === i.carreraId) }))
        .filter((x): x is { i: Inscripcion; carrera: Carrera } => Boolean(x.carrera)),
    [inscripciones, carreras, alumno.id],
  );
  const hoy = hoyISO();
  const proximas = propias
    .filter((x) => x.carrera.fecha >= hoy)
    .sort((a, b) => a.carrera.fecha.localeCompare(b.carrera.fecha));
  const pasadas = propias
    .filter((x) => x.carrera.fecha < hoy)
    .sort((a, b) => b.carrera.fecha.localeCompare(a.carrera.fecha));

  const grupo = (titulo: string, items: typeof propias) =>
    items.length > 0 && (
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{titulo}</h2>
        <ul className="space-y-2">
          {items.map(({ i, carrera }) => (
            <InscripcionItem
              key={i.id}
              inscripcion={i}
              carrera={carrera}
              puedeAsignar={puedeAsignar}
              onEditar={() => setEditar(i)}
              onResultado={() => setResultado(i)}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="space-y-6">
      {puedeAsignar && (
        <div className="flex justify-end">
          <Button onClick={() => setAsignar(true)}>
            <Plus data-icon="inline-start" />
            {propia ? "Anotarme a una carrera" : "Asignar a una carrera"}
          </Button>
        </div>
      )}

      {propias.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
          <Flag className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {propia
              ? "Todavía no estás anotado en ninguna carrera. Anotate en una del calendario de tu profe."
              : "Todavía no está anotado en ninguna carrera."}
          </p>
        </div>
      ) : (
        <>
          {grupo("Próximas", proximas)}
          {grupo("Pasadas", pasadas)}
        </>
      )}

      <Dialog open={asignar} onOpenChange={setAsignar}>
        <DialogContent className="sm:max-w-md">
          {asignar && <AsignarForm alumno={alumno} propia={propia} onClose={() => setAsignar(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={editar !== null} onOpenChange={(a) => !a && setEditar(null)}>
        <DialogContent className="sm:max-w-sm">
          {editar && (
            <EditarInscripcionForm
              key={editar.id}
              inscripcion={editar}
              puedeCambiarDistancia={puedeAsignar}
              onClose={() => setEditar(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resultado !== null} onOpenChange={(a) => !a && setResultado(null)}>
        <DialogContent className="sm:max-w-sm">
          {resultado && (
            <ResultadoForm key={resultado.id} inscripcion={resultado} onClose={() => setResultado(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InscripcionItem({
  inscripcion: i,
  carrera: c,
  puedeAsignar,
  onEditar,
  onResultado,
}: {
  inscripcion: Inscripcion;
  carrera: Carrera;
  puedeAsignar: boolean;
  onEditar: () => void;
  onResultado: () => void;
}) {
  const [quitando, setQuitando] = useState(false);
  const dias = diasHasta(c.fecha);

  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <FechaBloque fecha={c.fecha} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium">{c.nombre}</p>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{distanciaLabel(i.distanciaKm)}</span>
          {c.lugar && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {c.lugar}
            </span>
          )}
          {i.objetivoSeg && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Timer className="size-3" />
              Objetivo {formatTiempo(i.objetivoSeg)}
            </span>
          )}
        </p>
        {c.notas && <p className="line-clamp-2 text-xs text-muted-foreground">{c.notas}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
        {i.resultadoSeg ? (
          <div className="leading-tight">
            <p className="text-sm font-semibold tabular-nums">{formatTiempo(i.resultadoSeg)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatRitmo(i.resultadoSeg, i.distanciaKm)} /km
            </p>
          </div>
        ) : dias <= 0 ? (
          <Button size="sm" variant="outline" onClick={onResultado}>
            Anotar resultado
          </Button>
        ) : (
          <Badge
            variant="outline"
            className={cn(
              "border-transparent",
              dias <= 7 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
            )}
          >
            {cuentaRegresiva(c.fecha)}
          </Badge>
        )}
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Editar inscripción a ${c.nombre}`}
            onClick={onEditar}
          >
            <Pencil />
          </Button>
          {puedeAsignar && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Quitar de ${c.nombre}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setQuitando(true)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={quitando} onOpenChange={setQuitando}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Quitar de la carrera?</DialogTitle>
            <DialogDescription>
              Se saca al alumno de “{c.nombre}”. La carrera sigue en el calendario.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuitando(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                quitarInscripcion(i.id);
                setQuitando(false);
              }}
            >
              Quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function AsignarForm({ alumno, propia, onClose }: { alumno: Alumno; propia: boolean; onClose: () => void }) {
  const { carreras, inscripciones } = useStore();
  const hoy = hoyISO();

  const disponibles = useMemo(() => {
    const ya = new Set(inscripciones.filter((i) => i.alumnoId === alumno.id).map((i) => i.carreraId));
    const libres = carreras.filter((c) => !ya.has(c.id));
    return [
      ...libres.filter((c) => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)),
      ...libres.filter((c) => c.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    ];
  }, [carreras, inscripciones, alumno.id, hoy]);

  const [carreraId, setCarreraId] = useState(disponibles[0]?.id ?? "");
  const carrera = disponibles.find((c) => c.id === carreraId);
  const [km, setKm] = useState<number | null>(null);
  const [objetivo, setObjetivo] = useState("");
  const [error, setError] = useState("");

  const kmElegido = carrera
    ? (km !== null && carrera.distanciasKm.some((k) => Math.abs(k - km) < 0.001)
        ? km
        : carrera.distanciasKm[0])
    : null;

  const opcionesCarrera = Object.fromEntries(
    disponibles.map((c) => [
      c.id,
      `${c.nombre} · ${formatFecha(c.fecha)}${c.fecha < hoy ? " (pasada)" : ""}`,
    ]),
  );
  const opcionesKm = carrera
    ? Object.fromEntries(
        [...carrera.distanciasKm]
          .sort((a, b) => a - b)
          .map((k) => [String(k), distanciaLabel(k)]),
      )
    : {};

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!carrera || kmElegido === null) return;
    const objetivoSeg = objetivo.trim() ? parseTiempo(objetivo) : null;
    if (objetivo.trim() && !objetivoSeg) {
      setError("El tiempo objetivo va como mm:ss o h:mm:ss.");
      return;
    }
    const v = validar(inscribirAlumnoDto(carrera.distanciasKm), {
      distanciaKm: kmElegido,
      objetivoSeg,
    });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    inscribirAlumno(alumno.id, carrera.id, v.datos.distanciaKm, v.datos.objetivoSeg);
    onClose();
  }

  if (disponibles.length === 0) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{propia ? "Anotarme a una carrera" : "Asignar a una carrera"}</DialogTitle>
          <DialogDescription>
            {propia ? "No hay carreras disponibles." : `No hay carreras disponibles para ${alumno.nombre}.`}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {propia ? (
            "Tu profe todavía no cargó carreras nuevas en el calendario."
          ) : (
            <>
              Primero cargá la carrera en{" "}
              <Link href="/carreras" className="font-medium text-primary underline underline-offset-2">
                Carreras
              </Link>{" "}
              y después asignala desde acá.
            </>
          )}
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Entendido</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{propia ? "Anotarme a una carrera" : "Asignar a una carrera"}</DialogTitle>
        <DialogDescription>
          {propia
            ? "Elegí una carrera del calendario de tu profe y la distancia que vas a correr."
            : `Elegí una carrera ya cargada y la distancia que va a correr ${alumno.nombre}.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label>Carrera</Label>
        <Select
          value={carreraId}
          onValueChange={(v) => {
            if (!v) return;
            setCarreraId(v);
            setKm(null);
          }}
          items={opcionesCarrera}
        >
          <SelectTrigger className="w-full" aria-label="Carrera">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {Object.entries(opcionesCarrera).map(([v, t]) => (
              <SelectItem key={v} value={v}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {carrera && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {carrera.lugar && (
              <>
                <MapPin className="size-3" />
                {carrera.lugar}
              </>
            )}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Distancia</Label>
          <Select
            value={kmElegido !== null ? String(kmElegido) : ""}
            onValueChange={(v) => v && setKm(Number(v))}
            items={opcionesKm}
          >
            <SelectTrigger className="w-full" aria-label="Distancia">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {Object.entries(opcionesKm).map(([v, t]) => (
                <SelectItem key={v} value={v}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="a-objetivo">Tiempo objetivo</Label>
          <Input
            id="a-objetivo"
            value={objetivo}
            onChange={(e) => {
              setObjetivo(e.target.value);
              setError("");
            }}
            placeholder="Opcional · h:mm:ss"
            inputMode="numeric"
            autoComplete="off"
            className="tabular-nums"
          />
        </div>
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
        <Button type="submit">{propia ? "Anotarme" : "Asignar"}</Button>
      </DialogFooter>
    </form>
  );
}

function EditarInscripcionForm({
  inscripcion,
  puedeCambiarDistancia,
  onClose,
}: {
  inscripcion: Inscripcion;
  puedeCambiarDistancia: boolean;
  onClose: () => void;
}) {
  const { carreras } = useStore();
  const carrera = carreras.find((c) => c.id === inscripcion.carreraId);
  const [km, setKm] = useState(inscripcion.distanciaKm);
  const [objetivo, setObjetivo] = useState(
    inscripcion.objetivoSeg ? formatTiempo(inscripcion.objetivoSeg) : "",
  );
  const [error, setError] = useState("");

  const opcionesKm = Object.fromEntries(
    [...(carrera?.distanciasKm ?? [inscripcion.distanciaKm])]
      .sort((a, b) => a - b)
      .map((k) => [String(k), distanciaLabel(k)]),
  );

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const objetivoSeg = objetivo.trim() ? parseTiempo(objetivo) : null;
    if (objetivo.trim() && !objetivoSeg) {
      setError("El tiempo objetivo va como mm:ss o h:mm:ss.");
      return;
    }
    const v = validar(
      inscribirAlumnoDto(carrera?.distanciasKm ?? [inscripcion.distanciaKm]),
      { distanciaKm: puedeCambiarDistancia ? km : inscripcion.distanciaKm, objetivoSeg },
    );
    if (!v.ok) {
      setError(v.error);
      return;
    }
    actualizarInscripcion(inscripcion.id, {
      objetivoSeg: v.datos.objetivoSeg,
      ...(puedeCambiarDistancia ? { distanciaKm: v.datos.distanciaKm } : {}),
    });
    onClose();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{carrera?.nombre ?? "Carrera"}</DialogTitle>
        <DialogDescription>Distancia y tiempo objetivo.</DialogDescription>
      </DialogHeader>
      {puedeCambiarDistancia && (
        <div className="space-y-2">
          <Label>Distancia</Label>
          <Select value={String(km)} onValueChange={(v) => v && setKm(Number(v))} items={opcionesKm}>
            <SelectTrigger className="w-full" aria-label="Distancia">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {Object.entries(opcionesKm).map(([v, t]) => (
                <SelectItem key={v} value={v}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="e-objetivo">Tiempo objetivo</Label>
        <Input
          id="e-objetivo"
          value={objetivo}
          onChange={(e) => {
            setObjetivo(e.target.value);
            setError("");
          }}
          placeholder="Opcional · h:mm:ss"
          inputMode="numeric"
          autoComplete="off"
          className="tabular-nums"
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

function ResultadoForm({
  inscripcion,
  onClose,
}: {
  inscripcion: Inscripcion;
  onClose: () => void;
}) {
  const { carreras } = useStore();
  const carrera = carreras.find((c) => c.id === inscripcion.carreraId);
  const [tiempo, setTiempo] = useState("");
  const [sumar, setSumar] = useState(true);
  const [error, setError] = useState("");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const seg = parseTiempo(tiempo);
    if (!seg) {
      setError("Escribilo como mm:ss o h:mm:ss. Ej: 52:10");
      return;
    }
    const v = validar(registrarResultadoDto, { resultadoSeg: seg, sumarAMarcas: sumar });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    registrarResultado(inscripcion.id, v.datos.resultadoSeg, v.datos.sumarAMarcas);
    onClose();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Anotar resultado</DialogTitle>
        <DialogDescription>
          {carrera?.nombre} · {distanciaLabel(inscripcion.distanciaKm)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="r-tiempo">Tiempo oficial</Label>
        <Input
          id="r-tiempo"
          value={tiempo}
          onChange={(e) => {
            setTiempo(e.target.value);
            setError("");
          }}
          placeholder="mm:ss o h:mm:ss"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          className="tabular-nums"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <Checkbox checked={sumar} onCheckedChange={(v) => setSumar(Boolean(v))} />
        Sumarlo a las marcas
      </label>
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

/* ═════════════ Calendario del club (alumno) ═════════════ */

/** Próximas carreras del club, para que el alumno las vea aunque no esté anotado */
export function CalendarioCarreras({ alumnoId }: { alumnoId: string }) {
  const { carreras, inscripciones } = useStore();
  const hoy = hoyISO();
  const proximas = carreras
    .filter((c) => c.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (!proximas.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
        <Flag className="size-8 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">No hay carreras próximas en el calendario.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {proximas.map((c) => {
        const mia = inscripciones.find((i) => i.alumnoId === alumnoId && i.carreraId === c.id);
        return (
          <li key={c.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
            <FechaBloque fecha={c.fecha} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-medium">{c.nombre}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                {c.lugar && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {c.lugar}
                  </span>
                )}
                <KmChips kms={c.distanciasKm} />
              </div>
              {c.notas && (
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.notas}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {mia && (
                <Badge className="bg-primary/15 text-primary">
                  Vas a correr {distanciaLabel(mia.distanciaKm)}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "border-transparent",
                  diasHasta(c.fecha) <= 7
                    ? "bg-warning/15 text-warning"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {cuentaRegresiva(c.fecha)}
              </Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
