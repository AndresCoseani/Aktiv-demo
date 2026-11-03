"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DIAS_PLAN, MAX_SEMANAS_PLAN, semanasDelPlan, prescripcionEfectiva, semanaDelPlan,
  altaMensualApi, altaSesionApi, parcheSesionApi, parcheEjercicioMensualApi,
  parcheCeldaAlumnoApi, parcheCeldaProfeApi, parcheMensualApi, type PlanMensual, type SesionEntrenamiento, type EjercicioMensual,
} from "@aktiv/contrato";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FechaInput } from "@/components/fecha-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EditorEjerciciosPlan, primerBloqueLibre, bloquesDelPlan } from "@/components/editor-ejercicios-plan";
import { EntradaEnCalorEditor } from "@/components/entrada-en-calor-editor";
import { api } from "@/lib/api";
import { avisarCambioMensual, usePlanesMensuales, hayBorradoresMensuales, registrarBorradorMensual } from "@/lib/mensual";
import { formatFecha, hoyISO, nuevoId } from "@/lib/format";

const selector = "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm";
const TIPOS_INICIALES = [
  { tipo: "Running", campo: "diasRunning", etiqueta: "Días de running" },
  { tipo: "Fuerza", campo: "diasFuerza", etiqueta: "Días de fuerza" },
] as const;
function navegar(accion: () => void) {
  if (hayBorradoresMensuales()) toast.error("Esperá a que se guarden los cambios antes de cambiar de vista.");
  else accion();
}
function mensaje(e: unknown) { return e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo."; }
function cambio<T extends object>(antes: T, despues: T) {
  return Object.fromEntries(Object.entries(despues).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(antes[k as keyof T])));
}

