"use client";

import { useRef, useState } from "react";
import {
  CircleCheck,
  ExternalLink,
  FileCheck2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { LIMITES, crearLesionDto, validar } from "@/lib/schemas";
import {
  CERTIFICADO_TIPOS,
  estadoCertificado,
  type EstadoCertificado,
} from "@/lib/dominio";
import {
  diasHasta,
  edadDesde,
  formatFecha,
  hoyISO,
  sumarDias,
} from "@/lib/format";
import {
  actualizarFicha,
  actualizarLesion,
  agregarLesion,
  quitarCertificado,
  quitarLesion,
  subirCertificado,
  urlCertificado,
} from "@/lib/store";
import type { Alumno, EstadoLesion, Lesion } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADOS_LESION = { activa: "Activa", recuperada: "Recuperada" };

function tamanoLegible(bytes: number) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * Ficha médica del alumno. La usan el profe (en el detalle del alumno)
 * y el propio alumno (en "Mi ficha"): los dos pueden completarla.
 */
export function FichaMedica({
  alumno,
  propia = false,
}: {
  alumno: Alumno;
  /** true cuando la ve el propio alumno */
  propia?: boolean;
}) {
  const { ficha } = alumno;
  const [lesionAbierta, setLesionAbierta] = useState<Lesion | "nueva" | null>(null);

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        {propia
          ? "Información médica confidencial: solo la ven vos y tu profe."
          : "Información médica confidencial: solo la ven vos y el alumno."}
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
            <CardDescription>Nacimiento y datos básicos de salud.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nacimiento">Fecha de nacimiento</Label>
                <Input
                  id="nacimiento"
                  type="date"
                  max={hoyISO()}
                  value={ficha.fechaNacimiento ?? ""}
                  onChange={(e) =>
                    actualizarFicha(alumno.id, {
                      fechaNacimiento: e.target.value || null,
                    })
                  }
                />
                {ficha.fechaNacimiento && (
                  <p className="text-xs text-muted-foreground">
                    {edadDesde(ficha.fechaNacimiento)} años
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lugar">Lugar de nacimiento</Label>
                <Input
                  id="lugar"
                  value={ficha.lugarNacimiento}
                  onChange={(e) =>
                    actualizarFicha(alumno.id, { lugarNacimiento: e.target.value })
                  }
                  placeholder="Ciudad, país"
                maxLength={LIMITES.lugar}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enfermedades">Enfermedades y condiciones</Label>
              <Textarea
                id="enfermedades"
                value={ficha.enfermedades}
                onChange={(e) =>
                  actualizarFicha(alumno.id, { enfermedades: e.target.value })
                }
                placeholder="Asma, hipertensión, diabetes, alergias, medicación… (o “Ninguna”)"
                maxLength={LIMITES.enfermedades}
                className="min-h-28 leading-relaxed"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <CertificadoCard alumno={alumno} />
          <ContactoCard alumno={alumno} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesiones</CardTitle>
          <CardDescription>
            Historial de lesiones y cómo vienen evolucionando.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ficha.lesiones.length ? (
            <ul className="divide-y rounded-xl border">
              {ficha.lesiones.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm leading-snug">{l.descripcion}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.fecha ? formatFecha(l.fecha, { conAnio: true }) : "Sin fecha"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 border-transparent",
                      l.estado === "activa"
                        ? "bg-warning/15 text-warning"
                        : "bg-success/15 text-success",
                    )}
                  >
                    {l.estado === "activa" ? "Activa" : "Recuperada"}
                  </Badge>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar lesión"
                      onClick={() => setLesionAbierta(l)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar lesión"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => quitarLesion(alumno.id, l.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              Sin lesiones registradas.
            </p>
          )}
          <Button variant="outline" onClick={() => setLesionAbierta("nueva")}>
            <Plus data-icon="inline-start" />
            Agregar lesión
          </Button>
        </CardContent>
      </Card>

      <LesionDialog
        alumnoId={alumno.id}
        lesion={lesionAbierta}
        onClose={() => setLesionAbierta(null)}
      />
    </div>
  );
}

/* ───────────── Certificado médico ───────────── */

const ESTILO_CERT: Record<
  EstadoCertificado,
  { texto: string; clase: string; icon: React.ComponentType<{ className?: string }> }
> = {
  vigente: { texto: "Vigente", clase: "bg-success/15 text-success", icon: CircleCheck },
  "por-vencer": { texto: "Por vencer", clase: "bg-warning/15 text-warning", icon: TriangleAlert },
  vencido: { texto: "Vencido", clase: "bg-destructive/15 text-destructive", icon: TriangleAlert },
  "sin-certificado": { texto: "Sin cargar", clase: "bg-muted text-muted-foreground", icon: FileCheck2 },
};

export function CertificadoBadge({ estado }: { estado: EstadoCertificado }) {
  const { texto, clase, icon: Icon } = ESTILO_CERT[estado];
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent", clase)}>
      <Icon className="size-3" />
      {texto}
    </Badge>
  );
}

