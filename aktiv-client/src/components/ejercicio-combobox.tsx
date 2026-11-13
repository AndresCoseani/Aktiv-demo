"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { claveEjercicio } from "@aktiv/contrato";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { catalogoCompleto, categoriaDe } from "@/lib/dominio";
import { CategoriaEjercicioSelector } from "./categoria-ejercicio-selector";
import { Button } from "./ui/button";
import { crearEjercicioPersonalizado, useStore } from "@/lib/store";
import type { CategoriaEjercicio } from "@/lib/types";

export function EjercicioCombobox({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (nombre: string) => void;
  id?: string;
  className?: string;
}) {
  const { ejerciciosCustom } = useStore();
  const [categoriaNueva, setCategoriaNueva] = useState("Fuerza");
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const todos = useMemo(
    () => catalogoCompleto(ejerciciosCustom).map((e) => e.nombre),
    [ejerciciosCustom],
  );
  const nombres = useMemo(() => {
    const lista = catalogoCompleto(ejerciciosCustom)
      .map((e) => e.nombre);
    // lo que ya está elegido siempre se muestra, aunque sea de otra categoría
    return value && !lista.some((n) => claveEjercicio(n) === claveEjercicio(value)) ? [value, ...lista] : lista;
  }, [ejerciciosCustom, value]);

  const q = claveEjercicio(busqueda);
  const hayExacto = todos.some((n) => claveEjercicio(n) === q);
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
      filter={(nombre, consulta) => claveEjercicio(nombre).includes(claveEjercicio(consulta))}
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
        className={`w-full ${className ?? ""}`}
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
            <CategoriaEjercicioSelector value={categoriaNueva} onChange={setCategoriaNueva} />
            <Button type="button" size="sm" onClick={() => crear(categoriaNueva)}>Crear ejercicio en {categoriaNueva}</Button>
          </div>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