export function PlanMensualPanel({ alumnoId, editable = false, children }: { alumnoId: string; editable?: boolean; children?: ReactNode }) {
  const datos = usePlanesMensuales(alumnoId);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [crear, setCrear] = useState(false);
  const [tiposNuevos, setTiposNuevos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [editando, setEditando] = useState<PlanMensual | null>(null);
  const visibles = editable ? datos.planes : datos.planes.filter((p) => p.activo);
  const plan = visibles.find((p) => p.id === seleccion) ?? visibles.find((p) => p.activo) ?? visibles.at(-1);

  async function nuevo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      const dto = altaMensualApi.parse({ id: nuevoId(), nombre: String(f.get("nombre")).trim(), inicio: String(f.get("inicio")), semanas: Number(f.get("semanas")), activo: !datos.planes.some((p) => p.activo), diasIniciales: { fuerza: Number(f.get("diasFuerza") ?? 0), running: Number(f.get("diasRunning") ?? 0) } });
      await api.post(`/alumnos/${alumnoId}/planes-mensuales`, dto);
      avisarCambioMensual(); setSeleccion(dto.id); setCrear(false); toast.success("Plan creado");
    } catch (e) { toast.error(mensaje(e)); } finally { setOcupado(false); }
  }
  async function accion(tipo: "activar" | "borrar") {
    if (!plan) return;
    setOcupado(true);
    try {
      if (tipo === "activar") await api.patch(`/planes-mensuales/${plan.id}`, { activo: true });
      else await api.delete(`/planes-mensuales/${plan.id}`);
      avisarCambioMensual(); setBorrar(false); toast.success(tipo === "activar" ? "Plan activado" : "Plan eliminado");
    } catch (e) { toast.error(mensaje(e)); } finally { setOcupado(false); }
  }
  return <div className="min-w-0 space-y-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="size-5 shrink-0 text-primary" />Plan de entrenamiento</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sesiones por día y progresión por semanas.</p></div>
      {editable && <Button variant="outline" size="sm" disabled={ocupado || datos.cargando || Boolean(datos.error)} onClick={() => navegar(() => { setTiposNuevos([]); setCrear(true); })}><Plus />Nuevo plan</Button>}
    </div>
    {datos.cargando ? <p role="status" className="py-8 text-sm text-muted-foreground">Cargando planes…</p> : datos.error ?
      <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm"><p>{datos.error}</p><Button variant="outline" size="sm" className="mt-2" onClick={datos.reintentar}>Reintentar</Button></div> : <>
      {editable && visibles.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Planes de entrenamiento">
        {visibles.map((p) => <Button key={p.id} variant={p.id === plan?.id ? "secondary" : "outline"} size="sm" aria-pressed={p.id === plan?.id} onClick={() => navegar(() => setSeleccion(p.id))}>
          {p.activo && <Check className="size-3.5" />}{p.nombre || "Sin nombre"}
        </Button>)}
      </div>}
      {plan ? <>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
          <div className="min-w-0 flex-1 basis-48"><p className="break-words font-medium">{plan.nombre || "Plan de entrenamiento"}</p><p className="text-xs text-muted-foreground">Inicio: {formatFecha(plan.inicio, { conAnio: true })} · {plan.semanas} semanas · {plan.activo ? "Activo" : "Borrador"}</p></div>
          {editable && <div className="flex gap-2">
            {!plan.activo && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => navegar(() => void accion("activar"))}>Activar plan</Button>}
            <Button size="icon-sm" variant="ghost" aria-label="Editar plan de entrenamiento" title="Editar plan" disabled={ocupado} onClick={() => navegar(() => setEditando(plan))}><Pencil /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Eliminar plan de entrenamiento" disabled={ocupado} onClick={() => navegar(() => setBorrar(true))}><Trash2 className="text-destructive" /></Button>
          </div>}
        </div>
        <ContenidoMes key={`${plan.id}:${plan.semanas}`} plan={plan} editable={editable} />
      </> : <p className="min-w-0 break-words rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{editable ? "Creá un plan, elegí su duración y agregá las sesiones." : "Tu profe todavía no activó un plan de entrenamiento."}</p>}
    </>}
    {children && <details className="rounded-xl border px-4 py-3"><summary className="cursor-pointer text-sm text-muted-foreground">Planes anteriores</summary><div className="mt-4">{children}</div></details>}
    {editando && <EditarPlanDialog plan={editando} onCerrar={() => setEditando(null)} />}
    <Dialog open={crear} onOpenChange={(v) => !ocupado && setCrear(v)}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={!ocupado}>
      <form onSubmit={nuevo} className="space-y-4"><DialogHeader><DialogTitle>Nuevo plan de entrenamiento</DialogTitle><DialogDescription>Elegí los tipos y cuántos días tendrá cada uno. Se crean listos para cargar los ejercicios.</DialogDescription></DialogHeader>
        <fieldset disabled={ocupado} className="min-w-0 space-y-4">
        <label className="block space-y-1 text-sm">Nombre del plan<Input name="nombre" placeholder="Ej: Base para 10K" maxLength={120} required /></label>
        <label className="block space-y-1 text-sm">Duración en semanas<Input name="semanas" type="number" min={1} max={MAX_SEMANAS_PLAN} step={1} defaultValue={4} required /></label>
        <div className="space-y-1 text-sm"><p>Tipos de entrenamiento</p>
          <Popover><PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between font-normal" aria-label="Seleccionar tipos de entrenamiento" disabled={ocupado} />}>
            <span className="truncate">{TIPOS_INICIALES.filter((t) => tiposNuevos.includes(t.tipo)).map((t) => t.tipo).join(", ") || "Seleccioná uno o más tipos"}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </PopoverTrigger><PopoverContent align="start" className="w-[var(--anchor-width)]" aria-label="Tipos de entrenamiento">
            {TIPOS_INICIALES.map(({ tipo }) => <label key={tipo} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent"><input type="checkbox" className="size-4 accent-primary" checked={tiposNuevos.includes(tipo)} disabled={ocupado} onChange={(e) => setTiposNuevos((previos) => e.target.checked ? [...previos, tipo] : previos.filter((t) => t !== tipo))} />{tipo}</label>)}
          </PopoverContent></Popover>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIPOS_INICIALES.filter((t) => tiposNuevos.includes(t.tipo)).map((t) => <label key={t.tipo} className="block space-y-1 text-sm">{t.etiqueta}<Input name={t.campo} type="number" min={1} max={7} step={1} defaultValue={3} required /></label>)}
        </div>
        <p className="text-xs text-muted-foreground">Cada tipo tendrá Día 1, Día 2, etc., sin asignar días de la semana.</p>
        <label className="block space-y-1 text-sm">Fecha de inicio<FechaInput name="inicio" defaultValue={hoyISO()} min="2000-01-01" max="2100-01-01" required /></label>
        </fieldset>
        <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={() => setCrear(false)}>Cancelar</Button><Button type="submit" disabled={ocupado || tiposNuevos.length === 0}>{ocupado ? "Creando…" : "Crear plan"}</Button></DialogFooter>
      </form></DialogContent></Dialog>
    <Dialog open={borrar} onOpenChange={(v) => !ocupado && setBorrar(v)}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>¿Eliminar este plan?</DialogTitle><DialogDescription>Se borran sus sesiones, ejercicios y registros de peso. No se puede deshacer.</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" disabled={ocupado} onClick={() => setBorrar(false)}>Cancelar</Button><Button variant="destructive" disabled={ocupado} onClick={() => void accion("borrar")}>Eliminar plan</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function EditarPlanDialog({ plan, onCerrar }: { plan: PlanMensual; onCerrar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (hayBorradoresMensuales()) { toast.error("Guardá las sesiones antes de cambiar la duración del plan."); return; }
    const f = new FormData(e.currentTarget); setOcupado(true); setError("");
    try {
      const resultado = parcheMensualApi.safeParse({ nombre: String(f.get("nombre")).trim(), inicio: String(f.get("inicio")), semanas: Number(f.get("semanas")) });
      if (!resultado.success) { setError(resultado.error.issues[0]?.message ?? "Revisá los datos del plan."); return; }
      await api.patch(`/planes-mensuales/${plan.id}`, resultado.data);
      avisarCambioMensual(); onCerrar(); toast.success("Datos del plan guardados");
    } catch (e) { setError(mensaje(e)); } finally { setOcupado(false); }
  }
  return <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onCerrar(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={!ocupado}>
      <form onSubmit={guardar} className="space-y-4">
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
          <DialogDescription>Cambiá el nombre, la fecha de inicio y la duración. Las semanas con indicaciones o pesos registrados se conservan.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={ocupado} className="min-w-0 space-y-4">
          <label className="block space-y-1 text-sm">Nombre<Input name="nombre" defaultValue={plan.nombre} maxLength={120} required autoFocus /></label>
          <label className="block space-y-1 text-sm">Fecha de inicio<FechaInput name="inicio" defaultValue={plan.inicio} min="2000-01-01" max="2100-01-01" required /></label>
          <label className="block space-y-1 text-sm">Duración en semanas<Input name="semanas" type="number" min={1} max={MAX_SEMANAS_PLAN} step={1} defaultValue={plan.semanas} required /></label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={ocupado} onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar cambios"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function SemanasPlan({ total, semana, actual, onSeleccionar }: { total: number; semana: number; actual: number | null; onSeleccionar: (semana: number) => void }) {
  const lista = useRef<HTMLDivElement>(null);
  const [bordes, setBordes] = useState({ anterior: false, siguiente: false });
  useEffect(() => {
    const elemento = lista.current;
    if (!elemento) return;
    const medir = () => setBordes({ anterior: elemento.scrollLeft > 1, siguiente: elemento.scrollLeft + elemento.clientWidth < elemento.scrollWidth - 1 });
    const observer = new ResizeObserver(medir);
    observer.observe(elemento);
    elemento.addEventListener("scroll", medir);
    medir();
    return () => { observer.disconnect(); elemento.removeEventListener("scroll", medir); };
  }, [total]);
  useEffect(() => {
    const elemento = lista.current;
    const boton = elemento?.querySelector<HTMLButtonElement>(`[data-semana="${semana}"]`);
    if (!elemento || !boton) return;
    if (boton.offsetLeft < elemento.scrollLeft) elemento.scrollLeft = boton.offsetLeft;
    else if (boton.offsetLeft + boton.offsetWidth > elemento.scrollLeft + elemento.clientWidth) elemento.scrollLeft = boton.offsetLeft + boton.offsetWidth - elemento.clientWidth;
  }, [semana]);
  const desbordado = bordes.anterior || bordes.siguiente;
  return <div className="flex min-w-0 items-center gap-2">
    {desbordado && <Button size="icon-sm" variant="outline" aria-label="Semanas anteriores" disabled={!bordes.anterior} onClick={() => lista.current?.scrollBy({ left: -lista.current.clientWidth })}><ArrowLeft /></Button>}
    <div ref={lista} role="group" aria-label="Semana del plan" className="relative flex min-w-0 w-fit gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {semanasDelPlan(total).map((s) => <Button key={s} data-semana={s} className="shrink-0" size="sm" variant={semana === s ? "secondary" : "ghost"} aria-label={`Semana ${s}`} aria-pressed={semana === s} onClick={() => onSeleccionar(s)}>Semana {s}{actual === s && <span className="sr-only"> · Actual</span>}</Button>)}
    </div>
    {desbordado && <Button size="icon-sm" variant="outline" aria-label="Semanas siguientes" disabled={!bordes.siguiente} onClick={() => lista.current?.scrollBy({ left: lista.current.clientWidth })}><ArrowRight /></Button>}
  </div>;
}

