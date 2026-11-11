"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Banknote, Info, Mail, Phone, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { AccesoAlumno, EliminarAlumno } from "@/components/acceso-card";
import { CarrerasDeAlumno } from "@/components/carreras-view";
import { FichaMedica } from "@/components/ficha-medica";
import { MarcasPanel } from "@/components/marcas-panel";
import { AlumnoResumen } from "@/components/alumno-resumen";
import { PlanEditor } from "@/components/plan-editor";
import { PlanMensualPanel } from "@/components/plan-mensual";
import { usePlanesMensuales, hayBorradoresMensuales } from "@/lib/mensual";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FechaInput } from "@/components/fecha-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { estadoCertificado } from "@/lib/dominio";
import {
  diasHasta,
  formatFecha,
  hoyISO,
  iniciales,
  parseISO,
  sumarMeses,
  textoRelativo,
} from "@/lib/format";
import { useRol } from "@/lib/guards";
import { actualizarAlumno, cambiarEstadoAlumno, useStore } from "@/lib/store";

export default function AlumnoDetallePage() {
  const [tab, setTab] = useState("resumen");
  const [informacion,setInformacion]=useState(false);
  const [guardandoEstado,setGuardandoEstado]=useState(false);
  const session = useRol("coach");
  const { id } = useParams<{ id: string }>();
  const mensual = usePlanesMensuales(id);
  const { alumnos } = useStore();
  const alumno = alumnos.find((a) => a.id === id);

  if (!session) return null;

  if (!alumno) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <UserSearch className="size-10 text-muted-foreground/60" />
        <p className="font-medium">No encontramos a este alumno</p>
        <Link href="/alumnos" className={buttonVariants({ variant: "outline" })}>
          Volver a alumnos
        </Link>
      </div>
    );
  }

  async function cambiarEstado(activo: boolean) {
    if (!alumno || guardandoEstado) return;
    setGuardandoEstado(true);
    try {
      await cambiarEstadoAlumno(alumno.id, {activo, proximoPago:activo&&!alumno.proximoPago?sumarMeses(1):alumno.proximoPago});
      toast.success(activo?"Alumno activado":"Alumno desactivado. Su acceso queda bloqueado.");
    } catch(e) {toast.error(e instanceof Error?e.message:"No se pudo cambiar el estado. Reintentá.");}
    finally {setGuardandoEstado(false);}
  }

  function registrarPago() {
    if (!alumno) return;
    // si todavía no venció, el mes se cuenta desde esa fecha (pagar antes no regala días);
    // si ya venció o no había, desde hoy
    const base =
      alumno.proximoPago && diasHasta(alumno.proximoPago) >= 0
        ? parseISO(alumno.proximoPago)
        : parseISO(hoyISO());
    const siguiente = sumarMeses(1, base);
    actualizarAlumno(alumno.id, { proximoPago: siguiente });
    toast.success(`Pago registrado. Próximo: ${formatFecha(siguiente)}`);
  }

  const estadoCert = estadoCertificado(alumno.ficha.certificado);
  const avisoCertificado = estadoCert === "vigente" ? null : estadoCert;
  const textoAviso =
    estadoCert === "sin-certificado"
      ? "Sin certificado médico"
      : estadoCert === "vencido"
        ? "Certificado médico vencido"
        : "Certificado médico por vencer";

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-4">
        <Link
          href="/alumnos"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Alumnos
        </Link>

        <header className="flex min-w-0 flex-col gap-5 rounded-xl border border-border/70 bg-card/60 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-base font-medium text-primary">{iniciales(alumno.nombre)}</div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2"><h1 className="min-w-0 break-words text-2xl font-medium tracking-[-0.035em]">{alumno.nombre}</h1><Button variant="ghost" size="icon" aria-label="Información del alumno" title="Información y acceso" onClick={()=>setInformacion(true)}><Info className="size-[18px] text-muted-foreground" /></Button></div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{alumno.nivel}</span><span aria-hidden="true">·</span><span className={alumno.activo?"text-success":"text-destructive"}>{alumno.activo?"Activo":"Inactivo"}</span><Label htmlFor="estado-switch" className="sr-only">{alumno.activo?"Desactivar":"Activar"}</Label><Switch id="estado-switch" checked={alumno.activo} disabled={guardandoEstado} onCheckedChange={cambiarEstado} style={{backgroundColor:alumno.activo?"var(--success)":"var(--destructive)"}} />{guardandoEstado&&<span role="status">Guardando…</span>}</div>
            </div>
          </div>
          <section aria-label="Estado y pago" className="min-w-0 space-y-2 rounded-lg border border-border/60 px-4 py-3 lg:w-[33rem] lg:shrink-0">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs"><span className="text-muted-foreground">Próximo pago</span>{alumno.proximoPago?<><span className="font-medium tabular-nums">{formatFecha(alumno.proximoPago)}</span><span className="text-muted-foreground">({textoRelativo(alumno.proximoPago)})</span></>:<span className="text-muted-foreground">Sin fecha</span>}</p>
            <div className="flex min-w-0 flex-wrap items-center gap-3"><div className="grid min-w-0 flex-1 basis-64 grid-cols-[minmax(0,1fr)_minmax(8rem,1.15fr)] items-center gap-2"><Label htmlFor="proximo-vencimiento" className="min-w-0 break-words text-xs font-normal text-muted-foreground">Próximo vencimiento</Label><FechaInput id="proximo-vencimiento" value={alumno.proximoPago??""} min={hoyISO()} onChange={e=>actualizarAlumno(alumno.id,{proximoPago:e.target.value||null})} className="h-8 min-w-0 text-xs" /></div><Button variant="outline" size="sm" className="h-8 shrink-0" onClick={registrarPago}><Banknote />Registrar pago</Button></div>
          </section>
        </header>
        <Dialog open={informacion} onOpenChange={setInformacion}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Información del alumno</DialogTitle><DialogDescription>{alumno.nombre}</DialogDescription></DialogHeader><dl className="space-y-4 text-sm"><div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1 flex items-start gap-2 break-all"><Mail className="mt-1 size-4 shrink-0 text-muted-foreground" />{alumno.email||"Sin email"}</dd></div><div><dt className="text-xs text-muted-foreground">Teléfono</dt><dd className="mt-1 flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{alumno.telefono||"Sin teléfono"}</dd></div><div><dt className="text-xs text-muted-foreground">Alumno desde</dt><dd className="mt-1">{formatFecha(alumno.altaEn,{conAnio:true})}</dd></div>{alumno.objetivo&&<div><dt className="text-xs text-muted-foreground">Objetivo</dt><dd className="mt-1 break-words">{alumno.objetivo}</dd></div>}</dl><div className="border-t pt-3"><AccesoAlumno alumno={alumno} />{!alumno.activo&&<p className="mt-3 text-sm text-destructive">El alumno está inactivo y no puede iniciar sesión. Reactivalo desde el switch de la cabecera para habilitar su acceso.</p>}</div></DialogContent></Dialog>

      </div>

      <Tabs value={tab} onValueChange={(valor) => {
        if (hayBorradoresMensuales()) toast.error("Guardá la sesión antes de cambiar de pestaña.");
        else setTab(valor);
      }} className="min-w-0 gap-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:flex sm:h-9 sm:w-fit sm:group-data-horizontal/tabs:h-9">
          <TabsTrigger value="resumen" className="h-9 min-w-0 px-2 text-xs sm:h-full sm:px-4 sm:text-sm">Resumen</TabsTrigger>
          <TabsTrigger value="ficha" className="h-9 min-w-0 px-2 text-xs sm:h-full sm:px-4 sm:text-sm">
            Ficha médica
            {avisoCertificado && (
              <span
                aria-label={textoAviso}
                title={textoAviso}
                className={`size-1.5 rounded-full ${avisoCertificado === "por-vencer" ? "bg-warning" : "bg-destructive"}`}
              />
            )}
          </TabsTrigger>
          <TabsTrigger value="marcas" className="h-9 min-w-0 px-2 text-xs sm:h-full sm:px-4 sm:text-sm">Marcas</TabsTrigger>
          <TabsTrigger value="carreras" className="h-9 min-w-0 px-2 text-xs sm:h-full sm:px-4 sm:text-sm">Carreras</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6" id="planificacion-alumno">

      <PlanMensualPanel alumnoId={alumno.id} datosExternos={mensual} editable unificado>{alumno.planes.length > 0 && <PlanEditor alumno={alumno} />}</PlanMensualPanel>

        <AlumnoResumen alumno={alumno} mensual={mensual} onAbrir={(vista) => { if (vista === "plan") { setTab("resumen"); document.getElementById("planificacion-alumno")?.scrollIntoView({behavior:"smooth",block:"start"}); } else setTab(vista); }} />
        </TabsContent>

        <TabsContent value="ficha">
          <FichaMedica alumno={alumno} />
        </TabsContent>
        <TabsContent value="marcas">
          <MarcasPanel alumno={alumno} />
        </TabsContent>
        <TabsContent value="carreras">
          <CarrerasDeAlumno alumno={alumno} puedeAsignar />
        </TabsContent>
      </Tabs>

      <EliminarAlumno alumno={alumno} />
    </div>
  );
}
