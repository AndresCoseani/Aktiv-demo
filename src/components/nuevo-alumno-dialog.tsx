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
import { crearAlumno } from "@/lib/store";
import type { Nivel } from "@/lib/types";

const NIVELES: Nivel[] = ["Principiante", "Intermedio", "Avanzado"];

export function NuevoAlumnoDialog() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nivel, setNivel] = useState<Nivel>("Principiante");
  const [error, setError] = useState("");

  function enviar(e: React.FormEvent<HTMLFormElement>) {
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
    const alumno = crearAlumno(v.datos);
    setError("");
    setAbierto(false);
    setNivel("Principiante");
    toast.success(`${alumno.nombre} se sumó al club`);
    router.push(`/alumnos/${alumno.id}`);
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
                Cargá los datos básicos. Después podés armarle sus planes.
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
                <Label htmlFor="n-email">Email</Label>
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
