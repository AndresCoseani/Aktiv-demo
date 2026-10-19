"use client";

import {
  CalendarioCarreras,
  CarrerasCatalogo,
  CarrerasDeAlumno,
} from "@/components/carreras-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";

export default function CarrerasPage() {
  const { session, alumnos } = useStore();
  if (!session) return null;

  const esProfe = session.role === "coach";
  const alumno = alumnos.find((a) => a.id === session.alumnoId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Carreras</h1>
        {!esProfe && (
          <p className="mt-1 text-sm text-muted-foreground">
            Las carreras en las que estás anotado y el calendario del club.
          </p>
        )}
      </header>

      {esProfe ? (
        <CarrerasCatalogo />
      ) : alumno ? (
        <Tabs defaultValue="mias" className="gap-4">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="mias" className="sm:px-4">
              Mis carreras
            </TabsTrigger>
            <TabsTrigger value="calendario" className="sm:px-4">
              Calendario
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mias">
            <CarrerasDeAlumno alumno={alumno} puedeAsignar propia />
          </TabsContent>
          <TabsContent value="calendario">
            <CalendarioCarreras alumnoId={alumno.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          Tu cuenta todavía no está asociada a un alumno. Hablá con tu profe.
        </p>
      )}
    </div>
  );
}
