import type { EjercicioActivacion } from "@aktiv/contrato";

export function EntradaEnCalorLectura({ texto, ejercicios }: { texto: string; ejercicios: EjercicioActivacion[] }) {
  if (!texto && !ejercicios.length) return null;
  return <section className="space-y-4" aria-label="Entrada en calor">
    <h3 className="text-sm font-semibold">Entrada en calor</h3>
    {(["Movilidad", "Activación"] as const).map((fase) => {
      const lista = ejercicios.filter((e) => (e.fase ?? "Activación") === fase);
      return lista.length > 0 && <section key={fase} aria-label={fase} className="space-y-2">
        <h4 className="text-sm font-medium text-primary">{fase}</h4>
        <ol className="space-y-2 text-sm">{lista.map((e, indice) => <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="min-w-0 break-words font-medium">{indice + 1}. {e.nombre || "Ejercicio sin nombre"}</span>{e.indicacion && <span className="whitespace-pre-wrap break-words text-foreground">{e.indicacion}</span>}</li>)}</ol>
      </section>;
    })}
    {texto && <div className="space-y-1 border-t pt-3"><p className="text-xs text-muted-foreground">Indicaciones generales</p><p className="whitespace-pre-wrap break-words text-sm text-foreground">{texto}</p></div>}
  </section>;
}
