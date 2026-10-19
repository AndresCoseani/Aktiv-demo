"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Mail, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { APP_URL } from "@/lib/config";
import { formatFecha } from "@/lib/format";
import { LIMITES, emailOpcional, validar } from "@/lib/schemas";
import { actualizarAlumno, eliminarAlumno, entregarCredenciales, invitarAlumno } from "@/lib/store";
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

/**
 * Acceso del alumno a su cuenta. Dos formas de dárselo: invitación por email (el alumno elige su
 * contraseña) o credenciales con contraseña aleatoria que el profe copia y le pasa (por WhatsApp).
 * Con la cuenta ya activa no se muestra nada.
 */
export function AccesoAlumno({ alumno }: { alumno: Alumno }) {
  const acceso = alumno.acceso ?? { estado: "sin_cuenta" as const, expiraEn: null };
  const [abierto, setAbierto] = useState(false);
  const [credenciales, setCredenciales] = useState(false);
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
      {acceso.estado !== "activo" && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <>
            <Badge variant="outline" className={cn("gap-1.5 border-transparent px-2", estado.clase)}>
              <KeyRound className="size-3" />
              {estado.texto}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {acceso.estado === "sin_cuenta" && "Todavía no puede entrar a ver su plan."}
              {acceso.estado === "invitado" &&
                `Tiene hasta el ${formatFecha((acceso.expiraEn ?? "").slice(0, 10), { conAnio: true })} para elegir su contraseña.`}
              {acceso.estado === "invitacion_vencida" && "El enlace venció: mandale uno nuevo."}
            </span>
            <Button size="sm" variant="outline" onClick={abrir}>
              <Send data-icon="inline-start" />
              {yaInvitado ? "Reenviar invitación" : "Invitar por email"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCredenciales(true)}>
              <Copy data-icon="inline-start" />
              Copiar credenciales
            </Button>
          </>
        </div>
      )}

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

      <Dialog open={credenciales} onOpenChange={setCredenciales}>
        <DialogContent className="sm:max-w-md">
          {credenciales && <CredencialesForm alumno={alumno} onClose={() => setCredenciales(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Genera la contraseña aleatoria, la muestra UNA vez y deja copiar un mensaje listo para WhatsApp */
function CredencialesForm({ alumno, onClose }: { alumno: Alumno; onClose: () => void }) {
  const tieneCuenta = (alumno.acceso?.estado ?? "sin_cuenta") !== "sin_cuenta";
  const [email, setEmail] = useState(alumno.email);
  const [error, setError] = useState("");
  const [generando, setGenerando] = useState(false);
  const [entregadas, setEntregadas] = useState<{ email: string; clave: string } | null>(null);

  async function generar() {
    if (!tieneCuenta) {
      const v = validar(emailOpcional, email.trim());
      if (!v.ok || !v.datos) {
        setError(v.ok ? "Escribí el email del alumno" : v.error);
        return;
      }
      if (v.datos !== alumno.email) actualizarAlumno(alumno.id, { email: v.datos });
    }
    setGenerando(true);
    setError("");
    try {
      setEntregadas(await entregarCredenciales(alumno.id));
    } catch (err) {
      setError(err instanceof ErrorHttp ? err.message : "No se pudieron generar las credenciales. Probá de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(aviso);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  if (entregadas) {
    const mensaje = [
      `Hola ${alumno.nombre.split(" ")[0]}! Ya tenés tu acceso a Aktiv 💪`,
      `Entrá en: ${APP_URL}`,
      `Email: ${entregadas.email}`,
      `Contraseña: ${entregadas.clave}`,
      "Podés cambiarla desde el menú de tu cuenta (arriba a la derecha).",
    ].join("\n");
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>Acceso de {alumno.nombre}</DialogTitle>
          <DialogDescription>
            Copiá el mensaje y mandáselo. <strong className="font-medium text-foreground">Por seguridad la contraseña no se vuelve a
            mostrar</strong>: si la perdés, generás una nueva.
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 truncate font-medium">{entregadas.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Contraseña</dt>
            <dd className="font-mono text-base font-semibold tracking-wide select-all">{entregadas.clave}</dd>
          </div>
        </dl>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Listo
          </Button>
          <Button onClick={() => copiar(mensaje, "Mensaje copiado. Pegalo en WhatsApp")}>
            <Copy data-icon="inline-start" />
            Copiar mensaje
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Copiar credenciales</DialogTitle>
        <DialogDescription>
          {tieneCuenta
            ? `Se genera una contraseña aleatoria para ${alumno.nombre} y la copiás para pasársela (sirve si el mail no llegó). El enlace de invitación anterior deja de funcionar.`
            : `Se crea la cuenta de ${alumno.nombre} con una contraseña aleatoria y la copiás para pasársela, sin mandar ningún mail.`}
        </DialogDescription>
      </DialogHeader>
      {!tieneCuenta && (
        <div className="space-y-2">
          <Label htmlFor="cred-email">Email del alumno</Label>
          <Input
            id="cred-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            maxLength={LIMITES.email}
            autoComplete="off"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={generar} disabled={generando}>
          {generando ? "Generando…" : "Generar credenciales"}
        </Button>
      </DialogFooter>
    </div>
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
