"use client";

import { AlumnosTable } from "@/components/alumnos-table";
import { SolicitudesAlta } from "@/components/solicitudes-alta";
import { NuevoAlumnoDialog } from "@/components/nuevo-alumno-dialog";
import { ImportarAlumnosDialog } from "@/components/importar-alumnos-dialog";
import { useRol } from "@/lib/guards";
import { useStore } from "@/lib/store";

export default function AlumnosPage() {
  const session = useRol("coach");
  const { alumnos } = useStore();

  if (!session) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Alumnos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tocá un alumno para ver su detalle y sus planes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2"><ImportarAlumnosDialog /><NuevoAlumnoDialog /></div>
      </header>
      <SolicitudesAlta />
      <AlumnosTable alumnos={alumnos} />
    </div>
  );
}
