"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ZodError } from "zod";
import {
  DIAS_PLAN, MAX_SEMANAS_PLAN, semanasDelPlan, prescripcionEfectiva, semanaDelPlan,
  altaMensualApi, altaSesionApi, duplicarSesionApi, parcheSesionApi, parcheEjercicioMensualApi,
  parcheCeldaAlumnoApi, parcheCeldaProfeApi, parcheMensualApi, type PlanMensual, type SesionEntrenamiento, type EjercicioMensual,
} from "@aktiv/contrato";
import { RunningSemanal } from "./running-semanal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FechaInput } from "@/components/fecha-input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EditorEjerciciosPlan, primerBloqueLibre, bloquesDelPlan } from "@/components/editor-ejercicios-plan";
import { EntradaEnCalorLectura } from "@/components/entrada-en-calor-lectura";
import { EntradaEnCalorEditor } from "@/components/entrada-en-calor-editor";
import { DuplicarPlanDialog } from "@/components/duplicar-plan-dialog";
import { SeguimientoSesion } from "@/components/seguimiento-sesion";
import { api } from "@/lib/api";
import { usePlanEditor } from "@/components/plan-editor-context";
import { ActividadesIniciales, NuevaActividad, useActividadesPlan } from "@/components/actividades-plan";
import { GuardarModeloDialog } from "@/components/guardar-modelo-dialog";
import { avisarCambioMensual, usePlanesMensuales, hayBorradoresMensuales, registrarBorradorMensual } from "@/lib/mensual";
import { formatFecha, hoyISO, nuevoId } from "@/lib/format";

const selector = "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm";
function navegar(accion: () => void) {
  if (hayBorradoresMensuales()) toast.error("Esperá a que se guarden los cambios antes de cambiar de vista.");
  else accion();
}
function mensaje(e: unknown) { return e instanceof ZodError ? e.issues[0]?.message ?? "Revisá los datos del formulario." : e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo."; }
function cambio<T extends object>(antes: T, despues: T) {
  return Object.fromEntries(Object.entries(despues).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(antes[k as keyof T])));
}

