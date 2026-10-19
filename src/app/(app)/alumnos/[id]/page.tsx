"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Banknote, Mail, Phone, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { CarrerasDeAlumno } from "@/components/carreras-view";
import { EstadoBadge, PagoTexto } from "@/components/estado";
import { FichaMedica } from "@/components/ficha-medica";
import { MarcasPanel } from "@/components/marcas-panel";
import { NotasCard } from "@/components/notas-card";
import { PlanEditor } from "@/components/plan-editor";
import { SemanaCard } from "@/components/semana-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  sumarDias,
} from "@/lib/format";
import { useRol } from "@/lib/guards";
import { actualizarAlumno, alternarDia, useStore } from "@/lib/store";

export default function AlumnoDetallePage() {
  const session = useRol("coach");
  const { id } = useParams<{ id: string }>();
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
      // al reactivar, si no tenía pago programado le armamos uno a 30 días
      proximoPago:
        activo && !alumno.proximoPago ? sumarDias(30) : alumno.proximoPago,
    });
    toast.success(activo ? "Alumno activado" : "Alumno marcado como inactivo");
  }

  function registrarPago() {
    if (!alumno) return;
    const base =
      alumno.proximoPago && diasHasta(alumno.proximoPago) >= 0
        ? parseISO(alumno.proximoPago)
        : new Date();
    const siguiente = sumarDias(30, base);
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
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/alumnos"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Alumnos
        </Link>

        <header className="flex items-center gap-4">
          <Avatar size="lg" className="size-14">
            <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
              {iniciales(alumno.nombre)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {alumno.nombre}
            </h1>
            <p className="text-sm text-muted-foreground">
              {alumno.objetivo} · {alumno.nivel} · Alumno desde{" "}
              {formatFecha(alumno.altaEn, { conAnio: true })}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {alumno.email || "Sin email"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {alumno.telefono || "Sin teléfono"}
              </span>
            </p>
          </div>
        </header>
      </div>

      <Tabs defaultValue="resumen" className="gap-6">
        <TabsList className="h-9 w-full sm:w-fit">
          <TabsTrigger value="resumen" className="sm:px-4">
            Resumen
          </TabsTrigger>
          <TabsTrigger value="ficha" className="sm:px-4">
            Ficha médica
            {avisoCertificado && (
              <span
                aria-label={textoAviso}
                title={textoAviso}
                className={
                  avisoCertificado === "vencido" || avisoCertificado === "sin-certificado"
                    ? "size-1.5 rounded-full bg-destructive"
                    : "size-1.5 rounded-full bg-warning"
                }
              />
            )}
          </TabsTrigger>
          <TabsTrigger value="marcas" className="sm:px-4">
            Marcas
          </TabsTrigger>
          <TabsTrigger value="carreras" className="sm:px-4">
            Carreras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
      <section aria-label="Estado y pago" className="grid gap-3 sm:grid-cols-2">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardDescription>Estado</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3">
              <EstadoBadge activo={alumno.activo} className="px-2.5 py-3 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="estado-switch" className="text-sm text-muted-foreground">
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

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardDescription>Próximo pago</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
            <PagoTexto
              fecha={alumno.proximoPago}
              className="text-lg [&>div:last-child]:text-sm"
            />
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="Fecha del próximo pago"
                value={alumno.proximoPago ?? ""}
                min={hoyISO()}
                onChange={(e) =>
                  actualizarAlumno(alumno.id, { proximoPago: e.target.value || null })
                }
                className="w-40"
              />
              <Button variant="outline" onClick={registrarPago}>
                <Banknote data-icon="inline-start" />
                Registrar pago
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <SemanaCard
        semana={alumno.semana}
        onAlternar={(dia, tipo) => alternarDia(alumno.id, dia, tipo)}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <NotasCard
          className="order-last lg:order-first"
          titulo="Lesiones o apuntes"
          descripcion="Solo lo ves vos. Lesiones, molestias, observaciones."
          placeholder="Ej: molestia en la rodilla derecha, evitar cuestas…"
          value={alumno.notasProfe}
          onChange={(notasProfe) => actualizarAlumno(alumno.id, { notasProfe })}
        />
        <PlanEditor alumno={alumno} />
      </div>
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
    </div>
  );
}