function ContenidoMes({ plan, editable }: { plan: PlanMensual; editable: boolean }) {
  const actual = semanaDelPlan(plan.inicio, hoyISO(), plan.semanas);
  const [semana, setSemana] = useState(actual ?? (hoyISO() < plan.inicio ? 1 : plan.semanas));
  const semanasVisibles = semanasDelPlan(plan.semanas);
  const [tipo, setTipo] = useState<"Fuerza" | "Running">(plan.sesiones[0]?.tipo ?? "Fuerza");
  const [seleccionSesion, setSeleccionSesion] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sesiones = plan.sesiones.filter((s) => s.tipo === tipo);
  const sesion = sesiones.find((s) => s.id === seleccionSesion) ?? sesiones[0];
  const numeroDia = sesion ? sesiones.indexOf(sesion) + 1 : 1;
  async function nuevaSesion() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const dto = altaSesionApi.parse({ id: nuevoId(), dia: null, tipo, nombre: `${tipo} · Día ${sesiones.length + 1}`, calentamiento: "", enfriamiento: "" });
      await api.post(`/planes-mensuales/${plan.id}/sesiones`, dto);
      avisarCambioMensual(); setSeleccionSesion(dto.id); toast.success(`Día ${sesiones.length + 1} de ${tipo.toLowerCase()} creado`);
    } catch (e) { toast.error(mensaje(e)); } finally { setOcupado(false); }
  }
  return <div className="space-y-4">
    {!actual && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{hoyISO() < plan.inicio ? "Este plan todavía no empezó." : `Este plan de ${plan.semanas} semanas terminó.`} Podés consultar sus semanas.</p>}
    <div role="group" aria-label="Tipo de entrenamiento" className="flex gap-2">{(["Fuerza", "Running"] as const).map((t) => <Button key={t} disabled={ocupado} variant={tipo === t ? "secondary" : "outline"} aria-pressed={tipo === t} onClick={() => navegar(() => { setTipo(t); setSeleccionSesion(null); })}>{t}</Button>)}</div>
    {(sesiones.length > 0 || editable) && <div className="space-y-2">
      <h3 className="text-sm font-semibold">Días de {tipo.toLowerCase()}</h3>
      <div role="group" aria-label="Días del entrenamiento" className="flex flex-wrap gap-2">
        {sesiones.map((s, i) => <Button key={s.id} size="sm" variant={sesion?.id === s.id ? "secondary" : "outline"} aria-label={`Día ${i + 1}`} aria-pressed={sesion?.id === s.id} disabled={ocupado} onClick={() => navegar(() => setSeleccionSesion(s.id))}>Día {i + 1}</Button>)}
        {editable && <Button variant="outline" size="sm" disabled={ocupado} onClick={() => navegar(() => void nuevaSesion())}><Plus />{ocupado ? "Creando día…" : `Crear Día ${sesiones.length + 1}`}</Button>}
      </div>
    </div>}
    {sesion && <div className="min-w-0 space-y-2">
      <p className="text-xs text-muted-foreground">Progresión del Día {numeroDia} · Semana {semana} de {plan.semanas}</p>
      <SemanasPlan total={plan.semanas} semana={semana} actual={actual} onSeleccionar={setSemana} />
    </div>}
    {sesion ? editable ? <EditorSesion key={sesion.id} sesion={sesion} numeroDia={numeroDia} semana={semana} semanasVisibles={semanasVisibles} totalSemanas={plan.semanas} /> : <LecturaSesion key={sesion.id} sesion={sesion} semana={semana} /> :
      <div className="space-y-3 rounded-xl border border-dashed px-4 py-8 text-center text-sm">
        <p className="font-medium">Todavía no hay días de {tipo.toLowerCase()}</p>
        <p className="mx-auto max-w-md text-muted-foreground">{editable ? `Empezá por el Día 1: cargá la entrada en calor, los ejercicios y sus indicaciones para las ${plan.semanas} semanas.` : "Tu profe todavía no cargó entrenamientos de este tipo."}</p>
      </div>}
  </div>;
}

