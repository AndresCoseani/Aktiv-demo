import { hoyISO, toISO } from "@aktiv/contrato";

export { hoyISO, toISO };

const MS_DIA = 86_400_000;

/** yyyy-mm-dd → Date a medianoche local (evita el corrimiento por zona horaria) */
export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function sumarDias(dias: number, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + dias);
  return toISO(d);
}

/**
 * Suma meses de calendario a una fecha (yyyy-mm-dd): del 19 de octubre al 19 de
 * noviembre. Si el mes siguiente no tiene ese día, queda el último (31 de enero → 28 de febrero).
 */
export function sumarMeses(meses: number, base = new Date()) {
  const dia = base.getDate();
  const d = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
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

/** edad en años cumplidos a hoy */
export function edadDesde(iso: string) {
  const nac = parseISO(iso);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const aunNoCumplio =
    hoy.getMonth() < nac.getMonth() ||
    (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate());
  if (aunNoCumplio) edad -= 1;
  return edad;
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

/** UUID generado en el cliente: sirve igual en la demo y como clave en Supabase */
export function nuevoId() {
  return crypto.randomUUID();
}

/* ───────────── Tiempos de carrera ───────────── */

/** "45:30" o "1:45:30" → segundos. Devuelve null si no se entiende. */
export function parseTiempo(texto: string): number | null {
  const partes = texto.trim().split(":");
  if (partes.length < 2 || partes.length > 3) return null;
  if (!partes.every((p) => /^\d{1,2}$/.test(p))) return null;
  const [h, m, s] = partes.length === 3 ? partes.map(Number) : [0, ...partes.map(Number)];
  if (m > 59 || s > 59) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/** segundos → "mm:ss" o "h:mm:ss" */
export function formatTiempo(seg: number) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.round(seg % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** ritmo medio en min/km, por ejemplo "4:45" */
export function formatRitmo(seg: number, km: number) {
  if (!km) return "—";
  const porKm = seg / km;
  const m = Math.floor(porKm / 60);
  const s = Math.round(porKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}
