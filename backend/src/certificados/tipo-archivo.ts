import type { CERTIFICADO_TIPOS } from "@aktiv/contrato";

export type TipoCertificado = (typeof CERTIFICADO_TIPOS)[number];

/**
 * Detecta el tipo real del archivo por su contenido (firma de los primeros bytes).
 * No se confía en el Content-Type ni en la extensión: los manda el cliente.
 */
export function detectarTipo(b: Buffer): TipoCertificado | null {
  if (b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  return null;
}

