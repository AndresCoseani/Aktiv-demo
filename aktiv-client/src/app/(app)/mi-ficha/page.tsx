"use client";

import { FichaMedica } from "@/components/ficha-medica";
import { useRol } from "@/lib/guards";
import { useStore } from "@/lib/store";

export default function MiFichaPage() {
  const session = useRol("alumno");
  const { alumnos } = useStore();
  const alumno = alumnos.find((a) => a.id === session?.alumnoId);

  if (!session) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mi ficha médica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mantenela al día: tu profe la usa para cuidarte y adaptar el entrenamiento.
        </p>
      </header>
      {alumno ? (
        <FichaMedica alumno={alumno} propia />
      ) : (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          Tu cuenta todavía no está asociada a un alumno. Hablá con tu profe.
        </p>
      )}
    </div>
  );
}