function EditorSesion({ sesion, numeroDia, semana, semanasVisibles, totalSemanas }: { sesion: SesionEntrenamiento; numeroDia: number; semana: number; semanasVisibles: number[]; totalSemanas: number }) {
  // Los formularios conservan su borrador durante las recargas de otras cards.
  return <FormularioSesion sesion={sesion} numeroDia={numeroDia} semana={semana} semanasVisibles={semanasVisibles} totalSemanas={totalSemanas} />;
}

function FormularioSesion({ sesion, numeroDia, semana, semanasVisibles, totalSemanas }: { sesion: SesionEntrenamiento; numeroDia: number; semana: number; semanasVisibles: number[]; totalSemanas: number }) {
  const [borrador, setBorrador] = useState(sesion);
  const [guardado, setGuardado] = useState(sesion);
  const [altaPendiente, setAltaPendiente] = useState<EjercicioMensual | null>(null);
  const guardando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [quitar, setQuitar] = useState<string | null>(null);
  const sucio = JSON.stringify(borrador) !== JSON.stringify(guardado);
  useEffect(() => registrarBorradorMensual(sesion.id, sucio), [sesion.id, sucio]);
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const alNavegar = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("a[href], [role=tab]")) {
        e.preventDefault(); e.stopPropagation(); toast.error("Esperá a que se guarden los cambios antes de cambiar de vista.");
      }
    };
    window.addEventListener("beforeunload", avisar);
    document.addEventListener("click", alNavegar, true);
    return () => { window.removeEventListener("beforeunload", avisar); document.removeEventListener("click", alNavegar, true); };
  }, [sucio]);
  function ejercicio(id: string, campos: Partial<EjercicioMensual>) { setBorrador((b) => ({ ...b, ejercicios: b.ejercicios.map((e) => e.id === id ? { ...e, ...campos } : e) })); }

  const guardar = useCallback(async () => {
    if (guardando.current) return false;
    guardando.current = true;
    setOcupado(true); setError("");
    try {
      const cabecera = (s: SesionEntrenamiento) => ({ nombre: s.nombre, tipo: s.tipo, dia: s.dia, calentamiento: s.calentamiento, activacion: s.activacion, enfriamiento: s.enfriamiento, orden: s.orden, bloques: s.bloques });
      const c = cambio(cabecera(guardado), cabecera(borrador));
      // Validar el borrador entero antes de empezar a escribir.
      const operaciones: { ruta: string; datos: object }[] = [];
      if (Object.keys(c).length) operaciones.push({ ruta: `/sesiones/${sesion.id}`, datos: parcheSesionApi.parse(c) });
      for (const ej of borrador.ejercicios) {
        const previo = guardado.ejercicios.find((p) => p.id === ej.id) ?? altaPendiente;
        if (!previo) throw new Error("No pudimos identificar el ejercicio pendiente.");
        const campos = (v: EjercicioMensual) => ({ nombre: v.nombre, descanso: v.descanso, grupo: v.grupo, orden: v.orden });
        const ce = cambio(campos(previo), campos(ej));
        if (Object.keys(ce).length) operaciones.push({ ruta: `/sesion-ejercicios/${ej.id}`, datos: parcheEjercicioMensualApi.parse(ce) });
        for (const celda of ej.semanas) {
          const anterior = previo.semanas.find((s) => s.semana === celda.semana);
          if (anterior?.prescripcion !== celda.prescripcion) operaciones.push({ ruta: `/sesion-ejercicios/${ej.id}/semanas/${celda.semana}`, datos: parcheCeldaProfeApi.parse({ prescripcion: celda.prescripcion }) });
        }
      }
      if (altaPendiente) {
        const { id, nombre, descanso, grupo } = altaPendiente;
        await api.post(`/sesiones/${sesion.id}/ejercicios`, { id, nombre, descanso, grupo });
        setGuardado((anterior) => ({ ...anterior, ejercicios: [...anterior.ejercicios, altaPendiente] }));
        setAltaPendiente(null);
      }
      for (const op of operaciones) await api.patch(op.ruta, op.datos);
      setGuardado(borrador); avisarCambioMensual(); return true;
    } catch (e) { setError(mensaje(e)); return false; } finally { guardando.current = false; setOcupado(false); }
  }, [borrador, guardado, sesion.id, altaPendiente]);
  useEffect(() => {
    if (!sucio || ocupado || error) return;
    const timer = setTimeout(() => void guardar(), altaPendiente ? 0 : 800);
    return () => clearTimeout(timer);
  }, [sucio, ocupado, error, guardar, altaPendiente]);
  function crearBloque() {
    setBorrador((anterior) => {
      const grupo = primerBloqueLibre(anterior.ejercicios, anterior.bloques);
      return grupo ? { ...anterior, bloques: [...bloquesDelPlan(anterior.ejercicios, anterior.bloques), grupo] } : anterior;
    });
  }
  function agregarEjercicio(grupo: number) {
    if (altaPendiente) return;
    const nuevo: EjercicioMensual = { id: nuevoId(), nombre: "", descanso: "", grupo, orden: Math.max(-1, ...borrador.ejercicios.map((e) => e.orden)) + 1, semanas: semanasDelPlan(totalSemanas).map((semana) => ({ semana, prescripcion: "", peso: null, pesoFecha: null })) };
    setBorrador((anterior) => ({ ...anterior, ejercicios: [...anterior.ejercicios, nuevo] }));
    setAltaPendiente(nuevo); setError("");
  }
  async function eliminar() {
    setOcupado(true); setError("");
    try {
      await api.delete(quitar ? `/sesion-ejercicios/${quitar}` : `/sesiones/${sesion.id}`);
      if (quitar) {
        setBorrador((anterior) => ({ ...anterior, ejercicios: anterior.ejercicios.filter((e) => e.id !== quitar) }));
        setGuardado((anterior) => ({ ...anterior, ejercicios: anterior.ejercicios.filter((e) => e.id !== quitar) }));
      }
      avisarCambioMensual(); setConfirmar(false); setQuitar(null);
    } catch (e) { setError(mensaje(e)); } finally { setOcupado(false); }
  }
  return <Card className="gap-4"><CardHeader><div className="flex items-center justify-between gap-2"><div><CardTitle>{borrador.nombre || sesion.tipo}</CardTitle><CardDescription>{borrador.tipo} · Día {numeroDia}{borrador.dia ? ` · ${DIAS_PLAN[borrador.dia - 1]}` : " · Sin día fijo"}</CardDescription></div><Button type="button" variant="ghost" size="icon-sm" aria-label="Eliminar sesión" disabled={ocupado || sucio} onClick={() => setConfirmar(true)}><Trash2 /></Button></div></CardHeader>
    <CardContent><form onSubmit={(e) => { e.preventDefault(); void guardar(); }} className="space-y-5">
      <fieldset className="min-w-0 space-y-5">
        <label className="block space-y-1 text-xs text-muted-foreground">Nombre del día<Input value={borrador.nombre} maxLength={60} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} /></label>
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Asignar día de la semana (opcional)</summary><label className="mt-3 block max-w-xs space-y-1">Día calendario<select className={selector} value={borrador.dia ?? ""} onChange={(e) => setBorrador({ ...borrador, dia: e.target.value ? Number(e.target.value) : null })}><option value="">Sin día fijo</option>{DIAS_PLAN.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label></details>
        <EntradaEnCalorEditor texto={borrador.calentamiento} ejercicios={borrador.activacion} onTexto={(calentamiento) => setBorrador((anterior) => ({ ...anterior, calentamiento }))} onEjercicios={(activacion) => setBorrador((anterior) => ({ ...anterior, activacion }))} />
        <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Entrenamiento</h3><div className="flex flex-wrap gap-2">
          {semana > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setBorrador((b) => ({ ...b, ejercicios: b.ejercicios.map((e) => ({ ...e, semanas: e.semanas.map((c) => c.semana === semana ? { ...c, prescripcion: c.prescripcion.trim() ? c.prescripcion : prescripcionEfectiva(e.semanas, semana - 1) } : c) })) }))}>Completar vacíos de S{semana} con S{semana - 1}</Button>}
          </div></div>
          <EditorEjerciciosPlan ejercicios={borrador.ejercicios} bloques={borrador.bloques} tipo={borrador.tipo} semana={semana} semanasVisibles={semanasVisibles} ocupado={ocupado || Boolean(altaPendiente)} altaPendiente={Boolean(altaPendiente)} sucio={sucio} onCambiar={ejercicio} onCrearBloque={crearBloque} onQuitarBloque={(grupo) => setBorrador((anterior) => ({ ...anterior, bloques: anterior.bloques.filter((g) => g !== grupo) }))} onAgregar={agregarEjercicio} onQuitar={setQuitar} />
        </div>
        <label className="block space-y-2 text-sm font-medium">Vuelta a la calma<Textarea className="min-h-20 font-normal" maxLength={4000} value={borrador.enfriamiento} onChange={(e) => setBorrador({ ...borrador, enfriamiento: e.target.value })} placeholder="Estiramientos, movilidad suave…" /></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error} Los cambios sin guardar siguen en el formulario.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><p role="status" className="text-xs text-muted-foreground">{ocupado ? "Guardando…" : error ? "No se pudieron guardar los cambios" : sucio ? "Cambios pendientes…" : "Guardado automáticamente"}</p>{error && <Button type="submit" disabled={ocupado}>Reintentar guardado</Button>}</div>
    </form></CardContent>
    <Dialog open={confirmar || Boolean(quitar)} onOpenChange={(v) => { if (!v && !ocupado) { setConfirmar(false); setQuitar(null); } }}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>¿Eliminar {quitar ? "este ejercicio" : "esta sesión"}?</DialogTitle><DialogDescription>También se borran sus registros de peso. No se puede deshacer.</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" disabled={ocupado} onClick={() => { setConfirmar(false); setQuitar(null); }}>Cancelar</Button><Button variant="destructive" disabled={ocupado} onClick={() => void eliminar()}>Eliminar</Button></DialogFooter></DialogContent></Dialog>
  </Card>;
}

