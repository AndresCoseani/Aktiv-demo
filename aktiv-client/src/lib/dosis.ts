/** La prescripción anterior sigue siendo la fuente de verdad; no se descartan textos libres. */
export function separarDosis(texto: string) {
  const partes = texto.match(/^\s*(\d+(?:\s*[-–/]\s*\d*)?)\s*[xX×]\s*([\s\S]*)$/);
  return partes ? { series: partes[1], repeticiones: partes[2] } : { series: "", repeticiones: texto };
}

export function unirDosis(series: string, repeticiones: string) {
  return series ? `${series}×${repeticiones}` : repeticiones;
}

export function separarIndicacion(texto: string) {
  const partes = texto.match(/^([\s\S]*) · Descanso: ([\s\S]*)$/);
  return { ...separarDosis(partes ? partes[1] : texto), descanso: partes?.[2] ?? "" };
}

export function unirIndicacion(series: string, repeticiones: string, descanso: string) {
  const dosis = unirDosis(series, repeticiones);
  return descanso ? `${dosis} · Descanso: ${descanso}` : dosis;
}
