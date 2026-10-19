const MS_DIA = 86_400_000;

/** yyyy-mm-dd → Date a medianoche local (evita el corrimiento por zona horaria) */
export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function hoyISO() {
  return toISO(new Date());
}

export function sumarDias(dias: number, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + dias);
  return toISO(d);
}

/** días que faltan hasta la fecha (negativo si ya pasó) */
export function diasHasta(iso: string) {
  const hoy = parseISO(hoyISO());
  return Math.round((parseISO(iso).getTime() - hoy.getTime()) / MS_DIA);
}

export function formatFecha(iso: string, opts?: { conAnio?: boolean }) {
  return parseISO(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    ...(opts?.conAnio ? { year: "numeric" } : {}),
  });
}

export function formatFechaLarga(date = new Date()) {
  const s = date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type EstadoPago = "vencido" | "hoy" | "proximo" | "al-dia" | "sin-pago";

export function estadoPago(iso: string | null): EstadoPago {
  if (!iso) return "sin-pago";
  const dias = diasHasta(iso);
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  if (dias <= 7) return "proximo";
  return "al-dia";
}

export function textoRelativo(iso: string) {
  const dias = diasHasta(iso);
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Mañana";
  if (dias === -1) return "Venció ayer";
  if (dias < 0) return `Venció hace ${Math.abs(dias)} días`;
  return `En ${dias} días`;
}

export function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** índice del día de hoy con lunes = 0 */
export function diaDeHoy() {
  return (new Date().getDay() + 6) % 7;
}

export function nuevoId() {
  return Math.random().toString(36).slice(2, 10);
}
