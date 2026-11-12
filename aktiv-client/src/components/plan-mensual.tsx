"use client";
import { EditorDia } from "./editor-dia";
import { PlanificacionUnificada } from "./planificacion-unificada";
import { textoRunningPlanificado, textoDiaRunning } from "@aktiv/contrato";
import { DiasSesion } from "@/components/dias-sesion";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Copy, Pencil, Plus, Trash2, BookmarkPlus, Power, Search } from "lucide-react";
import { toast } from "sonner";
import { ZodError } from "zod";
import {
  actividadesDelDia, diasDeSesion, DIAS_PLAN, MAX_SEMANAS_PLAN, semanasDelPlan, prescripcionEfectiva, semanaDelPlan,
  altaMensualApi, altaSesionApi, duplicarSesionApi, parcheSesionApi, parcheEjercicioMensualApi,
  parcheCeldaAlumnoApi, parcheCeldaProfeApi, parcheMensualApi, resumenModeloSchema, type ResumenModelo, type PlanMensual, type SesionEntrenamiento, type EjercicioMensual,
} from "@aktiv/contrato";
import { RunningSemanal } from "./running-semanal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { ModeloDialog, type AccionModelo } from "@/components/modelo-dialog";
import { avisarCambioMensual, usePlanesMensuales, hayBorradoresMensuales, registrarBorradorMensual } from "@/lib/mensual";
import { formatFecha, hoyISO, nuevoId } from "@/lib/format";

function navegar(accion: () => void) {
  if (hayBorradoresMensuales()) toast.error("Esperá a que se guarden los cambios antes de cambiar de vista.");
  else accion();
}
function mensaje(e: unknown) { return e instanceof ZodError ? e.issues[0]?.message ?? "Revisá los datos del formulario." : e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo."; }
function cambio<T extends object>(antes: T, despues: T) {
  return Object.fromEntries(Object.entries(despues).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(antes[k as keyof T])));
}