function LecturaSesion({ sesion, semana }: { sesion: SesionEntrenamiento; semana: number }) {
  const grupos = bloquesDelPlan(sesion.ejercicios, sesion.bloques).filter((grupo) => sesion.ejercicios.some((e) => e.grupo === grupo));
  return <Card><CardHeader><CardTitle>{sesion.nombre || sesion.tipo}</CardTitle><CardDescription>{sesion.tipo} · Semana {semana}</CardDescription></CardHeader><CardContent className="space-y-5">
    {(sesion.calentamiento || sesion.activacion.length > 0) && <section className="space-y-3"><h3 className="text-sm font-semibold">Entrada en calor</h3>{sesion.activacion.length > 0 && <ol className="space-y-2 text-sm">{sesion.activacion.map((e, indice) => <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="min-w-0 break-words font-medium">{indice + 1}. {e.nombre || "Ejercicio sin nombre"}</span>{e.indicacion && <span className="whitespace-pre-wrap break-words text-foreground">{e.indicacion}</span>}</li>)}</ol>}{sesion.calentamiento && <div className="space-y-1 border-t pt-3"><p className="text-xs text-muted-foreground">Indicaciones generales</p><p className="whitespace-pre-wrap break-words text-sm text-foreground">{sesion.calentamiento}</p></div>}</section>}
    {grupos.map((grupo) => <section key={grupo} className="space-y-2"><h3 className="text-sm font-semibold">Bloque {grupos.indexOf(grupo) + 1}{sesion.ejercicios.filter((e) => e.grupo === grupo).length > 1 ? " ? Ejercicios juntos" : " ? Ejercicio individual"}</h3><ul className="divide-y rounded-xl border">{sesion.ejercicios.filter((e) => e.grupo === grupo).map((e) => <li key={e.id} className="space-y-2 p-3"><p className="break-words text-sm font-medium">{e.nombre || "Ejercicio sin nombre"}</p><p className="break-words text-sm text-primary">{prescripcionEfectiva(e.semanas, semana) || "Sin indicación"}</p>{e.descanso && <p className="text-xs text-muted-foreground">Descanso: {e.descanso}</p>}{sesion.tipo === "Fuerza" && <PesoSemanal key={`${e.id}:${semana}`} ejercicio={e} semana={semana} />}</li>)}</ul></section>)}
    {!sesion.ejercicios.length && <p className="text-sm text-muted-foreground">Esta sesión todavía no tiene ejercicios.</p>}
    {sesion.enfriamiento && <section><h3 className="mb-2 text-sm font-semibold">Vuelta a la calma</h3><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{sesion.enfriamiento}</p></section>}
  </CardContent></Card>;
}

