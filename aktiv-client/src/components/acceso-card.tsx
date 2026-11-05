"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Trash2 } from "lucide-react";
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
import { LIMITES, emailOpcional, validar } from "@/lib/schemas";
import { eliminarAlumno, entregarCredenciales } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Alumno } from "@/lib/types";
import { dniSchema, normalizarDni } from "@aktiv/contrato";

type EstadoAcceso = NonNullable<Alumno["acceso"]>["estado"];

const ESTADOS: Record<EstadoAcceso, { texto: string; clase: string }> = {
  sin_cuenta: { texto: "Sin acceso", clase: "bg-muted text-muted-foreground" },
  invitado: { texto: "Acceso pendiente", clase: "bg-warning/15 text-warning" },
  invitacion_vencida: { texto: "Acceso pendiente", clase: "bg-warning/15 text-warning" },
  activo: { texto: "Con acceso", clase: "bg-success/15 text-success" },
};

/** Acceso por email y DNI inicial, con cambio opcional de contraseña. */
export function AccesoAlumno({ alumno }: { alumno: Alumno }) {
  const acceso = alumno.acceso ?? { estado: "sin_cuenta" as const, expiraEn: null };
  const [credenciales, setCredenciales] = useState(false);
  const estado = ESTADOS[acceso.estado];
  return <>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Badge variant="outline" className={cn("gap-1.5 border-transparent px-2", estado.clase)}>
        <KeyRound className="size-3" />{estado.texto}
      </Badge>
      {acceso.estado !== "activo" && <span className="text-xs text-muted-foreground">Prepará su acceso con email y DNI como contraseña inicial.</span>}
      <Button size="sm" variant="outline" onClick={() => setCredenciales(true)}>
        <Copy data-icon="inline-start" />{acceso.estado === "activo" ? "Restablecer acceso" : "Preparar acceso con DNI"}
      </Button>
    </div>
    <Dialog open={credenciales} onOpenChange={setCredenciales}>
      <DialogContent className="sm:max-w-md">
        {credenciales && <CredencialesForm alumno={alumno} onClose={() => setCredenciales(false)} />}
      </DialogContent>
    </Dialog>
  </>;
}

/** Prepara email + DNI inicial y permite copiar el mensaje para el alumno. */
function CredencialesForm({ alumno, onClose }: { alumno: Alumno; onClose: () => void }) {
  const tieneCuenta = (alumno.acceso?.estado ?? "sin_cuenta") !== "sin_cuenta";
  const [email, setEmail] = useState(alumno.email);
  const [dni, setDni] = useState(alumno.dni);
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState("");
  const [generando, setGenerando] = useState(false);
  const [entregadas, setEntregadas] = useState<{ email: string; clave: string } | null>(null);

  async function generar() {
    const documento = normalizarDni(dni);
    if (!documento || !dniSchema.safeParse(documento).success) { setError("Escribí un DNI de 7 u 8 números, sin puntos."); return; }
    if (tieneCuenta && !confirmado) { setError("Confirmá que querés restablecer la contraseña actual."); return; }
    let destino: string | undefined;
    if (!tieneCuenta) {
      const v = validar(emailOpcional, email.trim());
      if (!v.ok || !v.datos) {
        setError(v.ok ? "Escribí el email del alumno" : v.error);
        return;
      }
      destino = v.datos;
    }
    setGenerando(true);
    setError("");
    try {
      setEntregadas(await entregarCredenciales(alumno.id, tieneCuenta, { dni: documento, ...(destino ? { email: destino } : {}) }));
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
      `Contraseña inicial (tu DNI sin puntos): ${entregadas.clave}`,
      "Podés cambiar tu contraseña desde Mi perfil → Cambiar contraseña.",
    ].join("\n");
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>Acceso de {alumno.nombre}</DialogTitle>
          <DialogDescription>
            Copiá el mensaje y mandáselo. La contraseña inicial es su DNI sin puntos. Si el alumno la cambia, no podremos consultar la nueva.
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
        <DialogTitle>{tieneCuenta ? "Restablecer acceso" : "Preparar acceso con DNI"}</DialogTitle>
        <DialogDescription>
          {tieneCuenta
            ? `La contraseña de ${alumno.nombre} pasará a ser su DNI. Los enlaces anteriores dejan de funcionar.`
            : `Se crea la cuenta de ${alumno.nombre} con su email y el DNI como contraseña inicial. Después copiás el mensaje para enviárselo.`}
        </DialogDescription>
      </DialogHeader>
      <label className="block space-y-2 text-sm">DNI del alumno<Input aria-label="DNI del alumno" value={dni} inputMode="numeric" maxLength={12} onChange={(e) => setDni(e.target.value)} placeholder="Sin puntos" /></label>
      {tieneCuenta && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-1 size-4 accent-primary" />Confirmo que quiero reemplazar su contraseña actual por el DNI.</label>}
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
          {generando ? "Preparando…" : tieneCuenta ? "Restablecer contraseña" : "Crear acceso"}
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