export function PlanMensualPanel({ alumnoId, editable = false, children, unificado=false, datosExternos }: { alumnoId: string; editable?: boolean; children?: ReactNode; unificado?:boolean; datosExternos?:ReturnType<typeof usePlanesMensuales> }) {
  const propios = usePlanesMensuales(datosExternos?undefined:alumnoId);const datos=datosExternos??propios;
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [crear, setCrear] = useState(false);
  const [modelos, setModelos] = useState<ResumenModelo[]>([]);
  const [filtroModelo, setFiltroModelo] = useState("");
  const [buscarModelo, setBuscarModelo] = useState(false);
  const [modeloSeleccionado, setModeloSeleccionado] = useState<AccionModelo | null>(null);
  const [vistaDiaria,setVistaDiaria]=useState(false);
  const [diaCreado,setDiaCreado]=useState<SesionEntrenamiento|null>(null);

  const [ocupado, setOcupado] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [reemplazando, setReemplazando] = useState<PlanMensual | null>(null);
  const [editando, setEditando] = useState<PlanMensual | null>(null);
  const [guardandoModelo, setGuardandoModelo] = useState(false);
  const [duplicandoPlan, setDuplicandoPlan] = useState<PlanMensual | null>(null);
  const visibles = editable ? datos.planes : datos.planes.filter((p) => p.activo);
  const plan = visibles.find((p) => p.id === seleccion) ?? visibles.find((p) => p.activo && (editable || !unificado || p.inicio<=hoyISO())) ?? visibles.find((p)=>p.activo) ?? visibles.at(-1);

  async function abrirModelos() {
    try { setModelos(resumenModeloSchema.array().parse(await api.get<unknown>("/planes-modelo"))); setFiltroModelo(""); setBuscarModelo(true); }
    catch (e) { toast.error(mensaje(e)); }
  }

  async function nuevo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      const dto = altaMensualApi.parse({ id: nuevoId(), nombre: String(f.get("nombre")).trim(), tipo: String(f.get("tipo")), inicio: String(f.get("inicio")), semanas: Number(f.get("semanas")), activo: false, diasIniciales: JSON.parse(String(f.get("actividadesIniciales"))) });
      await api.post(`/alumnos/${alumnoId}/planes-mensuales`, dto);
      avisarCambioMensual(); setSeleccion(dto.id); setCrear(false); toast.success("Plan creado");
    } catch (e) { toast.error(mensaje(e)); } finally { setOcupado(false); }
  }
  async function nuevoDia() {
    if (!plan || ocupado) return;
    if (plan.tipo === "Running") {
      toast.error("Running se carga desde las actividades de la semana, no como un día de rutina.");
      return;
    }
    setOcupado(true);
    try {
      const tipo=plan.tipo;
      const numero=plan.sesiones.filter(s=>s.tipo===tipo).length+1;
      const dto=altaSesionApi.parse({id:nuevoId(),tipo,nombre:`${tipo} - Día ${numero}`,dia:null,calentamiento:"",enfriamiento:""});
      await api.post(`/planes-mensuales/${plan.id}/sesiones`,dto);
      setDiaCreado({...dto,orden:plan.sesiones.length,ejercicios:[]});
      avisarCambioMensual(); toast.success(`${tipo} - Día ${numero} creado`);
    } catch(e) { toast.error(mensaje(e)); } finally {setOcupado(false);}
  }
  async function accion(tipo: "activar" | "desactivar" | "borrar", reemplazar=false) {
    if (!plan) return;
    setOcupado(true);
    try {
      if (tipo === "activar") await api.post(`/planes-mensuales/${plan.id}/activar`, { reemplazar });
      else if (tipo === "desactivar") await api.patch(`/planes-mensuales/${plan.id}`, { activo: false });
      else await api.delete(`/planes-mensuales/${plan.id}`);
      if (tipo !== "borrar") setSeleccion(plan.id);
      avisarCambioMensual(); setBorrar(false); setReemplazando(null); toast.success(tipo === "activar" ? (reemplazar ? "Plan reemplazado y activado" : "Plan activado") : tipo === "desactivar" ? "Plan desactivado. Su contenido y registros se conservan." : "Plan eliminado");
    } catch (e) { toast.error(mensaje(e)); } finally { setOcupado(false); }
  }
  return <div className="min-w-0 space-y-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-medium tracking-tight"><CalendarDays className="size-5 shrink-0 text-primary" />Plan de entrenamiento</h2>
        {!unificado&&<p className="mt-1 text-sm text-muted-foreground">Sesiones por día y progresión por semanas.</p>}</div>
      {editable && <div className="flex flex-wrap gap-2"><Button variant={unificado?"default":"outline"} size="sm" disabled={ocupado || datos.cargando || Boolean(datos.error)} onClick={() => navegar(() => { setCrear(true); })}><Plus />Nuevo plan</Button><Button variant="outline" size="sm" disabled={ocupado || datos.cargando} onClick={()=>navegar(()=>void abrirModelos())}><Search />Asignar modelo</Button></div>}
    </div>
    {datos.cargando ? <p role="status" className="py-8 text-sm text-muted-foreground">Cargando planes…</p> : datos.error ?
      <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm"><p>{datos.error}</p><Button variant="outline" size="sm" className="mt-2" onClick={datos.reintentar}>Reintentar</Button></div> : <>
      {!(editable&&unificado) && (editable||unificado) && visibles.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Planes de entrenamiento">
        {visibles.map((p) => <Button key={p.id} variant={p.id === plan?.id ? "secondary" : "outline"} size="sm" aria-pressed={p.id === plan?.id} onClick={() => navegar(() => setSeleccion(p.id))}>
          {p.activo && <Check className="size-3.5" />}{p.nombre || "Sin nombre"}
        </Button>)}
      </div>}
      {!editable && !unificado && visibles.length > 0 ? <CalendarioPlanes planes={visibles} /> : plan ? <>
        {editable&&unificado?<div className="space-y-2">
          <div aria-label="Acciones del plan" role="group" className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
            <Button variant="outline" className="h-auto min-h-9 min-w-0 max-w-[65%] justify-start whitespace-normal px-4 py-1.5 text-left font-medium" aria-label="Editar plan de entrenamiento" title="Editar nombre, inicio y duración" disabled={ocupado} onClick={()=>navegar(()=>setEditando(plan))}>{plan.nombre||"Sin nombre"}</Button>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">{plan.tipo!=="Running"&&<Button size="sm" variant="outline" className="text-muted-foreground" disabled={ocupado} onClick={()=>navegar(()=>void nuevoDia())}><Plus />Crear día</Button>}<Switch aria-label={plan.activo?"Desactivar plan":"Activar plan"} title={plan.activo?"Desactivar plan":"Activar plan"} checked={plan.activo} disabled={ocupado} style={{backgroundColor:plan.activo?"var(--primary)":"var(--muted)"}} onCheckedChange={v=>navegar(()=>{if(v){const activo=datos.planes.find(p=>p.activo&&p.tipo===plan.tipo&&p.id!==plan.id);if(activo){setReemplazando(activo);return;}}void accion(v?"activar":"desactivar");})} /><Button size="icon-sm" variant="ghost" aria-label="Guardar plan como modelo" title="Guardar plan completo como modelo" disabled={ocupado} onClick={()=>navegar(()=>setGuardandoModelo(true))}><BookmarkPlus /></Button><Button size="icon-sm" variant="ghost" aria-label="Duplicar plan de entrenamiento" title="Duplicar plan" disabled={ocupado} onClick={()=>navegar(()=>setDuplicandoPlan(plan))}><Copy /></Button><Button size="icon-sm" variant="ghost" aria-label="Eliminar plan de entrenamiento" title="Eliminar plan" disabled={ocupado} onClick={()=>navegar(()=>setBorrar(true))}><Trash2 className="text-destructive" /></Button></div>
          </div>
          <details className="group/otros-planes"><summary className="w-fit cursor-pointer rounded-md px-1 py-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Ver más planes</summary><div className="mt-2 space-y-3 rounded-lg border border-border/60 p-3"><div className="flex flex-wrap gap-2" aria-label="Planes de entrenamiento">{visibles.map(p=><Button key={p.id} variant={p.id===plan.id?"secondary":"outline"} size="sm" aria-pressed={p.id===plan.id} onClick={()=>navegar(()=>setSeleccion(p.id))}>{p.activo&&<Check className="size-3.5" />}{p.nombre||"Sin nombre"}</Button>)}</div></div></details>
        </div>:<>        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="min-w-0 flex-1 basis-48"><p className="break-words text-lg font-medium tracking-tight">{plan.nombre || "Plan de entrenamiento"}</p><p className="text-xs text-muted-foreground">Inicio: {formatFecha(plan.inicio, { conAnio: true })} · {plan.semanas} semanas · {plan.activo ? "Activo" : "Borrador"}</p></div>
          {editable && <div className="flex flex-wrap items-center gap-1">
            {plan.activo && <Button size="icon" variant="ghost" aria-label="Desactivar plan" title="Desactivar plan" disabled={ocupado} onClick={() => navegar(() => void accion("desactivar"))}><Power className="text-primary" /></Button>}
            {!plan.activo && <Button size="icon" variant="ghost" aria-label="Activar plan" title="Activar plan" disabled={ocupado} onClick={() => navegar(() => {const activo=datos.planes.find(p=>p.activo&&p.tipo===plan.tipo&&p.id!==plan.id);if(activo)setReemplazando(activo);else void accion("activar");})}><Power /></Button>}
            <Button variant="ghost" size="icon" aria-label="Guardar como modelo" title="Guardar como modelo" disabled={ocupado} onClick={() => navegar(() => setGuardandoModelo(true))}><BookmarkPlus /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Duplicar plan de entrenamiento" title="Duplicar plan" disabled={ocupado} onClick={() => navegar(() => setDuplicandoPlan(plan))}><Copy /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Editar plan de entrenamiento" title="Editar plan" disabled={ocupado} onClick={() => navegar(() => setEditando(plan))}><Pencil /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Eliminar plan de entrenamiento" disabled={ocupado} onClick={() => navegar(() => setBorrar(true))}><Trash2 className="text-destructive" /></Button>
          </div>}
        </div></>}
        <>{unificado&&!editable&&<div className="flex justify-end"><Button size="sm" variant="outline" onClick={()=>navegar(()=>setVistaDiaria(v=>!v))}>{vistaDiaria?"Ver grilla semanal":"Vista diaria"}</Button></div>}{unificado&&(!editable&&vistaDiaria)?<CalendarioPlanes planes={visibles} />:unificado&&!editable&&plan.inicio>hoyISO()?<p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Tu plan empieza el {formatFecha(plan.inicio)}. Podés consultar las fechas desde Vista diaria.</p>:unificado?<PlanificacionUnificada key={`${plan.id}:${plan.semanas}`} plan={plan} editable={editable} renderRutina={(s,semana,cerrar)=><RutinaPlanModal key={s.id} plan={plan} sesion={s} editable={editable} semanaInicial={semana} onCerrar={cerrar} />} />:<ContenidoMes key={`${plan.id}:${plan.semanas}`} plan={plan} editable={editable} />}</>
      </> : <p className="min-w-0 break-words rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{editable ? "Creá un plan, elegí su duración y agregá las sesiones." : "Tu profe todavía no activó un plan de entrenamiento."}</p>}
    </>}
    {children && <details className="rounded-xl border px-4 py-3"><summary className="cursor-pointer text-sm text-muted-foreground">Planes anteriores</summary><div className="mt-4">{children}</div></details>}
    {diaCreado && plan && <RutinaPlanModal plan={plan} sesion={plan.sesiones.find(s=>s.id===diaCreado.id)??diaCreado} editable semanaInicial={semanaDelPlan(plan.inicio,hoyISO(),plan.semanas)??1} onCerrar={()=>setDiaCreado(null)} />}
    {guardandoModelo && plan && <GuardarModeloDialog plan={plan} onCerrar={() => setGuardandoModelo(false)} />}
    {editando && <EditarPlanDialog plan={editando} onCerrar={() => setEditando(null)} />}
    {duplicandoPlan && <DuplicarPlanDialog plan={duplicandoPlan} alumnoId={alumnoId} onCerrar={() => setDuplicandoPlan(null)} onDuplicado={(id, destino) => {
      if (destino === alumnoId) setSeleccion(id);
      avisarCambioMensual(); setDuplicandoPlan(null);
    }} />}
    <Dialog open={crear} onOpenChange={(v) => !ocupado && setCrear(v)}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={!ocupado}>
      <form onSubmit={nuevo} className="space-y-4"><DialogHeader><DialogTitle>Nuevo plan de entrenamiento</DialogTitle><DialogDescription>Elegí un tipo de entrenamiento y cuántas sesiones tendrá disponibles.</DialogDescription></DialogHeader>
        <fieldset disabled={ocupado} className="min-w-0 space-y-4">
        <label className="block space-y-1 text-sm">Nombre del plan<Input name="nombre" placeholder="Ej: Base para 10K" maxLength={120} required /></label>
        <label className="block space-y-1 text-sm">Duración en semanas<Input name="semanas" type="number" min={1} max={MAX_SEMANAS_PLAN} step={1} defaultValue={4} required /></label>
        <ActividadesIniciales />
        <label className="block space-y-1 text-sm">Fecha de inicio<FechaInput name="inicio" defaultValue={hoyISO()} min="2000-01-01" max="2100-01-01" required /></label>
        </fieldset>
        <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={() => setCrear(false)}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Creando…" : "Crear plan"}</Button></DialogFooter>
      </form></DialogContent></Dialog>
    <Dialog open={buscarModelo} onOpenChange={setBuscarModelo}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Asignar un modelo</DialogTitle><DialogDescription>Elegí un modelo de la biblioteca. Se copiará como borrador independiente para este alumno.</DialogDescription></DialogHeader><Input aria-label="Buscar modelo" placeholder="Buscar por nombre o actividad" value={filtroModelo} onChange={e=>setFiltroModelo(e.target.value)} /><div className="max-h-80 space-y-2 overflow-y-auto">{modelos.filter(m=>`${m.nombre} ${m.tipo}`.toLocaleLowerCase("es").includes(filtroModelo.trim().toLocaleLowerCase("es"))).length?modelos.filter(m=>`${m.nombre} ${m.tipo}`.toLocaleLowerCase("es").includes(filtroModelo.trim().toLocaleLowerCase("es"))).map(m=><button key={m.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/50" onClick={()=>{setBuscarModelo(false);setModeloSeleccionado({tipo:"asignar",modelo:m});}}><span className="min-w-0"><span className="block truncate font-medium">{m.nombre}</span><span className="text-xs text-muted-foreground">{m.tipo} · {m.dias} sesiones · {m.semanas} semanas</span></span><span aria-hidden="true">→</span></button>):<p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{modelos.length?"No hay modelos que coincidan.":"Todavía no hay modelos. Crealos desde Planes."}</p>}</div><DialogFooter><Button variant="outline" onClick={()=>setBuscarModelo(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>
    {modeloSeleccionado?.tipo==="asignar"&&<ModeloDialog key={modeloSeleccionado.modelo.id} accion={modeloSeleccionado} alumnoInicial={alumnoId} onCerrar={()=>setModeloSeleccionado(null)} />}
    <Dialog open={borrar} onOpenChange={(v) => !ocupado && setBorrar(v)}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>¿Eliminar este plan?</DialogTitle><DialogDescription>Se borran sus sesiones, ejercicios y registros de peso. No se puede deshacer.</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" disabled={ocupado} onClick={() => setBorrar(false)}>Cancelar</Button><Button variant="destructive" disabled={ocupado} onClick={() => void accion("borrar")}>Eliminar plan</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(reemplazando)} onOpenChange={(v)=>!ocupado&&!v&&setReemplazando(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>¿Reemplazar el plan activo?</DialogTitle><DialogDescription>Ya hay un plan de {plan?.tipo} activo: «{reemplazando?.nombre}». Al reemplazarlo, quedará como borrador y conservará sus sesiones y registros.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={ocupado} onClick={()=>setReemplazando(null)}>Cancelar</Button><Button disabled={ocupado} onClick={()=>void accion("activar",true)}>{ocupado?"Reemplazando…":"Reemplazar plan"}</Button></DialogFooter></DialogContent></Dialog>
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
    const delDia = plan.sesiones.filter((s) => diasDeSesion(s).includes(diaAlumno)).sort((a, b) => a.orden - b.orden);
    const sinAsignar = plan.sesiones.filter((s) => !diasDeSesion(s).length);
    const hoy = (new Date().getDay() + 6) % 7 + 1;
    return <div className="space-y-6">
      <div className="space-y-2"><p className="text-center text-sm font-medium">Semana {semana} de {plan.semanas}</p><SemanasPlan total={plan.semanas} semana={semana} actual={actual} onSeleccionar={(s) => navegar(() => setSemana(s))} /></div>
      <div className="space-y-3"><h3 className="text-lg font-semibold">{diaAlumno === hoy ? actual ? "Hoy te toca" : "Consultar entrenamientos" : DIAS_PLAN[diaAlumno - 1]}</h3>
        {!actual && <p className="text-sm text-muted-foreground">{hoyISO() < inicio ? "El plan todavía no empezó." : "Este plan terminó."} Podés consultar sus entrenamientos.</p>}
          <div role="group" aria-label="Días de la semana" className="flex min-w-0 flex-wrap justify-center gap-2">
            {DIAS_PLAN.map((dia, i) => {
              const entrenamientos = plan.sesiones.filter((s) => diasDeSesion(s).includes(i + 1));
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
    <div role="group" aria-label="Tipo de entrenamiento" className="flex flex-wrap justify-center gap-2">{tipos.map(t=><Button key={t} variant={tipo===t?"secondary":"outline"} aria-pressed={tipo===t} onClick={()=>navegar(()=>setTipo(t))}>{t}</Button>)}{editable && <NuevaActividad crear={crearActividad} onCreada={(nueva) => navegar(() => { setTipo(nueva); setSeleccionSesion(null); })} />}</div>
    <RunningSemanal key={plan.id+":"+plan.semanas} plan={{...plan,running}} editable onDatos={setRunning} />
    {sesiones.length>0&&<Button variant="outline" onClick={()=>navegar(()=>setAnteriorRunning(true))}>Ver sesiones anteriores de Running</Button>}
    <p className="text-sm text-muted-foreground">La grilla no borra ni convierte las sesiones anteriores. Podés consultarlas y editarlas desde su botón.</p>
  </div>;
  return <div className="space-y-4">
    {tipo==="Running"&&<Button variant="outline" onClick={()=>navegar(()=>setAnteriorRunning(false))}>Volver a la grilla de Running</Button>}
    {plan.inicio && !actual && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{hoyISO() < inicio ? "Este plan todavía no empezó." : `Este plan de ${plan.semanas} semanas terminó.`} Podés consultar sus semanas.</p>}
    <div role="group" aria-label="Tipo de entrenamiento" className="flex flex-wrap justify-center gap-2">{tipos.map((t) => <Button key={t} className="max-w-full whitespace-normal break-words" disabled={ocupado} variant={tipo === t ? "secondary" : "outline"} aria-pressed={tipo === t} onClick={() => navegar(() => { setTipo(t); setSeleccionSesion(null); })}>{t}</Button>)}{editable && <NuevaActividad crear={crearActividad} onCreada={(nueva) => navegar(() => { setTipo(nueva); setSeleccionSesion(null); })} />}</div>
    {errorActividad && <p role="alert" className="text-sm text-destructive">{errorActividad}</p>}
    {(sesiones.length > 0 || editable) && <div className="space-y-2">
      <h3 className="sr-only">Días de {tipo.toLowerCase()}</h3>
      <div role="group" aria-label="Días del entrenamiento" className="flex flex-wrap justify-center gap-2">
        {sesiones.map((s, i) => <Button key={s.id} size="sm" variant={sesion?.id === s.id ? "secondary" : "outline"} aria-label={`Día ${i + 1}`} aria-pressed={sesion?.id === s.id} disabled={ocupado} onClick={() => navegar(() => setSeleccionSesion(s.id))}>Día {i + 1}{diasDeSesion(s).length>0 && <span className="text-muted-foreground"> · {diasDeSesion(s).map(d=>DIAS_PLAN[d-1].slice(0,3)).join(" / ")}</span>}</Button>)}
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

type PropsEditorSesion = { sesion: SesionEntrenamiento; numeroDia: number; semana: number; semanasVisibles: number[]; totalSemanas: number; enModal?:boolean; selectorSemana?:ReactNode; onDuplicar: () => void };

function EditorSesion(props: PropsEditorSesion) {
  // Los formularios conservan su borrador durante las recargas de otras cards.
  return <FormularioSesion {...props} />;
}

function DuplicarSesionDialog({ sesion, onCerrar, onDuplicada }: { sesion: SesionEntrenamiento; onCerrar: () => void; onDuplicada: (id: string) => void }) {
  const { api } = usePlanEditor();
  const [id] = useState(nuevoId);
  const [dias, setDias] = useState<number[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function duplicar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    if (hayBorradoresMensuales()) { setError("Esperá a que se guarden los cambios antes de duplicar."); return; }
    const f = new FormData(e.currentTarget);
    const resultado = duplicarSesionApi.safeParse({ id, nombre: String(f.get("nombre")).trim(), dia: dias[0] ?? null, dias });
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
          <div className="space-y-2"><p className="text-sm">Días de la semana</p><DiasSesion value={dias} onChange={setDias} disabled={ocupado} /></div>
          <p className="text-xs text-muted-foreground">La copia se agrega al final de los días de {sesion.tipo.toLowerCase()}. Después podés editarla de forma independiente.</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Duplicando…" : "Duplicar día"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function EditarSesionDialog({ sesion, onGuardar, onCerrar, soloNombre=false }: { sesion: SesionEntrenamiento; onGuardar: (sesion: SesionEntrenamiento) => void; onCerrar: () => void; soloNombre?:boolean }) {
  const { api } = usePlanEditor();
  const [dias, setDias] = useState(()=>diasDeSesion(sesion));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true); setError("");
    try {
      const resultado = parcheSesionApi.safeParse({ nombre: String(f.get("nombre")).trim(), ...(soloNombre?{}:{dia: dias[0] ?? null, dias}) });
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
          {!soloNombre&&<div className="space-y-2"><p className="text-sm">Días de la semana</p><DiasSesion value={dias} onChange={setDias} disabled={ocupado} /></div>}
          <p className="text-xs text-muted-foreground">Podés asignar varios entrenamientos al mismo día. Aparecen en «Hoy te toca».</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="ghost" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar cambios"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function FormularioSesion({ sesion, numeroDia, semana, semanasVisibles, totalSemanas, onDuplicar, enModal=false, selectorSemana }: PropsEditorSesion) {
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
      const cabecera = (s: SesionEntrenamiento) => ({ nombre: s.nombre, tipo: s.tipo, dia: s.dia, ...(s.dias ? {dias:s.dias} : {}), calentamiento: s.calentamiento, activacion: s.activacion, enfriamiento: s.enfriamiento, orden: s.orden, bloques: s.bloques, ...(s.actividadesBloques?{actividadesBloques:s.actividadesBloques}:{}) });
      const c = cambio(cabecera(guardado), cabecera(borrador));
      // Validar el borrador entero antes de empezar a escribir.
      const operaciones: { ruta: string; datos: object }[] = [];
      if (Object.keys(c).length) operaciones.push({ ruta: `/sesiones/${sesion.id}`, datos: parcheSesionApi.parse(c) });
      // El alta crea celdas vacías en el servidor; los valores iniciales también deben guardarse.
      for (const ej of borrador.ejercicios) {
        const previo = guardado.ejercicios.find((p) => p.id === ej.id) ?? (altaPendiente ? { ...altaPendiente, semanas: altaPendiente.semanas.map((c) => ({ ...c, prescripcion: "" })) } : null);
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
        setGuardado((anterior) => ({ ...anterior, ejercicios: [...anterior.ejercicios, { ...altaPendiente, semanas: altaPendiente.semanas.map((c) => ({ ...c, prescripcion: "" })) }] }));
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
    const nuevo: EjercicioMensual = { id: nuevoId(), nombre: "", descanso: "60 s", grupo, orden: Math.max(-1, ...borrador.ejercicios.map((e) => e.orden)) + 1, semanas: semanasDelPlan(totalSemanas).map((semana) => ({ semana, prescripcion: "3×8", peso: null, pesoFecha: null })) };
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
  return <Card className={enModal?"gap-4 bg-transparent py-0 shadow-none ring-0":"gap-6 shadow-none ring-border/60"}>{enModal?<CardHeader className="px-0"><Input aria-label="Nombre del día" maxLength={60} value={borrador.nombre} onChange={e=>setBorrador(b=>({...b,nombre:e.target.value}))} className="border-transparent bg-transparent text-center text-lg font-medium shadow-none" /></CardHeader>:<CardHeader><div className="flex items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="break-words text-lg">{borrador.nombre || `${sesion.tipo} · Día ${numeroDia}`}</CardTitle>{!enModal&&<div className="mt-2"><DiasSesion value={diasDeSesion(borrador)} onChange={(dias)=>setBorrador(b=>({...b,dias,dia:dias[0]??null}))} /></div>}</div><div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Duplicar día de entrenamiento" title="Duplicar día" disabled={ocupado || sucio} onClick={onDuplicar}><Copy /></Button><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Editar entrenamiento" title="Editar entrenamiento" disabled={ocupado || sucio} onClick={() => setEditando(true)}><Pencil /></Button><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Eliminar sesión" disabled={ocupado || sucio} onClick={() => setConfirmar(true)}><Trash2 /></Button></div></div></CardHeader>}
    {editando && <EditarSesionDialog soloNombre={enModal} sesion={borrador} onCerrar={() => setEditando(false)} onGuardar={(actualizada) => { setBorrador(actualizada); setGuardado(actualizada); }} />}
    <CardContent className={enModal?"px-0":undefined}><form onSubmit={(e) => { e.preventDefault(); void guardar(); }} className="space-y-6 [&_input[data-slot=input]]:border-border/50 [&_textarea]:border-border/50">
      {selectorSemana}
      {enModal?<EditorDia sesion={borrador} semana={semana} editable bloqueado={ocupado||sucio||Boolean(altaPendiente)} onSesion={setBorrador} onEjercicio={ejercicio} onAgregar={agregarEjercicio} onQuitar={setQuitar} />:<>      <fieldset className="min-w-0 space-y-8">
        <EntradaEnCalorEditor texto={borrador.calentamiento} ejercicios={borrador.activacion} onTexto={(calentamiento) => setBorrador((anterior) => ({ ...anterior, calentamiento }))} onEjercicios={(activacion) => setBorrador((anterior) => ({ ...anterior, activacion }))} />
        <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Entrenamiento</h3><div className="flex flex-wrap gap-2">
          {semana > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setBorrador((b) => ({ ...b, ejercicios: b.ejercicios.map((e) => ({ ...e, semanas: e.semanas.map((c) => c.semana === semana ? { ...c, prescripcion: c.prescripcion.trim() ? c.prescripcion : prescripcionEfectiva(e.semanas, semana - 1) } : c) })) }))}>Completar vacíos de S{semana} con S{semana - 1}</Button>}
          </div></div>
          <EditorEjerciciosPlan maxColumnas={enModal?4:undefined} ejercicios={borrador.ejercicios} bloques={borrador.bloques} tipo={borrador.tipo} semana={semana} semanasVisibles={semanasVisibles} ocupado={ocupado || Boolean(altaPendiente)} altaPendiente={Boolean(altaPendiente)} sucio={sucio} onCambiar={ejercicio} onCrearBloque={crearBloque} onQuitarBloque={(grupo) => setBorrador((anterior) => ({ ...anterior, bloques: anterior.bloques.filter((g) => g !== grupo) }))} onAgregar={agregarEjercicio} onQuitar={setQuitar} />
        </div>
        <label className="block space-y-2 text-sm font-medium">Vuelta a la calma<Textarea className="min-h-20 font-normal" maxLength={4000} value={borrador.enfriamiento} onChange={(e) => setBorrador({ ...borrador, enfriamiento: e.target.value })} placeholder="Estiramientos, movilidad suave…" /></label>
      </fieldset></>}
      {error && <p role="alert" className="text-sm text-destructive">{error} Los cambios sin guardar siguen en el formulario.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className={enModal&&!sucio&&!error?"sr-only":"text-xs text-muted-foreground"}>{ocupado ? "Guardando…" : error ? "No se pudieron guardar los cambios" : sucio ? "Cambios pendientes…" : "Guardado automáticamente"}</p>{error && <Button type="submit" disabled={ocupado}>Reintentar guardado</Button>}</div>
    </form>{!modelo && <div className="mt-6"><SeguimientoSesion key={`${sesion.id}:${semana}`} sesionId={sesion.id} semana={semana} lectura compacto={enModal} /></div>}</CardContent>
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
  const sinCargaRunning=(fecha:string,numero:number)=>planes.some(p=>{const semana=semanaDelPlan(p.inicio,fecha,p.semanas);return semana!==null&&actividadesDelDia(p,numero,semana).some(a=>a.tipo==="Running"&&!a.sesionId)&&!textoDiaRunning(p.running?.[semana],(["lunes","martes","miercoles","jueves","viernes","sabado","domingo"] as const)[numero-1]).trim();});
  const entradas = (dia: string, numero: number) => planes.flatMap((plan) => {
    const semana = semanaDelPlan(plan.inicio, dia, plan.semanas);
    if(!semana)return [];
    const asignadas=actividadesDelDia(plan,numero,semana);
    const anteriores=plan.sesiones.filter(s=>asignadas.some(a=>a.sesionId===s.id)&&mostrarAnterior(plan,s)&&(filtro===null||s.tipo===filtro)).map(sesion=>({plan,sesion,semana}));
    const texto=textoRunningPlanificado(plan,numero,semana);
    if(texto?.trim()&&asignadas.some(a=>!a.sesionId&&["Running","GYM","Descanso"].includes(a.tipo))&&(filtro===null||filtro==="Running"))anteriores.push({plan,semana,sesion:{id:"running:"+plan.id+":"+numero,nombre:texto,tipo:"Running",dia:numero,orden:0,franja:"Sin definir",calentamiento:"",enfriamiento:"",activacion:[],bloques:[],ejercicios:[]}});
    return anteriores;
  });
  const sinAsignacion=(numero:number)=>planes.some(p=>{const s=semanaDelPlan(p.inicio,fecha,p.semanas);return s!==null&&Object.keys(p.distribucion??{}).length>0&&actividadesDelDia(p,numero,s).length===0;});
  const numeroDia = (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7 + 1;
  const seleccionadas = entradas(fecha, numeroDia);
  const sinAsignar = planes.flatMap((plan) => {
    const semana = semanaDelPlan(plan.inicio, fecha, plan.semanas);
    return semana&&!Object.keys(plan.distribucion??{}).length ? plan.sesiones.filter((s) => !diasDeSesion(s).length && mostrarAnterior(plan,s) && (filtro === null || s.tipo === filtro)).map((sesion) => ({ plan, sesion, semana })) : [];
  });
  return <div className="min-w-0 space-y-6">
    <div className="flex flex-wrap items-center justify-center gap-2"><Button size="icon-sm" variant="outline" aria-label="Semana anterior" disabled={lunes <= "2000-01-08"} onClick={() => navegar(() => setFecha((anterior) => desplazarDia(anterior, -7)))}><ArrowLeft /></Button><p className="text-sm font-medium">{formatFecha(lunes)} al {formatFecha(desplazarDia(lunes, 6), { conAnio: true })}</p><Button size="icon-sm" variant="outline" aria-label="Semana siguiente" disabled={fecha >= "2100-12-20"} onClick={() => navegar(() => setFecha((anterior) => desplazarDia(anterior, 7)))}><ArrowRight /></Button><Button size="sm" variant="ghost" onClick={() => navegar(() => setFecha(hoyISO()))}>Hoy</Button></div>
    <div role="group" aria-label="Filtrar actividades" className="flex flex-wrap justify-center gap-2">{[null, ...tipos].map((tipo) => <Button key={tipo === null ? "todos" : `actividad:${tipo}`} size="sm" variant={filtro === tipo ? "secondary" : "outline"} aria-pressed={filtro === tipo} className="max-w-full whitespace-normal break-words" onClick={() => navegar(() => setFiltro(tipo))}>{tipo ?? "Todos"}</Button>)}</div>
    <div role="group" aria-label="Días de la semana" className="flex min-w-0 flex-wrap justify-center gap-2">{dias.map((dia) => {
      const delDia = entradas(dia.fecha, dia.numero);
      const seleccionada = fecha === dia.fecha;
      return <Button key={dia.fecha} variant="ghost" aria-label={dia.nombre} aria-pressed={seleccionada} onClick={() => navegar(() => setFecha(dia.fecha))} className={`h-auto min-h-20 min-w-0 basis-[calc((100%-1.5rem)/4)] flex-col justify-start gap-2 self-stretch whitespace-normal rounded-xl border px-1.5 py-3 sm:basis-[calc((100%-3rem)/7)] ${seleccionada ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-transparent bg-muted/40"}`}><span className="text-sm font-semibold">{dia.nombre.slice(0, 3)} {Number(dia.fecha.slice(8))}</span><span className="flex w-full flex-col gap-2 text-xs text-muted-foreground">{delDia.length ? delDia.map(({plan, sesion}) => <span key={sesion.id} className="break-words">{sesion.tipo}<span className="block font-semibold text-foreground">{sesion.id.startsWith("running:")?"Planilla": "Día "+(plan.sesiones.filter((s) => s.tipo === sesion.tipo).findIndex((s) => s.id === sesion.id) + 1)}</span></span>) : (filtro===null||filtro==="Running")&&sinCargaRunning(dia.fecha,dia.numero)?"Sin cargar":sinAsignacion(dia.numero)?"Sin asignar":"Descanso"}</span></Button>;
    })}</div>
    <section className="space-y-5"><h3 className="text-lg font-semibold">{fecha === hoyISO() ? "Hoy te toca" : formatFecha(fecha, { conAnio: true })}</h3>{seleccionadas.length ? seleccionadas.map(({ plan, sesion, semana }) => <div key={sesion.id} className="space-y-2"><p className="break-words text-sm text-muted-foreground">{plan.nombre} · Semana {semana} de {plan.semanas}</p>{sesion.id.startsWith("running:")?<div className="rounded-xl border bg-card p-5"><h4 className="font-semibold">{["GYM","Descanso"].includes(sesion.nombre)?"Día sin running":"Running"}</h4><p className="mt-3 whitespace-pre-wrap break-words leading-7">{sesion.nombre}</p></div>:<LecturaSesion sesion={sesion} semana={semana} />}</div>) : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No hay entrenamientos asignados para este día{filtro === null ? "." : ` de ${filtro.toLowerCase()}.`}</p>}</section>
    {sinAsignar.length > 0 && <section className="space-y-5"><h3 className="font-semibold">Entrenamientos sin día asignado</h3>{sinAsignar.map(({ plan, sesion, semana }) => <div key={sesion.id} className="space-y-2"><p className="break-words text-sm text-muted-foreground">{plan.nombre} · Semana {semana} de {plan.semanas}</p><LecturaSesion sesion={sesion} semana={semana} /></div>)}</section>}
    {(filtro===null||filtro==="Running")&&planes.filter(p=>Object.keys(p.running??{}).length>0&&semanaDelPlan(p.inicio,fecha,p.semanas)!==null).map(p=><RunningSemanal key={p.id+":"+fecha} plan={p} semanaInicial={semanaDelPlan(p.inicio,fecha,p.semanas)??1} />)}
    <section className="space-y-3 border-t pt-5"><h3 className="text-sm font-semibold">Tus planes activos</h3>{planes.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm"><p className="min-w-0 break-words font-medium">{p.nombre}</p><p className="text-muted-foreground">{formatFecha(p.inicio)} · {p.semanas} semanas · {semanaDelPlan(p.inicio, fecha, p.semanas) ? `Semana ${semanaDelPlan(p.inicio, fecha, p.semanas)}` : fecha < p.inicio ? "Todavía no empezó" : "Finalizado"}</p></div>)}</section>
  </div>;
}

export function RutinaPlanModal({plan,sesion,editable,semanaInicial,onCerrar}:{plan:Pick<PlanMensual,"sesiones"|"semanas">&{inicio?:string};sesion:SesionEntrenamiento;editable:boolean;semanaInicial:number;onCerrar:()=>void}) {
 const [semana,setSemana]=useState(()=>plan.inicio?(semanaDelPlan(plan.inicio,hoyISO(),plan.semanas)??semanaInicial):semanaInicial);
 const numero=plan.sesiones.filter(s=>s.tipo===sesion.tipo).findIndex(s=>s.id===sesion.id)+1;
 const cerrar=()=>{if(!hayBorradoresMensuales(sesion.id))onCerrar();};
 return <Dialog open onOpenChange={v=>!v&&cerrar()}><DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-5 overflow-y-auto sm:max-w-[1080px]">
  <DialogHeader className={editable?"sr-only":"border-b pb-3 text-center"}><DialogTitle>{sesion.nombre||`${sesion.tipo} – Día ${numero}`}</DialogTitle><DialogDescription className="sr-only">Día de entrenamiento</DialogDescription></DialogHeader>

  {editable?<FormularioSesion key={sesion.id} enModal sesion={sesion} numeroDia={numero} semana={semana} semanasVisibles={[semana]} totalSemanas={plan.semanas} selectorSemana={<div role="group" aria-label="Semanas del día" className="mx-auto flex w-fit max-w-full overflow-x-auto justify-start gap-1 rounded-xl border p-1">{semanasDelPlan(plan.semanas).map(s=><Button key={s} size="sm" variant={s===semana?"default":"ghost"} aria-pressed={s===semana} onClick={()=>navegar(()=>setSemana(s))}>Semana {s}</Button>)}</div>} onDuplicar={()=>{}} />:<><div role="group" aria-label="Semanas del día" className="mx-auto flex max-w-full overflow-x-auto justify-start gap-1 rounded-xl border p-1">{semanasDelPlan(plan.semanas).map(s=><Button key={s} size="sm" variant={s===semana?"default":"ghost"} aria-pressed={s===semana} onClick={()=>navegar(()=>setSemana(s))}>Semana {s}</Button>)}</div><EditorDia sesion={sesion} semana={semana} editable={false} /><SeguimientoSesion key={`${sesion.id}:${semana}`} sesionId={sesion.id} semana={semana} compacto /></>}
 </DialogContent></Dialog>;
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
