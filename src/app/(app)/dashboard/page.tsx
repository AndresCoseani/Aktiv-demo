"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  CalendarClock,
  TriangleAlert,
  UserCheck,
  UserX,
} from "lucide-react";
import { EstadoBadge, PagoTexto } from "@/components/estado";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { diasHasta, estadoPago, formatFechaLarga, iniciales } from "@/lib/format";
import { useRol } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const session = useRol("coach");
  const { alumnos } = useStore();

  const m = useMemo(() => {
    const activos = alumnos.filter((a) => a.activo);
    return {
      total: alumnos.length,
      activos: activos.length,
      inactivos: alumnos.length - activos.length,
      proximos: activos.filter((a) => {
        const e = estadoPago(a.proximoPago);
        return e === "hoy" || e === "proximo";
      }).length,
      vencidos: activos.filter((a) => estadoPago(a.proximoPago) === "vencido")
        .length,
    };
  }, [alumnos]);

  const proximosPagos = useMemo(
    () =>
      alumnos
        .filter((a) => a.activo && a.proximoPago)
        .sort((a, b) => diasHasta(a.proximoPago!) - diasHasta(b.proximoPago!))
        .slice(0, 5),
    [alumnos],
  );

  const listado = useMemo(
    () =>
      [...alumnos].sort(
        (a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre),
      ),
    [alumnos],
  );

  if (!session) return null;

  const pctActivos = m.total ? Math.round((m.activos / m.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">{formatFechaLarga()}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Hola, Lucas!
        </h1>
      </header>

      <section
        aria-label="Métricas"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Metrica
          icon={UserCheck}
          label="Alumnos activos"
          value={m.activos}
          hint={`de ${m.total} en total`}
          destacada
        >
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pctActivos}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Porcentaje de alumnos activos"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${pctActivos}%` }}
            />
          </div>
        </Metrica>
        <Metrica
          icon={UserX}
          label="Inactivos"
          value={m.inactivos}
          hint="Pausados o dados de baja"
        />
        <Metrica
          icon={CalendarClock}
          label="Pagos próximos"
          value={m.proximos}
          hint="Dentro de 7 días"
        />
        <Metrica
          icon={TriangleAlert}
          label="Pagos vencidos"
          value={m.vencidos}
          hint="Requieren seguimiento"
          alerta={m.vencidos > 0}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Mis alumnos</CardTitle>
            <CardDescription>{m.total} alumnos en el club</CardDescription>
            <CardAction>
              <Link
                href="/alumnos"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Ver todos
                <ArrowRight data-icon="inline-end" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="px-2 sm:px-3">
            <ul className="max-h-[28rem] divide-y overflow-y-auto">
              {listado.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/alumnos/${a.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Avatar>
                      <AvatarFallback className="bg-secondary text-xs font-medium">
                        {iniciales(a.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.objetivo} · {a.nivel}
                      </p>
                    </div>
                    <PagoTexto
                      fecha={a.activo ? a.proximoPago : null}
                      className="hidden text-right text-sm sm:block"
                    />
                    <EstadoBadge activo={a.activo} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Próximos pagos</CardTitle>
            <CardDescription>Los más cercanos a vencer</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {proximosPagos.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/alumnos/${a.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {a.nombre}
                    </span>
                    <PagoTexto fecha={a.proximoPago} className="text-right text-sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metrica({
  icon: Icon,
  label,
  value,
  hint,
  destacada,
  alerta,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
  destacada?: boolean;
  alerta?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-4",
        destacada && "col-span-2 border-primary/30 bg-primary/[0.06] lg:col-span-1",
      )}
    >
      <CardContent className="px-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">{label}</span>
          <Icon
            className={cn(
              "size-4",
              destacada && "text-primary",
              alerta && "text-destructive",
            )}
          />
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        {children}
      </CardContent>
    </Card>
  );
}
