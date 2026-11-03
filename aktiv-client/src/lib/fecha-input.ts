import { fechaISO } from "@aktiv/contrato";

export function fechaParaMostrar(iso: string) {
  if (!iso) return "";
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function fechaDesdeTexto(texto: string): string | null {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!partes) return null;
  const iso = `${partes[3]}-${partes[2].padStart(2, "0")}-${partes[1].padStart(2, "0")}`;
  return fechaISO.safeParse(iso).success ? iso : null;
}

export function errorFechaTexto(texto: string, min?: string, max?: string) {
  if (!texto) return "";
  const iso = fechaDesdeTexto(texto);
  if (!iso) return "Ingresá una fecha válida con formato dd/mm/aaaa.";
  if (min && iso < min) return `La fecha debe ser desde el ${fechaParaMostrar(min)}.`;
  if (max && iso > max) return `La fecha debe ser hasta el ${fechaParaMostrar(max)}.`;
  return "";
}
