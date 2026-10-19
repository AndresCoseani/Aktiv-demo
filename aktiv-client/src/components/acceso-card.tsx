"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
import { formatFecha } from "@/lib/format";
import { LIMITES, emailOpcional, validar } from "@/lib/schemas";
import { actualizarAlumno, eliminarAlumno, invitarAlumno } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Alumno } from "@/lib/types";

type EstadoAcceso = NonNullable<Alumno["acceso"]>["estado"];

const ESTADOS: Record<EstadoAcceso, { texto: string; clase: string }> = {
  sin_cuenta: { texto: "Sin acceso", clase: "bg-muted text-muted-foreground" },
  invitado: { texto: "Invitación enviada", clase: "bg-warning/15 text-warning" },
  invitacion_vencida: { texto: "Invitación vencida", clase: "bg-destructive/15 text-destructive" },
  activo: { texto: "Con acceso", clase: "bg-success/15 text-success" },
};

function mensajeDeError(e: unknown) {
  return e instanceof ErrorHttp ? e.message : "No se pudo enviar la invitación. Probá de nuevo.";
}

/** Acceso del alumno a su cuenta: estado y envío (o reenvío) de la invitación por email */
export function AccesoCard({ alumno }: { alumno: Alumno }) {
  const acceso = alumno.acceso ?? { estado: "sin_cuenta" as const, expiraEn: null };
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // con la cuenta ya creada el email es el de la cuenta: no se cambia desde acá
  const emailEditable = acceso.estado === "sin_cuenta";
  const yaInvitado = acceso.estado !== "sin_cuenta";
  const estado = ESTADOS[acceso.estado];

  function abrir() {
    setEmail(alumno.email);
    setError("");
    setAbierto(true);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    let destino = alumno.email;
    if (emailEditable) {
      const v = validar(emailOpcional, email.trim());
      if (!v.ok) {
        setError(v.error);
        return;
      }
      if (!v.datos) {
        setError("Escribí el email del alumno");
        return;
      }
      destino = v.datos;
      if (destino !== alumno.email) actualizarAlumno(alumno.id, { email: destino });
    }
    setEnviando(true);
    setError("");
    try {
      await invitarAlumno(alumno.id);
      setAbierto(false);
      toast.success(`Le mandamos el acceso a ${destino}`);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardDescription>Acceso a su cuenta</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
          <div className="space-y-1">
            <Badge variant="outline" className={cn("gap-1.5 border-transparent px-2.5 py-3 text-sm", estado.clase)}>
              <KeyRound className="size-3.5" />
              {estado.texto}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {acceso.estado === "sin_cuenta" && "Todavía no puede entrar a ver su plan."}
              {acceso.estado === "invitado" &&
                `Tiene hasta el ${formatFecha((acceso.expiraEn ?? "").slice(0, 10), { conAnio: true })} para elegir su contraseña.`}
              {acceso.estado === "invitacion_vencida" && "El enlace venció: mandale uno nuevo."}
              {acceso.estado === "activo" && "Entra con su email y su contraseña."}
            </p>
          </div>
          {acceso.estado !== "activo" && (
            <Button variant="outline" onClick={abrir}>
              <Send data-icon="inline-start" />
              {yaInvitado ? "Reenviar invitación" : "Invitar por email"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={enviar} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{yaInvitado ? "Reenviar invitación" : "Invitar a " + alumno.nombre}</DialogTitle>
              <DialogDescription>
                Le llega un mail con un enlace para elegir su contraseña y ver su plan. El enlace sirve una sola vez y
                vence en unos días.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email del alumno</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="inv-email"
                  type="email"
                  value={emailEditable ? email : alumno.email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  readOnly={!emailEditable}
                  maxLength={LIMITES.email}
                  autoComplete="off"
                  className="pl-8"
                  required
                />
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
              <Button type="submit" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar invitación"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Borra al alumno con todo lo suyo (y su cuenta de acceso, si la tiene), pidiendo confirmación */
export function EliminarAlumno({ alumno }: { alumno: Alumno }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const tieneCuenta = (alumno.acceso?.estado ?? "sin_cuenta") !== "sin_cuenta";

  function confirmar() {
    eliminarAlumno(alumno.id);
    setAbierto(false);
    toast.success(`${alumno.nombre} fue eliminado`);
    router.replace("/alumnos");
  }

  return (
    <>
      <div className="flex justify-end border-t pt-6">
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setAbierto(true)}>
          <Trash2 data-icon="inline-start" />
          Eliminar alumno
        </Button>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar a {alumno.nombre}?</DialogTitle>
            <DialogDescription>
              Se borran sus planes, marcas, ficha médica y certificado
              {tieneCuenta ? ", y también su cuenta: no va a poder volver a entrar" : ""}. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmar}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