export function PlanMensualPanel({ alumnoId, editable = false, children }: { alumnoId: string; editable?: boolean; children?: ReactNode }) {
  const datos = usePlanesMensuales(alumnoId);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [crear, setCrear] = useState(false);

  const [ocupado, setOcupado] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [editando, setEditando] = useState<PlanMensual | null>(null);
  const [guardandoModelo, setGuardandoModelo] = useState(false);
  const [duplicandoPlan, setDuplicandoPlan] = useState<PlanMensual | null>(null);
  const visibles = editable ? datos.planes : datos.planes.filter((p) => p.activo);
  const plan = visibles.find((p) => p.id === seleccion) ?? visibles.find((p) => p.activo) ?? visibles.at(-1);

  async function nuevo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      const dto = altaMensualApi.parse({ id: nuevoId(), nombre: String(f.get("nombre")).trim(), inicio: String(f.get("inicio")), semanas: Number(f.get("semanas")), activo: !datos.planes.some((p) => p.activo), diasIniciales: JSON.parse(String(f.get("actividadesIniciales"))) });
      await api.post(`/alumnos/${alumnoId}/planes-mensuales`, dto);
      avisarCambioMensual(); setSeleccion(dto.id); setCrear(false); toast.success("Plan creado");
    } catch (e) { toast.error(mensaje(e)); } finally { setOcupado(false); }
  }
  async function accion(tipo: "activar" | "desactivar" | "borrar") {
    if (!plan) return;
    setOcupado(true);
    try {
      if (tipo !== "borrar") await api.patch(`/planes-mensuales/${plan.id}`, { activo: tipo === "activar" });
      else await api.delete(`/planes-mensuales/${plan.id}`);
      if (tipo !== "borrar") setSeleccion(plan.id);
      avisarCambioMensual(); setBorrar(false); toast.success(tipo === "activar" ? "Plan activado" : tipo === "desactivar" ? "Plan desactivado. Su contenido y registros se conservan." : "Plan eliminado");
    } catch (e) { toast.error(mensaje(e)); } finally { setOcupado(false); }
  }
  return <div className="min-w-0 space-y-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="size-5 shrink-0 text-primary" />Plan de entrenamiento</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sesiones por día y progresión por semanas.</p></div>
      {editable && <Button variant="outline" size="sm" disabled={ocupado || datos.cargando || Boolean(datos.error)} onClick={() => navegar(() => { setCrear(true); })}><Plus />Nuevo plan</Button>}
    </div>
    {datos.cargando ? <p role="status" className="py-8 text-sm text-muted-foreground">Cargando planes…</p> : datos.error ?
      <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm"><p>{datos.error}</p><Button variant="outline" size="sm" className="mt-2" onClick={datos.reintentar}>Reintentar</Button></div> : <>
      {editable && visibles.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Planes de entrenamiento">
        {visibles.map((p) => <Button key={p.id} variant={p.id === plan?.id ? "secondary" : "outline"} size="sm" aria-pressed={p.id === plan?.id} onClick={() => navegar(() => setSeleccion(p.id))}>
          {p.activo && <Check className="size-3.5" />}{p.nombre || "Sin nombre"}
        </Button>)}
      </div>}
      {!editable && visibles.length > 0 ? <CalendarioPlanes planes={visibles} /> : plan ? <>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5 pt-1">
          <div className="min-w-0 flex-1 basis-48"><p className="break-words font-medium">{plan.nombre || "Plan de entrenamiento"}</p><p className="text-xs text-muted-foreground">Inicio: {formatFecha(plan.inicio, { conAnio: true })} · {plan.semanas} semanas · {plan.activo ? "Activo" : "Borrador"}</p></div>
          {editable && <div className="flex flex-wrap gap-2">
            {plan.activo && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => navegar(() => void accion("desactivar"))}>{ocupado ? "Guardando…" : "Desactivar plan"}</Button>}
            {!plan.activo && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => navegar(() => void accion("activar"))}>Activar plan</Button>}
            <Button variant="outline" size="sm" disabled={ocupado} onClick={() => navegar(() => setGuardandoModelo(true))}>Guardar como modelo</Button>
            <Button size="icon-sm" variant="ghost" aria-label="Duplicar plan de entrenamiento" title="Duplicar plan" disabled={ocupado} onClick={() => navegar(() => setDuplicandoPlan(plan))}><Copy /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Editar plan de entrenamiento" title="Editar plan" disabled={ocupado} onClick={() => navegar(() => setEditando(plan))}><Pencil /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Eliminar plan de entrenamiento" disabled={ocupado} onClick={() => navegar(() => setBorrar(true))}><Trash2 className="text-destructive" /></Button>
          </div>}
        </div>
        <ContenidoMes key={`${plan.id}:${plan.semanas}`} plan={plan} editable={editable} />
      </> : <p className="min-w-0 break-words rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{editable ? "Creá un plan, elegí su duración y agregá las sesiones." : "Tu profe todavía no activó un plan de entrenamiento."}</p>}
    </>}
    {children && <details className="rounded-xl border px-4 py-3"><summary className="cursor-pointer text-sm text-muted-foreground">Planes anteriores</summary><div className="mt-4">{children}</div></details>}
    {guardandoModelo && plan && <GuardarModeloDialog plan={plan} onCerrar={() => setGuardandoModelo(false)} />}
    {editando && <EditarPlanDialog plan={editando} onCerrar={() => setEditando(null)} />}
    {duplicandoPlan && <DuplicarPlanDialog plan={duplicandoPlan} alumnoId={alumnoId} onCerrar={() => setDuplicandoPlan(null)} onDuplicado={(id, destino) => {
      if (destino === alumnoId) setSeleccion(id);
      avisarCambioMensual(); setDuplicandoPlan(null);
    }} />}
    <Dialog open={crear} onOpenChange={(v) => !ocupado && setCrear(v)}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={!ocupado}>
      <form onSubmit={nuevo} className="space-y-4"><DialogHeader><DialogTitle>Nuevo plan de entrenamiento</DialogTitle><DialogDescription>Elegí los tipos y cuántos días tendrá cada uno. Se crean listos para cargar los ejercicios.</DialogDescription></DialogHeader>
        <fieldset disabled={ocupado} className="min-w-0 space-y-4">
        <label className="block space-y-1 text-sm">Nombre del plan<Input name="nombre" placeholder="Ej: Base para 10K" maxLength={120} required /></label>
        <label className="block space-y-1 text-sm">Duración en semanas<Input name="semanas" type="number" min={1} max={MAX_SEMANAS_PLAN} step={1} defaultValue={4} required /></label>
        <ActividadesIniciales />
        <label className="block space-y-1 text-sm">Fecha de inicio<FechaInput name="inicio" defaultValue={hoyISO()} min="2000-01-01" max="2100-01-01" required /></label>
        </fieldset>
        <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={() => setCrear(false)}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Creando…" : "Crear plan"}</Button></DialogFooter>
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
  return <div className="flex min-w-0 items-center justify-center gap-2">
    {desbordado && <Button size="icon-sm" variant="outline" aria-label="Semanas anteriores" disabled={!bordes.anterior} onClick={() => lista.current?.scrollBy({ left: -lista.current.clientWidth })}><ArrowLeft /></Button>}
    <div ref={lista} role="group" aria-label="Semana del plan" className="relative flex min-w-0 w-fit gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {semanasDelPlan(total).map((s) => <Button key={s} data-semana={s} className="shrink-0" size="sm" variant={semana === s ? "default" : "ghost"} aria-label={`Semana ${s}`} aria-pressed={semana === s} onClick={() => onSeleccionar(s)}>{semana === s && <Check className="size-3.5" />}Semana {s}{actual === s && <span className="sr-only"> · Actual</span>}</Button>)}
    </div>
    {desbordado && <Button size="icon-sm" variant="outline" aria-label="Semanas siguientes" disabled={!bordes.siguiente} onClick={() => lista.current?.scrollBy({ left: lista.current.clientWidth })}><ArrowRight /></Button>}
  </div>;
}

