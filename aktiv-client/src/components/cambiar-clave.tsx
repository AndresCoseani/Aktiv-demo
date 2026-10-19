"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorHttp } from "@/lib/api";
import { cambiarClaveApi, validar } from "@/lib/schemas";
import { cambiarClave } from "@/lib/store";

/** Cambiar la propia contraseña (profe o alumno). Pide la actual y una nueva de 8+ caracteres. */
export function CambiarClaveDialog({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="sm:max-w-sm">{abierto && <Formulario onCerrar={onCerrar} />}</DialogContent>
    </Dialog>
  );
}

function Formulario({ onCerrar }: { onCerrar: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = validar(cambiarClaveApi, { claveActual: actual, claveNueva: nueva });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (nueva !== repetida) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setGuardando(true);
    try {
      await cambiarClave(actual, nueva);
      toast.success("Cambiaste tu contraseña");
      onCerrar();
    } catch (err) {
      setError(err instanceof ErrorHttp ? err.message : "No se pudo cambiar la contraseña. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const campo = (id: string, etiqueta: string, valor: string, set: (v: string) => void, auto: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        type="password"
        value={valor}
        onChange={(e) => {
          set(e.target.value);
          setError("");
        }}
        autoComplete={auto}
        required
      />
    </div>
  );

  return (
    <form onSubmit={enviar} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Cambiar contraseña</DialogTitle>
        <DialogDescription>La nueva tiene que tener al menos 8 caracteres.</DialogDescription>
      </DialogHeader>
      {campo("clave-actual", "Contraseña actual", actual, setActual, "current-password")}
      {campo("clave-nueva-menu", "Contraseña nueva", nueva, setNueva, "new-password")}
      {campo("clave-repetida-menu", "Repetí la contraseña nueva", repetida, setRepetida, "new-password")}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Cambiar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
