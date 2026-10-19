/** yyyy-mm-dd en hora local (no UTC): la fecha que ve el usuario */
export function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function hoyISO() {
  return toISO(new Date());
}

/** yyyy-mm-dd de hoy más (o menos) n días, en hora local */
export function sumarDiasISO(n: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0); // evita saltos por cambios de horario
  d.setDate(d.getDate() + n);
  return toISO(d);
}
