/** yyyy-mm-dd en hora local (no UTC): la fecha que ve el usuario */
export function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Fecha de negocio de Aktiv, independiente de la zona del servidor/dispositivo. */
export function hoyISO(ahora = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(ahora);
}

/** yyyy-mm-dd de hoy en Argentina más (o menos) n días de calendario. */
export function sumarDiasISO(n: number) {
  const d = new Date(`${hoyISO()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
