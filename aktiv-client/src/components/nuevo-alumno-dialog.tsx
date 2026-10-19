"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIMITES, crearAlumnoDto, validar } from "@/lib/schemas";
import { ErrorHttp } from "@/lib/api";
import { crearAlumno, invitarAlumno } from "@/lib/store";
import type { Nivel } from "@/lib/types";

const NIVELES: Nivel[] = ["Principiante", "Intermedio", "Avanzado"];

export function NuevoAlumnoDialog() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nivel, setNivel] = useState<Nivel>("Principiante");
  const [error, setError] = useState("");
  const [invitar, setInvitar] = useState(true);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = validar(crearAlumnoDto, {
      nombre: String(f.get("nombre")).trim(),
      email: String(f.get("email")).trim(),
      telefono: String(f.get("telefono")).trim(),
      objetivo: String(f.get("objetivo")).trim() || "Sin definir",
      nivel,
    });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (invitar && !v.datos.email) {
      setError("Para mandarle la invitación necesitamos su email");
      return;
    }
    const alumno = crearAlumno(v.datos);
    setError("");
    setAbierto(false);
    setNivel("Principiante");
    router.push(`/alumnos/${alumno.id}`);
    if (!invitar) {
      toast.success(`${alumno.nombre} se sumó al club`);
      return;
    }
    try {
      await invitarAlumno(alumno.id);
      toast.success(`${alumno.nombre} se sumó al club. Le mandamos el acceso a ${alumno.email}`);
    } catch (err) {
      toast.error(
        `${alumno.nombre} se creó, pero no pudimos mandarle la invitación${err instanceof ErrorHttp ? `: ${err.message}` : ""} Reintentá desde su ficha.`,
      );
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setError("");
          setAbierto(true);
        }}
      >
        <Plus data-icon="inline-start" />
        <span className="hidden sm:inline">Nuevo alumno</span>
        <span className="sm:hidden">Nuevo</span>
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={enviar} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nuevo alumno</DialogTitle>
              <DialogDescription>
                Cargá los datos básicos. Después le armás su plan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="n-nombre">Nombre completo</Label>
              <Input
                id="n-nombre"
                name="nombre"
                required
                maxLength={LIMITES.nombre}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="n-email">Email{invitar ? " *" : ""}</Label>
                <Input
                  id="n-email"
                  name="email"
                  type="email"
                  maxLength={LIMITES.email}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="n-tel">Teléfono</Label>
                <Input
                  id="n-tel"
                  name="telefono"
                  type="tel"
                  maxLength={LIMITES.telefono}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="n-objetivo">Objetivo</Label>
                <Input
                  id="n-objetivo"
                  name="objetivo"
                  placeholder="Ej: Primer 10K"
                  maxLength={LIMITES.objetivo}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>Nivel</Label>
                <Select
                  value={nivel}
                  onValueChange={(v) => v && setNivel(v as Nivel)}
                >
                  <SelectTrigger className="w-full" aria-label="Nivel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {NIVELES.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Checkbox
                id="n-invitar"
                checked={invitar}
                onCheckedChange={(v) => setInvitar(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="n-invitar" className="block cursor-pointer text-sm leading-snug font-normal">
                Mandarle una invitación por email
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Recibe un enlace para elegir su contraseña y ver su plan desde su celu.
                </span>
              </Label>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear alumno</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
