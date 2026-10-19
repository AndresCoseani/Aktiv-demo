"use client";

import { MarcasPanel } from "@/components/marcas-panel";
import { useRol } from "@/lib/guards";
import { useStore } from "@/lib/store";

export default function MisMarcasPage() {
  const session = useRol("alumno");
  const { alumnos } = useStore();
  const alumno = alumnos.find((a) => a.id === session?.alumnoId);

  if (!session) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mis marcas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tus mejores tiempos por distancia, con el día y la carrera.
        </p>
      </header>
      {alumno ? (
        <MarcasPanel alumno={alumno} />
      ) : (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          Tu cuenta todavía no está asociada a un alumno. Hablá con tu profe.
        </p>
      )}
    </div>
  );
}