export function ContenidoMes({ plan, editable }: { plan: Pick<PlanMensual, "id" | "semanas" | "sesiones" | "running"> & { inicio?: string }; editable: boolean }) {
  const { api } = usePlanEditor();
  const inicio = plan.inicio ?? hoyISO();
  const actual = plan.inicio ? semanaDelPlan(inicio, hoyISO(), plan.semanas) : null;
  const [semana, setSemana] = useState(actual ?? (!plan.inicio || hoyISO() < inicio ? 1 : plan.semanas));
  const semanasVisibles = semanasDelPlan(plan.semanas);
  const { actividades, crear: crearActividad, error: errorActividad } = useActividadesPlan();
  const tipos = [...new Set([...actividades, ...plan.sesiones.map((s) => s.tipo)])];
  const [running,setRunning]=useState(plan.running??{});
  const [anteriorRunning,setAnteriorRunning] = useState(false);
  const [tipo, setTipo] = useState<string>(plan.sesiones[0]?.tipo ?? "Fuerza");
  const [seleccionSesion, setSeleccionSesion] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState<SesionEntrenamiento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sesiones = plan.sesiones.filter((s) => s.tipo === tipo);
  const sesion = sesiones.find((s) => s.id === seleccionSesion) ?? sesiones[0];
  const numeroDia = sesion ? sesiones.indexOf(sesion) + 1 : 1;
  const [diaAlumno, setDiaAlumno] = useState(() => (new Date().getDay() + 6) % 7 + 1);
  async function nuevaSesion() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const dto = altaSesionApi.parse({ id: nuevoId(), dia: null, tipo, nombre: `${tipo.slice(0, 48)} · Día ${sesiones.length + 1}`, calentamiento: "", enfriamiento: "" });
      await api.post(`/planes-mensuales/${plan.id}/sesiones`, dto);
      avisarCambioMensual(); setSeleccionSesion(dto.id); toast.success(`Día ${sesiones.length + 1} de ${tipo.toLowerCase()} creado`);
    } catch (e) { toast.error(mensaje(e)); } finally { setOcupado(false); }
  }
  if (!editable) {
    const delDia = plan.sesiones.filter((s) => s.dia === diaAlumno).sort((a, b) => a.orden - b.orden);
    const sinAsignar = plan.sesiones.filter((s) => s.dia === null);
    const hoy = (new Date().getDay() + 6) % 7 + 1;
    return <div className="space-y-6">
      <div className="space-y-2"><p className="text-center text-sm font-medium">Semana {semana} de {plan.semanas}</p><SemanasPlan total={plan.semanas} semana={semana} actual={actual} onSeleccionar={(s) => navegar(() => setSemana(s))} /></div>
      <div className="space-y-3"><h3 className="text-lg font-semibold">{diaAlumno === hoy ? actual ? "Hoy te toca" : "Consultar entrenamientos" : DIAS_PLAN[diaAlumno - 1]}</h3>
        {!actual && <p className="text-sm text-muted-foreground">{hoyISO() < inicio ? "El plan todavía no empezó." : "Este plan terminó."} Podés consultar sus entrenamientos.</p>}
          <div role="group" aria-label="Días de la semana" className="flex min-w-0 flex-wrap justify-center gap-2">
            {DIAS_PLAN.map((dia, i) => {
              const entrenamientos = plan.sesiones.filter((s) => s.dia === i + 1);
              const seleccionado = diaAlumno === i + 1;
              return <Button key={dia} size="sm" className={`h-auto min-h-20 min-w-0 basis-[calc((100%-1.5rem)/4)] flex-col justify-start gap-2 self-stretch whitespace-normal rounded-xl border px-1.5 py-2.5 text-center sm:basis-[calc((100%-3rem)/7)] ${seleccionado ? "border-primary bg-primary/10 ring-1 ring-primary text-foreground hover:bg-primary/15" : "border-transparent bg-muted/40 text-foreground hover:bg-muted"}`} variant="ghost" aria-label={dia} aria-pressed={seleccionado} onClick={() => navegar(() => setDiaAlumno(i + 1))}>
                <span className={`text-xs font-semibold ${seleccionado ? "text-primary" : "text-muted-foreground"}`}>{dia.slice(0, 3)}</span>
                <span className="flex w-full flex-col gap-2 text-xs leading-snug font-normal">
                  {entrenamientos.length ? entrenamientos.map((s) => <span key={s.id} className="block"><span className="block text-xs text-muted-foreground">{s.tipo}</span><span className="block font-semibold">Día {plan.sesiones.filter((otra) => otra.tipo === s.tipo).findIndex((otra) => otra.id === s.id) + 1}</span></span>) : <span className="pt-1 text-xs text-muted-foreground">Descanso</span>}
                </span>
              </Button>;
            })}
          </div>
      </div>
      {delDia.length ? delDia.map((s) => <div key={s.id} className="space-y-3"><p className="text-sm font-medium text-primary">{s.tipo}</p><LecturaSesion sesion={s} semana={semana} /></div>) : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No hay entrenamientos asignados para este día.</p>}
      {sinAsignar.length > 0 && <section className="space-y-5"><h3 className="text-sm font-semibold">Entrenamientos sin día asignado</h3>{sinAsignar.map((s) => <LecturaSesion key={s.id} sesion={s} semana={semana} />)}</section>}
    </div>;
  }
  if(editable && tipo==="Running" && !anteriorRunning) return <div className="space-y-5">
    <div role="group" aria-label="Tipo de entrenamiento" className="flex flex-wrap justify-center gap-2">{tipos.map(t=><Button key={t} variant={tipo===t?"secondary":"outline"} aria-pressed={tipo===t} onClick={()=>navegar(()=>setTipo(t))}>{t}</Button>)}</div>
    <RunningSemanal key={plan.id+":"+plan.semanas} plan={{...plan,running}} editable onDatos={setRunning} />
    {sesiones.length>0&&<Button variant="outline" onClick={()=>navegar(()=>setAnteriorRunning(true))}>Ver sesiones anteriores de Running</Button>}
    <p className="text-sm text-muted-foreground">La grilla no borra ni convierte las sesiones anteriores. Podés consultarlas y editarlas desde su botón.</p>
  </div>;
  return <div className="space-y-4">
    {tipo==="Running"&&<Button variant="outline" onClick={()=>navegar(()=>setAnteriorRunning(false))}>Volver a la grilla de Running</Button>}
    {plan.inicio && !actual && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{hoyISO() < inicio ? "Este plan todavía no empezó." : `Este plan de ${plan.semanas} semanas terminó.`} Podés consultar sus semanas.</p>}
    <div role="group" aria-label="Tipo de entrenamiento" className="flex flex-wrap justify-center gap-2">{tipos.map((t) => <Button key={t} className="max-w-full whitespace-normal break-words" disabled={ocupado} variant={tipo === t ? "secondary" : "outline"} aria-pressed={tipo === t} onClick={() => navegar(() => { setTipo(t); setSeleccionSesion(null); })}>{t}</Button>)}</div>
    <div className="flex justify-center"><NuevaActividad crear={crearActividad} onCreada={(nueva) => navegar(() => { setTipo(nueva); setSeleccionSesion(null); })} /></div>
    {errorActividad && <p role="alert" className="text-sm text-destructive">{errorActividad}</p>}
    {(sesiones.length > 0 || editable) && <div className="space-y-2">
      <h3 className="sr-only">Días de {tipo.toLowerCase()}</h3>
      <div role="group" aria-label="Días del entrenamiento" className="flex flex-wrap justify-center gap-2">
        {sesiones.map((s, i) => <Button key={s.id} size="sm" variant={sesion?.id === s.id ? "secondary" : "outline"} aria-label={`Día ${i + 1}`} aria-pressed={sesion?.id === s.id} disabled={ocupado} onClick={() => navegar(() => setSeleccionSesion(s.id))}>Día {i + 1}{s.dia && <span className="text-muted-foreground"> · {DIAS_PLAN[s.dia - 1].slice(0, 3)}</span>}</Button>)}
        {editable && <Button variant="outline" size="sm" disabled={ocupado} onClick={() => navegar(() => void nuevaSesion())}><Plus />{ocupado ? "Creando día…" : `Crear Día ${sesiones.length + 1}`}</Button>}
      </div>
    </div>}
    {sesion && <div className="min-w-0 space-y-2">
      <p className="text-center text-xs text-muted-foreground">Semana {semana} de {plan.semanas}</p>
      <SemanasPlan total={plan.semanas} semana={semana} actual={actual} onSeleccionar={setSemana} />
    </div>}
    {sesion ? editable ? <EditorSesion key={sesion.id} sesion={sesion} numeroDia={numeroDia} semana={semana} semanasVisibles={semanasVisibles} totalSemanas={plan.semanas} onDuplicar={() => navegar(() => setDuplicando(sesion))} /> : <LecturaSesion key={sesion.id} sesion={sesion} semana={semana} /> :
      <div className="space-y-3 rounded-xl border border-dashed px-4 py-8 text-center text-sm">
        <p className="font-medium">Todavía no hay días de {tipo.toLowerCase()}</p>
        <p className="mx-auto max-w-md text-muted-foreground">{editable ? `Podés agregar ${tipo.toLowerCase()} a este mismo plan. Creá el Día 1 y cargá los ejercicios para sus ${plan.semanas} semanas.` : "Tu profe todavía no cargó entrenamientos de este tipo."}</p>
      </div>}
    {duplicando && <DuplicarSesionDialog sesion={duplicando} onCerrar={() => setDuplicando(null)} onDuplicada={(id) => { setSeleccionSesion(id); avisarCambioMensual(); setDuplicando(null); }} />}
  </div>;
}

