"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Banknote, Mail, Phone, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { AccesoAlumno, EliminarAlumno } from "@/components/acceso-card";
import { CarrerasDeAlumno } from "@/components/carreras-view";
import { EstadoBadge, PagoTexto } from "@/components/estado";
import { FichaMedica } from "@/components/ficha-medica";
import { MarcasPanel } from "@/components/marcas-panel";
import { AlumnoResumen } from "@/components/alumno-resumen";
import { PlanEditor } from "@/components/plan-editor";
import { PlanMensualPanel } from "@/components/plan-mensual";
import { usePlanesMensuales, hayBorradoresMensuales } from "@/lib/mensual";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
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
} from "@/lib/format";
import { useRol } from "@/lib/guards";
import { actualizarAlumno, useStore } from "@/lib/store";

export default function AlumnoDetallePage() {
  const [tab, setTab] = useState("resumen");
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

  function cambiarEstado(activo: boolean) {
    if (!alumno) return;
    actualizarAlumno(alumno.id, {
      activo,
      // al reactivar, si no tenía pago programado le armamos uno para dentro de un mes
      proximoPago:
        activo && !alumno.proximoPago ? sumarMeses(1) : alumno.proximoPago,
    });
    toast.success(activo ? "Alumno activado" : "Alumno marcado como inactivo");
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

        <header className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <Avatar size="lg" className="size-11 shrink-0 sm:size-14">
            <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
              {iniciales(alumno.nombre)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
              {alumno.nombre}
            </h1>
            <p className="text-sm text-muted-foreground">
              {alumno.objetivo} · {alumno.nivel} · Alumno desde{" "}
              {formatFecha(alumno.altaEn, { conAnio: true })}
            </p>
            <p className="mt-1 flex min-w-0 flex-col items-start gap-x-4 gap-y-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center">
              <span className="inline-flex min-w-0 max-w-full items-start gap-1.5">
                <Mail className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 break-all">{alumno.email || "Sin email"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" />
                {alumno.telefono || "Sin teléfono"}
              </span>
            </p>
            <AccesoAlumno alumno={alumno} />
          </div>
          </div>
      <section aria-label="Estado y pago" className="grid w-full gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] xl:w-[36rem] xl:shrink-0">
        <Card className="min-w-0 gap-2 py-3">
          <CardHeader className="px-4">
            <CardDescription>Estado</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 px-4">
            <div className="flex items-center gap-3">
              <EstadoBadge activo={alumno.activo} />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="estado-switch" className="sr-only">
                {alumno.activo ? "Desactivar" : "Activar"}
              </Label>
              <Switch
                id="estado-switch"
                checked={alumno.activo}
                onCheckedChange={cambiarEstado}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-2 py-3">
          <CardHeader className="px-4">
            <CardDescription>Próximo pago</CardDescription>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4">
            <PagoTexto
              fecha={alumno.proximoPago}
              className="text-sm"
            />
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
              <FechaInput
                aria-label="Fecha del próximo pago"
                value={alumno.proximoPago ?? ""}
                min={hoyISO()}
                onChange={(e) =>
                  actualizarAlumno(alumno.id, { proximoPago: e.target.value || null })
                }
                className="h-8 min-w-0 flex-1 basis-36 text-xs sm:w-36 sm:flex-none"
              />
              <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={registrarPago}>
                <Banknote data-icon="inline-start" />
                Registrar pago
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
        </header>
      </div>

      <Tabs value={tab} onValueChange={(valor) => {
        if (hayBorradoresMensuales()) toast.error("Guardá la sesión antes de cambiar de pestaña.");
        else setTab(valor);
      }} className="min-w-0 gap-6">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 group-data-horizontal/tabs:h-auto sm:flex sm:h-9 sm:w-fit sm:group-data-horizontal/tabs:h-9">
          <TabsTrigger value="resumen" className="h-9 min-w-0 px-2 text-xs sm:h-full sm:px-4 sm:text-sm">Resumen</TabsTrigger>
          <TabsTrigger value="plan" className="h-9 min-w-0 px-2 text-xs sm:h-full sm:px-4 sm:text-sm">Plan</TabsTrigger>
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

        <TabsContent value="resumen" className="space-y-6">

      <PlanMensualPanel alumnoId={alumno.id} datosExternos={mensual} editable unificado />

        <AlumnoResumen alumno={alumno} mensual={mensual} onAbrir={setTab} />
        </TabsContent>

        <TabsContent value="plan" className="min-w-0">
          <PlanMensualPanel alumnoId={alumno.id} datosExternos={mensual} editable>
            {alumno.planes.length > 0 ? <PlanEditor alumno={alumno} /> : (
              <p className="py-2 text-sm text-muted-foreground">No hay planes anteriores registrados.</p>
            )}
          </PlanMensualPanel>
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
