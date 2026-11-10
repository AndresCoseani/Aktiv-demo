"use client";

import { ArrowUpRight, CalendarDays, ClipboardList, Medal, StickyNote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { distanciaLabel } from "@/lib/dominio";
import { diaDeHoy, formatFecha, formatTiempo, hoyISO } from "@/lib/format";
import { LIMITES } from "@/lib/schemas";
import { actualizarAlumno, useStore } from "@/lib/store";
import type { Alumno, Marca } from "@/lib/types";
import { prescripcionEfectiva, semanaDelPlan } from "@aktiv/contrato";
import type { usePlanesMensuales } from "@/lib/mensual";

export function AlumnoResumen({ alumno, mensual, onAbrir }: {
  alumno: Alumno;
  mensual: ReturnType<typeof usePlanesMensuales>;
  onAbrir: (tab: string) => void;
}) {
  const { carreras, inscripciones } = useStore();
  const meses = mensual.planes.filter((p) => p.activo);
  const mes = meses[0];
  const sesionesHoy = meses.flatMap((plan) => {
    const semana = semanaDelPlan(plan.inicio, hoyISO(), plan.semanas);
    return semana ? plan.sesiones.filter((s) => s.dia === diaDeHoy() + 1).map((sesion) => ({ sesion, plan, semana })) : [];
  });
  const hoy = alumno.semana[diaDeHoy()];
  const tipos = [hoy?.correr && "Running", hoy?.fuerza && "Fuerza"].filter(Boolean);
  const planes = alumno.planes.filter((p) => p.activo && tipos.includes(p.tipo));
  const mejores = new Map<number, Marca>();
  for (const marca of alumno.marcas) {
    const anterior = mejores.get(marca.distanciaKm);
    if (!anterior || marca.tiempoSeg < anterior.tiempoSeg) mejores.set(marca.distanciaKm, marca);
  }
  const marcas = [...mejores.values()].sort((a, b) => a.distanciaKm - b.distanciaKm);
  const proximas = inscripciones
    .filter((i) => i.alumnoId === alumno.id)
    .flatMap((i) => {
      const carrera = carreras.find((c) => c.id === i.carreraId);
      return carrera && carrera.fecha >= hoyISO() ? [{ carrera, inscripcion: i }] : [];
    })
    .sort((a, b) => a.carrera.fecha.localeCompare(b.carrera.fecha));
  const proxima = proximas[0];
  const card = "min-w-0 gap-3 py-4";
  const header = "gap-1 px-4";
  const title = "flex items-center gap-2 text-sm [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground";
  const footer = (tab: string, texto: string) => (
    <Button variant="ghost" size="sm" className="mt-auto w-fit px-0 text-xs text-primary" onClick={() => onAbrir(tab)}>
      {texto}<ArrowUpRight className="size-3.5" />
    </Button>
  );

  return (
    <section aria-label="Resumen del alumno" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card className={card}>
        <CardHeader className={header}>
          <CardTitle className={title}><StickyNote />Lesiones o apuntes</CardTitle>
          <p className="text-xs text-muted-foreground">Privado · Solo lo ves vos</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 px-4">
          <Textarea
            aria-label="Lesiones o apuntes"
            value={alumno.notasProfe}
            onChange={(e) => actualizarAlumno(alumno.id, { notasProfe: e.target.value })}
            maxLength={LIMITES.notas}
            placeholder="Anotá una molestia u observación…"
            className="h-24 min-h-24 resize-none overflow-y-auto text-sm [field-sizing:fixed]"
          />
          <p className="text-xs text-muted-foreground">Guardado automático</p>
        </CardContent>
      </Card>

      <Card className={card}>
        <CardHeader className={header}>
          <CardTitle className={title}><ClipboardList />Entrenamiento de hoy</CardTitle>
          {!mensual.cargando && !mensual.error && <p className="text-xs text-muted-foreground">{mes ? `${meses.length} ${meses.length === 1 ? "plan activo" : "planes activos"}` : tipos.length ? tipos.join(" + ") : "Día de descanso"}</p>}
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 px-4">
          {mensual.error ? <p className="text-sm text-muted-foreground">No se pudo consultar el plan.</p> : mensual.cargando ? <p className="text-sm text-muted-foreground">Cargando…</p> : mes ? (
            sesionesHoy.length ? sesionesHoy.map(({sesion: s, plan, semana}) => (
              <div key={s.id} className="min-w-0"><p className="truncate text-sm font-medium">{s.nombre || s.tipo}</p><p className="text-xs text-muted-foreground">{plan.nombre} · Semana {semana}</p><p className="line-clamp-2 text-xs text-muted-foreground">{s.ejercicios.slice(0, 2).map((e) => `${e.nombre || "Ejercicio"}: ${prescripcionEfectiva(e.semanas, semana) || "Sin indicación"}`).join(" · ") || "Sin ejercicios cargados"}</p></div>
            )) : <p className="text-sm text-muted-foreground">Hoy no tiene sesiones asignadas. Consultá los planes para ver los días sin asignar o fuera de fecha.</p>
          ) : planes.length ? planes.map((plan) => (
            <div key={plan.id} className="min-w-0">
              <p className="truncate text-sm font-medium" title={plan.nombre}>{plan.nombre || `Plan de ${plan.tipo.toLowerCase()}`}</p>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {plan.ejercicios.filter((e) => e.nombre).slice(0, 2).map((e) => e.nombre).join(" · ") || "Sin ejercicios cargados"}
              </p>
            </div>
          )) : <p className="text-sm text-muted-foreground">{tipos.length ? "Todavía no hay un plan activo para hoy." : "Hoy no tiene actividades asignadas."}</p>}
          {!mensual.cargando && !mensual.error && !mes && planes.length > 0 && <p className="text-xs text-muted-foreground">Vista del plan anterior</p>}
          {footer("plan", "Ver plan")}
        </CardContent>
      </Card>

      <Card className={card}>
        <CardHeader className={header}>
          <CardTitle className={title}><Medal />Mejores marcas</CardTitle>
          <p className="text-xs text-muted-foreground">Mejor tiempo por distancia</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 px-4">
          {marcas.length ? <ul className="space-y-2">
            {marcas.slice(0, 3).map((marca) => <li key={marca.id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{distanciaLabel(marca.distanciaKm)}</span>
              <span className="font-medium tabular-nums">{formatTiempo(marca.tiempoSeg)}</span>
            </li>)}
          </ul> : <p className="text-sm text-muted-foreground">Todavía no tiene marcas cargadas.</p>}
          {footer("marcas", "Ver marcas")}
        </CardContent>
      </Card>

      <Card className={card}>
        <CardHeader className={header}>
          <CardTitle className={title}><CalendarDays />Próxima carrera</CardTitle>
          <p className="text-xs text-muted-foreground">Inscripciones del alumno</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 px-4">
          {proxima ? <div className="space-y-1">
            <p className="line-clamp-2 text-sm font-medium">{proxima.carrera.nombre}</p>
            <p className="text-sm text-primary">{formatFecha(proxima.carrera.fecha)} · {distanciaLabel(proxima.inscripcion.distanciaKm)}</p>
            {proxima.carrera.lugar && <p className="truncate text-xs text-muted-foreground" title={proxima.carrera.lugar}>{proxima.carrera.lugar}</p>}
            {proximas.length > 1 && <p className="text-xs text-muted-foreground">{proximas.length - 1} más en el calendario</p>}
          </div> : <p className="text-sm text-muted-foreground">No tiene próximas carreras asignadas.</p>}
          {footer("carreras", "Ver carreras")}
        </CardContent>
      </Card>
    </section>
  );
}
