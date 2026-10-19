"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { CertificadoBadge } from "@/components/ficha-medica";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { estadoCertificado, type EstadoCertificado } from "@/lib/dominio";
import { diasHasta, formatFecha, iniciales } from "@/lib/format";
import { useRol } from "@/lib/guards";
import { urlCertificado, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** de lo más urgente a lo menos */
const PRIORIDAD: Record<EstadoCertificado, number> = {
  vencido: 0,
  "sin-certificado": 1,
  "por-vencer": 2,
  vigente: 3,
};

const FILTROS: Record<string, string> = {
  todos: "Todos los estados",
  atencion: "Requieren atención",
  vencido: "Vencidos",
  "sin-certificado": "Sin cargar",
  "por-vencer": "Por vencer",
  vigente: "Vigentes",
};

export default function CertificadosPage() {
  const session = useRol("coach");
  const { alumnos } = useStore();
  const [filtro, setFiltro] = useState("todos");
  const [inactivos, setInactivos] = useState(false);

  const filas = useMemo(
    () =>
      alumnos
        .filter((a) => inactivos || a.activo)
        .map((a) => ({ alumno: a, estado: estadoCertificado(a.ficha.certificado) }))
        .sort(
          (x, y) =>
            PRIORIDAD[x.estado] - PRIORIDAD[y.estado] ||
            x.alumno.nombre.localeCompare(y.alumno.nombre),
        ),
    [alumnos, inactivos],
  );

  const conteo = useMemo(() => {
    const c: Record<EstadoCertificado, number> = {
      vigente: 0,
      "por-vencer": 0,
      vencido: 0,
      "sin-certificado": 0,
    };
    for (const f of filas) c[f.estado] += 1;
    return c;
  }, [filas]);

  const visibles = filas.filter((f) =>
    filtro === "todos"
      ? true
      : filtro === "atencion"
        ? f.estado !== "vigente"
        : f.estado === filtro,
  );

  if (!session) return null;

  async function ver(alumnoId: string, nombre: string) {
    try {
      window.open(await urlCertificado(alumnoId), "_blank", "noopener");
    } catch {
      toast.error(`No se pudo abrir el certificado de ${nombre}`);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Certificados médicos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quién tiene el certificado vigente y a quién hay que pedírselo.
        </p>
      </header>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumen etiqueta="Vigentes" valor={conteo.vigente} color="text-success" />
        <Resumen etiqueta="Por vencer" valor={conteo["por-vencer"]} color="text-warning" />
        <Resumen etiqueta="Vencidos" valor={conteo.vencido} color="text-destructive" />
        <Resumen
          etiqueta="Sin cargar"
          valor={conteo["sin-certificado"]}
          color="text-muted-foreground"
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filtro} onValueChange={(v) => v && setFiltro(v)} items={FILTROS}>
          <SelectTrigger aria-label="Filtrar por estado" className="h-9 w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {Object.entries(FILTROS).map(([v, t]) => (
              <SelectItem key={v} value={v}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={inactivos}
            onChange={(e) => setInactivos(e.target.checked)}
            className="size-4 accent-primary"
          />
          Incluir alumnos inactivos
        </label>
      </div>

      {visibles.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visibles.map(({ alumno, estado }) => {
            const cert = alumno.ficha.certificado;
            const dias = cert?.vencimiento ? diasHasta(cert.vencimiento) : null;
            return (
              <li key={alumno.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <Avatar>
                  <AvatarFallback className="bg-secondary text-xs font-medium">
                    {iniciales(alumno.nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/alumnos/${alumno.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {alumno.nombre}
                  </Link>
                  <p
                    className={cn(
                      "text-xs",
                      estado === "vencido"
                        ? "text-destructive"
                        : estado === "por-vencer"
                          ? "text-warning"
                          : "text-muted-foreground",
                    )}
                  >
                    {!cert
                      ? "Todavía no cargó el certificado"
                      : !cert.vencimiento || dias === null
                        ? "Sin fecha de vencimiento"
                        : dias < 0
                          ? `Venció el ${formatFecha(cert.vencimiento, { conAnio: true })} (hace ${Math.abs(dias)} días)`
                          : `Vence el ${formatFecha(cert.vencimiento, { conAnio: true })} (en ${dias} días)`}
                  </p>
                {(alumno.ficha.contacto.nombre || alumno.ficha.contacto.telefono) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Contacto:{" "}
                    {[
                      alumno.ficha.contacto.nombre,
                      alumno.ficha.contacto.parentesco && `(${alumno.ficha.contacto.parentesco.toLowerCase()})`,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    {alumno.ficha.contacto.telefono && (
                      <>
                        {alumno.ficha.contacto.nombre ? " · " : ""}
                        <a
                          href={`tel:${alumno.ficha.contacto.telefono.replace(/[^\d+]/g, "")}`}
                          className="text-foreground/80 underline-offset-2 hover:underline"
                        >
                          {alumno.ficha.contacto.telefono}
                        </a>
                      </>
                    )}
                  </p>
                )}
                </div>
                <CertificadoBadge estado={estado} />
                {cert && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ver certificado de ${alumno.nombre}`}
                    onClick={() => ver(alumno.id, alumno.nombre)}
                  >
                    <ExternalLink />
                  </Button>
                )}
                <Link
                  href={`/alumnos/${alumno.id}`}
                  aria-label={`Abrir ficha de ${alumno.nombre}`}
                  className="hidden text-muted-foreground hover:text-foreground sm:block"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No hay alumnos en este estado.
        </p>
      )}
    </div>
  );
}

function Resumen({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: number;
  color: string;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
        <p className={cn("mt-1.5 text-3xl font-semibold tracking-tight tabular-nums", color)}>
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}
