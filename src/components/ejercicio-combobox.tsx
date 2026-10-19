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
import { EJERCICIOS_CATALOGO, categoriaDe } from "@/lib/data";
import { crearEjercicioPersonalizado, useStore } from "@/lib/store";

const BASE = EJERCICIOS_CATALOGO.map((e) => e.nombre);

export function EjercicioCombobox({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (nombre: string) => void;
  id?: string;
}) {
  const { ejerciciosCustom } = useStore();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const nombres = useMemo(
    () => [...BASE, ...ejerciciosCustom],
    [ejerciciosCustom],
  );

  const q = busqueda.trim().toLowerCase();
  const hayExacto = nombres.some((n) => n.toLowerCase() === q);
  const hayParciales = nombres.some((n) => n.toLowerCase().includes(q));
  const puedeCrear = q.length > 0 && !hayExacto;

  function crear() {
    const nombre = crearEjercicioPersonalizado(busqueda);
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
        onKeyDown={(e) => {
          // sin coincidencias, Enter crea el ejercicio
          if (e.key === "Enter" && puedeCrear && !hayParciales) {
            e.preventDefault();
            crear();
          }
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty>No se encontró el ejercicio.</ComboboxEmpty>
        <ComboboxList>
          {(nombre: string) => (
            <ComboboxItem key={nombre} value={nombre}>
              <span className="flex-1 truncate">{nombre}</span>
              <span className="text-xs text-muted-foreground">
                {categoriaDe(nombre)}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
        {puedeCrear && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={crear}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-primary outline-none hover:bg-accent focus-visible:bg-accent"
            >
              <Plus className="size-4 shrink-0" />
              <span className="truncate">
                Crear “<strong className="font-medium">{busqueda.trim()}</strong>”
              </span>
            </button>
          </div>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