function PesoSemanal({ ejercicio, semana }: { ejercicio: EjercicioMensual; semana: number }) {
  const celda = ejercicio.semanas.find((c) => c.semana === semana);
  const [peso, setPeso] = useState(celda?.peso ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setOcupado(true); setError("");
    try {
      const dto = parcheCeldaAlumnoApi.parse({ peso: peso || null, pesoFecha: peso ? hoyISO() : null });
      await api.patch(`/sesion-ejercicios/${ejercicio.id}/semanas/${semana}`, dto);
      avisarCambioMensual(); toast.success("Peso guardado para esta semana");
    } catch (e) { setError(mensaje(e)); } finally { setOcupado(false); }
  }
  return <form onSubmit={guardar} className="space-y-1"><div className="flex flex-wrap items-end gap-2"><label className="text-xs text-muted-foreground">Peso usado · kg<Input aria-label={`Peso de ${ejercicio.nombre}, semana ${semana}`} inputMode="decimal" maxLength={10} className="mt-1 w-28" value={peso} onChange={(e) => setPeso(e.target.value)} disabled={ocupado || !celda} /></label><Button type="submit" size="sm" variant="outline" disabled={ocupado || !celda || peso === (celda.peso ?? "")}>{ocupado ? "Guardando…" : "Guardar peso"}</Button></div>{celda?.pesoFecha && <p className="text-xs text-muted-foreground">Registrado el {formatFecha(celda.pesoFecha)}</p>}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</form>;
}