type PropsEditorSesion = { sesion: SesionEntrenamiento; numeroDia: number; semana: number; semanasVisibles: number[]; totalSemanas: number; onDuplicar: () => void };

function EditorSesion(props: PropsEditorSesion) {
  // Los formularios conservan su borrador durante las recargas de otras cards.
  return <FormularioSesion {...props} />;
}

function DuplicarSesionDialog({ sesion, onCerrar, onDuplicada }: { sesion: SesionEntrenamiento; onCerrar: () => void; onDuplicada: (id: string) => void }) {
  const { api } = usePlanEditor();
  const [id] = useState(nuevoId);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function duplicar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    if (hayBorradoresMensuales()) { setError("Esperá a que se guarden los cambios antes de duplicar."); return; }
    const f = new FormData(e.currentTarget);
    const resultado = duplicarSesionApi.safeParse({ id, nombre: String(f.get("nombre")).trim(), dia: f.get("dia") ? Number(f.get("dia")) : null });
    if (!resultado.success) { setError(resultado.error.issues[0]?.message ?? "Revisá los datos de la copia."); return; }
    setOcupado(true); setError("");
    try {
      await api.post(`/sesiones/${sesion.id}/duplicar`, resultado.data);
      onDuplicada(id); toast.success("Día duplicado");
    } catch (e) { setError(mensaje(e)); } finally { setOcupado(false); }
  }
  return <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onCerrar(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={!ocupado}>
      <form onSubmit={duplicar} className="space-y-4">
        <DialogHeader><DialogTitle>Duplicar día</DialogTitle><DialogDescription>Copiá la rutina y las indicaciones de todas sus semanas dentro de este plan. Los pesos del alumno no se copian.</DialogDescription></DialogHeader>
        <fieldset disabled={ocupado} className="min-w-0 space-y-4">
          <label className="block space-y-1 text-sm">Nombre del día<Input name="nombre" defaultValue={`${(sesion.nombre || sesion.tipo).slice(0, 52)} (copia)`} maxLength={60} required autoFocus /></label>
          <label className="block space-y-1 text-sm">Día de la semana<select name="dia" aria-label="Día de la semana" className={selector} defaultValue=""><option value="">Sin asignar</option>{DIAS_PLAN.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
          <p className="text-xs text-muted-foreground">La copia se agrega al final de los días de {sesion.tipo.toLowerCase()}. Después podés editarla de forma independiente.</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Duplicando…" : "Duplicar día"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function EditarSesionDialog({ sesion, onGuardar, onCerrar }: { sesion: SesionEntrenamiento; onGuardar: (sesion: SesionEntrenamiento) => void; onCerrar: () => void }) {
  const { api } = usePlanEditor();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true); setError("");
    try {
      const resultado = parcheSesionApi.safeParse({ nombre: String(f.get("nombre")).trim(), dia: f.get("dia") ? Number(f.get("dia")) : null });
      if (!resultado.success) { setError(resultado.error.issues[0]?.message ?? "Revisá los datos del entrenamiento."); return; }
      await api.patch(`/sesiones/${sesion.id}`, resultado.data);
      const actualizada = { ...sesion, ...resultado.data };
      onGuardar(actualizada); avisarCambioMensual(actualizada); onCerrar();
      toast.success("Datos del entrenamiento guardados");
    } catch (e) { setError(mensaje(e)); } finally { setOcupado(false); }
  }
  return <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onCerrar(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={!ocupado}>
      <form onSubmit={guardar} className="space-y-4">
        <DialogHeader><DialogTitle>Editar entrenamiento</DialogTitle><DialogDescription>Cambiá el nombre y el día en que le toca al alumno.</DialogDescription></DialogHeader>
        <fieldset disabled={ocupado} className="min-w-0 space-y-4">
          <label className="block space-y-1 text-sm">Nombre del día<Input name="nombre" defaultValue={sesion.nombre} maxLength={60} autoFocus /></label>
          <label className="block space-y-1 text-sm">Día de la semana<select name="dia" aria-label="Día de la semana" className={selector} defaultValue={sesion.dia ?? ""}><option value="">Sin asignar</option>{DIAS_PLAN.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
          <p className="text-xs text-muted-foreground">Podés asignar varios entrenamientos al mismo día. Aparecen en «Hoy te toca».</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function FormularioSesion({ sesion, numeroDia, semana, semanasVisibles, totalSemanas, onDuplicar }: PropsEditorSesion) {
  const { api, modelo } = usePlanEditor();
  const [borrador, setBorrador] = useState(sesion);
  const [guardado, setGuardado] = useState(sesion);
  const [altaPendiente, setAltaPendiente] = useState<EjercicioMensual | null>(null);
  const guardando = useRef(false);
  const continuarGuardado = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [editando, setEditando] = useState(false);
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
      // El alta anterior es una dependencia; estos parches ya son independientes.
      // Esperar el lote completo incluso si falla uno, antes de ofrecer reintento.
      for (let i = 0; i < operaciones.length; i += 4) {
        const resultados = await Promise.allSettled(operaciones.slice(i, i + 4).map((op) => api.patch(op.ruta, op.datos)));
        const fallo = resultados.find((r) => r.status === "rejected");
        if (fallo?.status === "rejected") throw fallo.reason;
      }
      continuarGuardado.current = true;
      setGuardado(borrador); avisarCambioMensual(borrador); return true;
    } catch (e) { setError(mensaje(e)); return false; } finally { guardando.current = false; setOcupado(false); }
  }, [api, borrador, guardado, sesion.id, altaPendiente]);
  useEffect(() => {
    if (!sucio) { continuarGuardado.current = false; return; }
    if (ocupado || error) return;
    const espera = altaPendiente || continuarGuardado.current ? 0 : 300;
    continuarGuardado.current = false;
    const timer = setTimeout(() => void guardar(), espera);
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
  return <Card className="gap-6 shadow-none ring-border/60"><CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="break-words text-lg">{borrador.nombre || `${sesion.tipo} · Día ${numeroDia}`}</CardTitle><CardDescription>{borrador.dia ? DIAS_PLAN[borrador.dia - 1] : "Sin día asignado"}</CardDescription></div><div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Duplicar día de entrenamiento" title="Duplicar día" disabled={ocupado || sucio} onClick={onDuplicar}><Copy /></Button><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Editar entrenamiento" title="Editar entrenamiento" disabled={ocupado || sucio} onClick={() => setEditando(true)}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Eliminar sesión" disabled={ocupado || sucio} onClick={() => setConfirmar(true)}><Trash2 /></Button></div></div></CardHeader>
    {editando && <EditarSesionDialog sesion={borrador} onCerrar={() => setEditando(false)} onGuardar={(actualizada) => { setBorrador(actualizada); setGuardado(actualizada); }} />}
    <CardContent><form onSubmit={(e) => { e.preventDefault(); void guardar(); }} className="space-y-6 [&_input[data-slot=input]]:border-border/50 [&_textarea]:border-border/50">
      <fieldset className="min-w-0 space-y-8">
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
    </form>{!modelo && <div className="mt-6"><SeguimientoSesion key={`${sesion.id}:${semana}`} sesionId={sesion.id} semana={semana} lectura /></div>}</CardContent>
    <Dialog open={confirmar || Boolean(quitar)} onOpenChange={(v) => { if (!v && !ocupado) { setConfirmar(false); setQuitar(null); } }}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>¿Eliminar {quitar ? "este ejercicio" : "esta sesión"}?</DialogTitle><DialogDescription>También se borran sus registros de peso. No se puede deshacer.</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" disabled={ocupado} onClick={() => { setConfirmar(false); setQuitar(null); }}>Cancelar</Button><Button variant="destructive" disabled={ocupado} onClick={() => void eliminar()}>Eliminar</Button></DialogFooter></DialogContent></Dialog>
  </Card>;
}

function desplazarDia(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
function lunesDe(fecha: string) { return desplazarDia(fecha, -((new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7)); }

function CalendarioPlanes({ planes }: { planes: PlanMensual[] }) {
  const [fecha, setFecha] = useState(hoyISO);
  const [filtro, setFiltro] = useState<string | null>(null);
  const lunes = lunesDe(fecha);
  const dias = DIAS_PLAN.map((nombre, i) => ({ nombre, fecha: desplazarDia(lunes, i), numero: i + 1 }));
  const tipos = [...new Set(planes.flatMap(p=>[...p.sesiones.map(s=>s.tipo),...(Object.keys(p.running??{}).length?["Running"]:[])]))];
  const tieneContenidoAnterior=(s:SesionEntrenamiento)=>Boolean(s.calentamiento.trim()||s.enfriamiento.trim()||s.activacion.length||s.ejercicios.length||(s.nombre.trim()&&!/^Running\s*[·-]?\s*Día\s*\d+$/i.test(s.nombre)));
  const mostrarAnterior=(p:PlanMensual,s:SesionEntrenamiento)=>s.tipo!=="Running"||!Object.keys(p.running??{}).length||tieneContenidoAnterior(s);
  const sinCargaRunning=(fecha:string,numero:number)=>planes.some(p=>{const semana=semanaDelPlan(p.inicio,fecha,p.semanas);return semana!==null&&Object.keys(p.running??{}).length>0&&!p.running?.[semana]?.[(["lunes","martes","miercoles","jueves","viernes","sabado","domingo"] as const)[numero-1]]?.trim();});
  const entradas = (dia: string, numero: number) => planes.flatMap((plan) => {
    const semana = semanaDelPlan(plan.inicio, dia, plan.semanas);
    if(!semana)return [];
    const anteriores=plan.sesiones.filter(s=>s.dia===numero&&mostrarAnterior(plan,s)&&(filtro===null||s.tipo===filtro)).map(sesion=>({plan,sesion,semana}));
    const texto=plan.running?.[semana]?.[(["lunes","martes","miercoles","jueves","viernes","sabado","domingo"] as const)[numero-1]];
    if(texto?.trim()&&(filtro===null||filtro==="Running"))anteriores.push({plan,semana,sesion:{id:"running:"+plan.id+":"+numero,nombre:texto,tipo:"Running",dia:numero,orden:0,franja:"Sin definir",calentamiento:"",enfriamiento:"",activacion:[],bloques:[],ejercicios:[]}});
    return anteriores;
  });
  const numeroDia = (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7 + 1;
  const seleccionadas = entradas(fecha, numeroDia);
  const sinAsignar = planes.flatMap((plan) => {
    const semana = semanaDelPlan(plan.inicio, fecha, plan.semanas);
    return semana ? plan.sesiones.filter((s) => s.dia === null && mostrarAnterior(plan,s) && (filtro === null || s.tipo === filtro)).map((sesion) => ({ plan, sesion, semana })) : [];
  });
  return <div className="min-w-0 space-y-6">
    <div className="flex flex-wrap items-center justify-center gap-2"><Button size="icon-sm" variant="outline" aria-label="Semana anterior" disabled={lunes <= "2000-01-08"} onClick={() => navegar(() => setFecha((anterior) => desplazarDia(anterior, -7)))}><ArrowLeft /></Button><p className="text-sm font-medium">{formatFecha(lunes)} al {formatFecha(desplazarDia(lunes, 6), { conAnio: true })}</p><Button size="icon-sm" variant="outline" aria-label="Semana siguiente" disabled={fecha >= "2100-12-20"} onClick={() => navegar(() => setFecha((anterior) => desplazarDia(anterior, 7)))}><ArrowRight /></Button><Button size="sm" variant="ghost" onClick={() => navegar(() => setFecha(hoyISO()))}>Hoy</Button></div>
    <div role="group" aria-label="Filtrar actividades" className="flex flex-wrap justify-center gap-2">{[null, ...tipos].map((tipo) => <Button key={tipo === null ? "todos" : `actividad:${tipo}`} size="sm" variant={filtro === tipo ? "secondary" : "outline"} aria-pressed={filtro === tipo} className="max-w-full whitespace-normal break-words" onClick={() => navegar(() => setFiltro(tipo))}>{tipo ?? "Todos"}</Button>)}</div>
    <div role="group" aria-label="Días de la semana" className="flex min-w-0 flex-wrap justify-center gap-2">{dias.map((dia) => {
      const delDia = entradas(dia.fecha, dia.numero);
      const seleccionada = fecha === dia.fecha;
      return <Button key={dia.fecha} variant="ghost" aria-label={dia.nombre} aria-pressed={seleccionada} onClick={() => navegar(() => setFecha(dia.fecha))} className={`h-auto min-h-20 min-w-0 basis-[calc((100%-1.5rem)/4)] flex-col justify-start gap-2 self-stretch whitespace-normal rounded-xl border px-1.5 py-3 sm:basis-[calc((100%-3rem)/7)] ${seleccionada ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-transparent bg-muted/40"}`}><span className="text-sm font-semibold">{dia.nombre.slice(0, 3)} {Number(dia.fecha.slice(8))}</span><span className="flex w-full flex-col gap-2 text-xs text-muted-foreground">{delDia.length ? delDia.map(({plan, sesion}) => <span key={sesion.id} className="break-words">{sesion.tipo}<span className="block font-semibold text-foreground">{sesion.id.startsWith("running:")?"Planilla": "Día "+(plan.sesiones.filter((s) => s.tipo === sesion.tipo).findIndex((s) => s.id === sesion.id) + 1)}</span></span>) : (filtro===null||filtro==="Running")&&sinCargaRunning(dia.fecha,dia.numero)?"Sin cargar":"Descanso"}</span></Button>;
    })}</div>
    <section className="space-y-5"><h3 className="text-lg font-semibold">{fecha === hoyISO() ? "Hoy te toca" : formatFecha(fecha, { conAnio: true })}</h3>{seleccionadas.length ? seleccionadas.map(({ plan, sesion, semana }) => <div key={sesion.id} className="space-y-2"><p className="break-words text-sm text-muted-foreground">{plan.nombre} · Semana {semana} de {plan.semanas}</p>{sesion.id.startsWith("running:")?<div className="rounded-xl border bg-card p-5"><h4 className="font-semibold">Running</h4><p className="mt-3 whitespace-pre-wrap break-words leading-7">{sesion.nombre}</p></div>:<LecturaSesion sesion={sesion} semana={semana} />}</div>) : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No hay entrenamientos asignados para este día{filtro === null ? "." : ` de ${filtro.toLowerCase()}.`}</p>}</section>
    {sinAsignar.length > 0 && <section className="space-y-5"><h3 className="font-semibold">Entrenamientos sin día asignado</h3>{sinAsignar.map(({ plan, sesion, semana }) => <div key={sesion.id} className="space-y-2"><p className="break-words text-sm text-muted-foreground">{plan.nombre} · Semana {semana} de {plan.semanas}</p><LecturaSesion sesion={sesion} semana={semana} /></div>)}</section>}
    {(filtro===null||filtro==="Running")&&planes.filter(p=>Object.keys(p.running??{}).length>0&&semanaDelPlan(p.inicio,fecha,p.semanas)!==null).map(p=><RunningSemanal key={p.id+":"+fecha} plan={p} semanaInicial={semanaDelPlan(p.inicio,fecha,p.semanas)??1} />)}
    <section className="space-y-3 border-t pt-5"><h3 className="text-sm font-semibold">Tus planes activos</h3>{planes.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm"><p className="min-w-0 break-words font-medium">{p.nombre}</p><p className="text-muted-foreground">{formatFecha(p.inicio)} · {p.semanas} semanas · {semanaDelPlan(p.inicio, fecha, p.semanas) ? `Semana ${semanaDelPlan(p.inicio, fecha, p.semanas)}` : fecha < p.inicio ? "Todavía no empezó" : "Finalizado"}</p></div>)}</section>
  </div>;
}

function LecturaSesion({ sesion, semana }: { sesion: SesionEntrenamiento; semana: number }) {
  const grupos = bloquesDelPlan(sesion.ejercicios, sesion.bloques).filter((grupo) => sesion.ejercicios.some((e) => e.grupo === grupo));
  return <Card className="gap-5"><CardHeader><CardTitle role="heading" aria-level={4}>{sesion.nombre || sesion.tipo}</CardTitle><CardDescription>{sesion.tipo} · Semana {semana}</CardDescription></CardHeader><CardContent className="space-y-6 sm:space-y-8">
    <EntradaEnCalorLectura texto={sesion.calentamiento} ejercicios={sesion.activacion} />
    {grupos.map((grupo) => <section key={grupo} aria-label={`Bloque ${grupos.indexOf(grupo) + 1}`} className="space-y-3">
      <h3 className="text-sm font-semibold">Bloque {grupos.indexOf(grupo) + 1}</h3>
      <ul className="divide-y divide-border/50 rounded-xl bg-muted/20 px-3 ring-1 ring-border/50 sm:px-4">{sesion.ejercicios.filter((e) => e.grupo === grupo).map((e) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-3">
        <div className="min-w-0 flex-1 basis-40"><p className="break-words text-sm font-medium">{e.nombre || "Ejercicio sin nombre"}</p><p className="mt-1 break-words text-sm font-medium text-primary">{prescripcionEfectiva(e.semanas, semana) || "Sin indicación"}</p></div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">{e.descanso && <p className="break-words text-xs text-muted-foreground">Descanso: {e.descanso}</p>}{sesion.tipo === "Fuerza" && <PesoSemanal key={`${e.id}:${semana}`} ejercicio={e} semana={semana} />}</div>
      </li>)}</ul>
    </section>)}

    {!sesion.ejercicios.length && <p className="text-sm text-muted-foreground">Esta sesión todavía no tiene ejercicios.</p>}
    {sesion.enfriamiento && <section><h3 className="mb-2 text-sm font-semibold">Vuelta a la calma</h3><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{sesion.enfriamiento}</p></section>}
    <SeguimientoSesion key={`${sesion.id}:${semana}`} sesionId={sesion.id} semana={semana} />
  </CardContent></Card>;
}

function PesoSemanal({ ejercicio, semana }: { ejercicio: EjercicioMensual; semana: number }) {
  const celda = ejercicio.semanas.find((c) => c.semana === semana);
  const [peso, setPeso] = useState(celda?.peso ?? "");
  const [guardado, setGuardado] = useState(celda?.peso ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const sucio = peso !== guardado;
  useEffect(() => registrarBorradorMensual(`peso:${ejercicio.id}:${semana}`, sucio || ocupado), [ejercicio.id, semana, sucio, ocupado]);
  useEffect(() => {
    if (!sucio && !ocupado) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const alNavegar = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("a[href], [role=tab]")) {
        e.preventDefault(); e.stopPropagation(); toast.error("Esperá a que se guarde el peso antes de cambiar de vista.");
      }
    };
    window.addEventListener("beforeunload", avisar); document.addEventListener("click", alNavegar, true);
    return () => { window.removeEventListener("beforeunload", avisar); document.removeEventListener("click", alNavegar, true); };
  }, [sucio, ocupado]);
  useEffect(() => {
    if (!celda || !sucio || ocupado || error) return;
    const timer = setTimeout(async () => {
      setOcupado(true);
      try {
        const resultado = parcheCeldaAlumnoApi.safeParse({ peso: peso || null, pesoFecha: peso ? hoyISO() : null });
        if (!resultado.success) { setError(resultado.error.issues[0]?.message ?? "Revisá el peso."); return; }
        await api.patch(`/sesion-ejercicios/${ejercicio.id}/semanas/${semana}`, resultado.data);
        setGuardado(peso); avisarCambioMensual();
      } catch (e) { setError(mensaje(e)); } finally { setOcupado(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [peso, sucio, ocupado, error, ejercicio.id, semana, celda]);
  return <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-xs text-muted-foreground">kg<Input aria-label={`Peso de ${ejercicio.nombre}, semana ${semana}`} inputMode="decimal" maxLength={10} className="h-8 w-20" value={peso} onChange={(e) => { setPeso(e.target.value); setError(""); }} disabled={!celda} /></label><span role="status" className="text-xs text-muted-foreground">{ocupado ? "Guardando…" : error ? "Sin guardar" : sucio ? "Pendiente…" : guardado ? "Guardado" : ""}</span></div>{error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-xs text-destructive">{error}</p><Button type="button" size="sm" variant="ghost" onClick={() => setError("")}>Reintentar</Button></div>}</div>;
}