function CertificadoCard({ alumno }: { alumno: Alumno }) {
  const cert = alumno.ficha.certificado;
  const estado = estadoCertificado(cert);
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function elegido(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setSubiendo(true);
    try {
      // si ya había uno conservamos la fecha; si no, proponemos 1 año
      await subirCertificado(
        alumno.id,
        archivo,
        cert?.vencimiento ?? sumarDias(365),
      );
      toast.success("Certificado subido. Revisá la fecha de vencimiento.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
    }
  }

  async function ver() {
    if (!cert) return;
    try {
      const url = await urlCertificado(alumno.id);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el archivo");
    }
  }

  async function quitar() {
    try {
      await quitarCertificado(alumno.id);
      toast.success("Certificado eliminado");
    } catch {
      toast.error("No se pudo eliminar el archivo");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificado médico</CardTitle>
        <CardDescription>PDF o imagen, hasta 5 MB.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept={CERTIFICADO_TIPOS.join(",")}
          className="sr-only"
          onChange={elegido}
          aria-label="Subir certificado médico"
        />

        {cert ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                <FileCheck2 className="size-5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{cert.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {tamanoLegible(cert.tamano)} · subido el {formatFecha(cert.subidoEn)}
                </p>
              </div>
              <CertificadoBadge estado={estado} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venc">Vence el</Label>
              <Input
                id="venc"
                type="date"
                value={cert.vencimiento ?? ""}
                onChange={(e) =>
                  actualizarFicha(alumno.id, {
                    certificado: { ...cert, vencimiento: e.target.value || null },
                  })
                }
                className="w-full sm:w-48"
              />
              {cert.vencimiento && (
                <p
                  className={cn(
                    "text-xs",
                    estado === "vencido"
                      ? "text-destructive"
                      : estado === "por-vencer"
                        ? "text-warning"
                        : "text-muted-foreground",
                  )}
                >
                  {diasHasta(cert.vencimiento) < 0
                    ? `Venció hace ${Math.abs(diasHasta(cert.vencimiento))} días`
                    : `Vence en ${diasHasta(cert.vencimiento)} días`}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={ver}>
                <ExternalLink data-icon="inline-start" />
                Ver
              </Button>
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={subiendo}
              >
                <Upload data-icon="inline-start" />
                {subiendo ? "Subiendo…" : "Reemplazar"}
              </Button>
              <Button
                variant="ghost"
                onClick={quitar}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 data-icon="inline-start" />
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <Upload className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">
              {subiendo ? "Subiendo…" : "Subir certificado médico"}
            </span>
            <span className="text-xs text-muted-foreground">
              Tocá para elegir un PDF o una foto
            </span>
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────── Contacto familiar ───────────── */

function ContactoCard({ alumno }: { alumno: Alumno }) {
  const { contacto } = alumno.ficha;
  const cambiar = (campo: keyof typeof contacto, valor: string) =>
    actualizarFicha(alumno.id, { contacto: { ...contacto, [campo]: valor } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Contacto familiar{" "}
          <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
        </CardTitle>
        <CardDescription>A quién avisar en caso de una emergencia.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contacto-nombre">Nombre</Label>
          <Input
            id="contacto-nombre"
            value={contacto.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            maxLength={LIMITES.nombre}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contacto-parentesco">Parentesco</Label>
            <Input
              id="contacto-parentesco"
              value={contacto.parentesco}
              onChange={(e) => cambiar("parentesco", e.target.value)}
              placeholder="Madre, pareja, hermano…"
              maxLength={LIMITES.parentesco}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contacto-telefono">Teléfono</Label>
            <Input
              id="contacto-telefono"
              type="tel"
              value={contacto.telefono}
              onChange={(e) => cambiar("telefono", e.target.value)}
              placeholder="+54 11 …"
              maxLength={LIMITES.telefono}
              autoComplete="off"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────────── Lesiones ───────────── */

function LesionDialog({
  alumnoId,
  lesion,
  onClose,
}: {
  alumnoId: string;
  lesion: Lesion | "nueva" | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={lesion !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="sm:max-w-md">
        {lesion !== null && (
          <LesionForm
            key={lesion === "nueva" ? "nueva" : lesion.id}
            alumnoId={alumnoId}
            editando={lesion === "nueva" ? null : lesion}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LesionForm({
  alumnoId,
  editando,
  onClose,
}: {
  alumnoId: string;
  editando: Lesion | null;
  onClose: () => void;
}) {
  const [estado, setEstado] = useState<EstadoLesion>(editando?.estado ?? "activa");
  const [error, setError] = useState("");

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = validar(crearLesionDto, {
      descripcion: String(f.get("descripcion")).trim(),
      fecha: String(f.get("fecha")),
      estado,
    });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (editando) actualizarLesion(alumnoId, editando.id, v.datos);
    else agregarLesion(alumnoId, v.datos);
    onClose();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{editando ? "Editar lesión" : "Agregar lesión"}</DialogTitle>
        <DialogDescription>
          Qué pasó, cuándo y cómo viene la recuperación.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="l-desc">Descripción</Label>
        <Textarea
          id="l-desc"
          name="descripcion"
          required
          defaultValue={editando?.descripcion}
          placeholder="Ej: tendinitis en el Aquiles derecho"
          maxLength={LIMITES.lesion}
          className="min-h-24"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="l-fecha">Fecha aproximada</Label>
          <Input
            id="l-fecha"
            name="fecha"
            type="date"
            max={hoyISO()}
            defaultValue={editando?.fecha ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select
            value={estado}
            onValueChange={(v) => v && setEstado(v as EstadoLesion)}
            items={ESTADOS_LESION}
          >
            <SelectTrigger className="w-full" aria-label="Estado de la lesión">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {Object.entries(ESTADOS_LESION).map(([v, t]) => (
                <SelectItem key={v} value={v}>
                  {t}
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
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">Guardar</Button>
      </DialogFooter>
    </form>
  );
}
