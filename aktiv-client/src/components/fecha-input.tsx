"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { errorFechaTexto, fechaDesdeTexto, fechaParaMostrar } from "@/lib/fecha-input";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "ref"> & {
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  onChange?: (evento: { target: { value: string } }) => void;
};

/** Texto siempre dd/mm/aaaa; formularios y callbacks siguen entregando yyyy-mm-dd. */
export function FechaInput({ value, defaultValue = "", onChange, name, className, min, max, disabled, readOnly, ...props }: Props) {
  const [estado, setEstado] = useState(() => ({ iso: value ?? defaultValue, texto: fechaParaMostrar(value ?? defaultValue) }));
  const [valorExterno, setValorExterno] = useState(value);
  const textoRef = useRef<HTMLInputElement>(null);
  const calendarioRef = useRef<HTMLInputElement>(null);
  if (value !== valorExterno) {
    setValorExterno(value);
    if (value !== undefined) setEstado({ iso: value, texto: fechaParaMostrar(value) });
  }
  const iso = value ?? estado.iso;
  const error = errorFechaTexto(estado.texto, min, max);
  useEffect(() => { textoRef.current?.setCustomValidity(error); }, [error]);

  function escribir(texto: string) {
    const fecha = texto === "" ? "" : fechaDesdeTexto(texto);
    const valida = fecha !== null && !errorFechaTexto(texto, min, max);
    setEstado((anterior) => ({ iso: valida ? fecha! : anterior.iso, texto }));
    if (valida) {
      if (value !== undefined) setValorExterno(fecha!);
      onChange?.({ target: { value: fecha! } });
    }
  }

  return <div className={cn("relative min-w-0", className)}>
    <Input
      {...props}
      ref={textoRef}
      type="text"
      lang="es-AR"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      autoComplete="off"
      maxLength={10}
      disabled={disabled}
      readOnly={readOnly}
      value={estado.texto}
      onChange={(e) => escribir(e.target.value)}
      onBlur={(e) => {
        if (!error && estado.texto && fechaDesdeTexto(estado.texto)) {
          setEstado((anterior) => ({ ...anterior, texto: fechaParaMostrar(fechaDesdeTexto(estado.texto)!) }));
        }
        props.onBlur?.(e);
      }}
      aria-invalid={error ? true : props["aria-invalid"]}
      className="h-full min-h-8 pr-9 tabular-nums"
    />
    {name && <input type="hidden" name={name} value={iso} disabled={disabled} form={props.form} />}
    <input
      ref={calendarioRef}
      type="date"
      lang="es-AR"
      tabIndex={-1}
      aria-hidden="true"
      className="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
      value={iso}
      min={min}
      max={max}
      disabled={disabled || readOnly}
      onChange={(e) => escribir(fechaParaMostrar(e.target.value))}
    />
    <button
      type="button"
      aria-label={`Abrir calendario${props["aria-label"] ? `: ${props["aria-label"]}` : ""}`}
      disabled={disabled || readOnly}
      className="absolute inset-y-0 right-0 grid w-8 place-items-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      onClick={() => {
        if (typeof calendarioRef.current?.showPicker === "function") {
          try { calendarioRef.current.showPicker(); } catch { textoRef.current?.focus(); }
        } else textoRef.current?.focus();
      }}
    ><CalendarDays className="size-3.5" /></button>
  </div>;
}
