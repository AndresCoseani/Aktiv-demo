import { Badge } from "@/components/ui/badge";
import { estadoPago, formatFecha, textoRelativo, type EstadoPago } from "@/lib/format";
import { cn } from "@/lib/utils";

export function EstadoBadge({
  activo,
  className,
}: {
  activo: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border-transparent px-2",
        activo
          ? "bg-success/15 text-success"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          activo ? "bg-success" : "bg-muted-foreground/60",
        )}
      />
      {activo ? "Activo" : "Inactivo"}
    </Badge>
  );
}

export const COLOR_PAGO: Record<EstadoPago, string> = {
  vencido: "text-destructive",
  hoy: "text-warning",
  proximo: "text-warning",
  "al-dia": "text-muted-foreground",
  "sin-pago": "text-muted-foreground",
};

/** Fecha del próximo pago con su estado relativo debajo */
export function PagoTexto({
  fecha,
  className,
}: {
  fecha: string | null;
  className?: string;
}) {
  if (!fecha) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  const estado = estadoPago(fecha);
  return (
    <div className={cn("leading-tight", className)}>
      <div className="font-medium tabular-nums">{formatFecha(fecha)}</div>
      <div className={cn("text-xs", COLOR_PAGO[estado])}>
        {textoRelativo(fecha)}
      </div>
    </div>
  );
}
