"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { CATEGORIAS, catalogoCompleto, categoriaDe } from "@/lib/dominio";
import { crearEjercicioPersonalizado, useStore } from "@/lib/store";
import type { CategoriaEjercicio } from "@/lib/types";

export function EjercicioCombobox({
  value,
  onChange,
  id,
  categorias,
}: {
  value: string;
  onChange: (nombre: string) => void;
  id?: string;
  /** si se indica, solo se ofrecen (y se pueden crear) ejercicios de estas categorías */
  categorias?: CategoriaEjercicio[];
}) {
  const { ejerciciosCustom } = useStore();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const todos = useMemo(
    () => catalogoCompleto(ejerciciosCustom).map((e) => e.nombre),
    [ejerciciosCustom],
  );
  const nombres = useMemo(() => {
    const lista = catalogoCompleto(ejerciciosCustom)
      .filter((e) => !categorias || categorias.includes(e.categoria))
      .map((e) => e.nombre);
    // lo que ya está elegido siempre se muestra, aunque sea de otra categoría
    return value && !lista.includes(value) ? [value, ...lista] : lista;
  }, [ejerciciosCustom, categorias, value]);

  const q = busqueda.trim().toLowerCase();
  const hayExacto = todos.some((n) => n.toLowerCase() === q);
  const puedeCrear = q.length > 0 && !hayExacto;

  function crear(categoria: CategoriaEjercicio) {
    const nombre = crearEjercicioPersonalizado(busqueda, categoria);
    onChange(nombre);
    setBusqueda(nombre);
    setAbierto(false);
  }

  return (
    <Combobox
      items={nombres}
      value={value || null}
      onValueChange={(v) => v && onChange(v)}
      open={abierto}
      onOpenChange={setAbierto}
      onInputValueChange={setBusqueda}
    >
      <ComboboxInput
        id={id}
        placeholder="Elegí o creá un ejercicio"
        aria-label="Ejercicio"
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>No se encontró el ejercicio.</ComboboxEmpty>
        <ComboboxList>
          {(nombre: string) => (
            <ComboboxItem key={nombre} value={nombre}>
              <span className="flex-1 truncate">{nombre}</span>
              <span className="text-xs text-muted-foreground">
                {categoriaDe(nombre, ejerciciosCustom)}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
        {puedeCrear && (
          <div className="space-y-1.5 border-t p-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Plus className="size-3.5 shrink-0" />
              <span className="truncate">
                Crear “<strong className="font-medium text-foreground">{busqueda.trim()}</strong>” en:
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(categorias ?? CATEGORIAS).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => crear(c)}
                  className="rounded-full border px-2.5 py-1 text-xs text-primary outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
