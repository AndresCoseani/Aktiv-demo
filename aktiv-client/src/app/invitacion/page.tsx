"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, MailX } from "lucide-react";
import { LogoBadge, LogoLockup, LogoMark } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorHttp, consultarInvitacion } from "@/lib/api";
import { claveNuevaSchema, tokenInvitacionSchema, validar } from "@/lib/schemas";
import { aceptarInvitacion } from "@/lib/store";
import Link from "next/link";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "invalida"; mensaje: string }
  | { tipo: "lista"; nombre: string; email: string; profe: string };

function Contenido() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    async function consultar() {
      if (!validar(tokenInvitacionSchema, token).ok) {
        setEstado({ tipo: "invalida", mensaje: "El enlace no es válido." });
        return;
      }
      try {
        const r = await consultarInvitacion(token);
        if (vigente) setEstado({ tipo: "lista", ...r });
      } catch (e) {
        if (!vigente) return;
        setEstado({
          tipo: "invalida",
          mensaje: e instanceof ErrorHttp ? e.message : "No pudimos verificar el enlace. Probá de nuevo en un momento.",
        });
      }
    }
    void consultar();
    return () => {
      vigente = false;
    };
  }, [token]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = validar(claveNuevaSchema, clave);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (clave !== repetida) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setEnviando(true);
    const r = await aceptarInvitacion(token, clave);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.replace(r.session.role === "coach" ? "/dashboard" : "/mi-plan");
  }

  return (
    <div className="relative w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-5 text-center">
        <LogoBadge className="size-20 ring-2 ring-primary/30 shadow-[0_0_60px_-10px] shadow-primary/40" />
        <LogoLockup />
      </div>

      {estado.tipo === "cargando" && (
        <div className="grid place-items-center py-10">
          <LogoMark className="size-10 animate-pulse text-muted-foreground" />
        </div>
      )}

      {estado.tipo === "invalida" && (
        <div className="space-y-4 rounded-2xl border bg-card/80 p-6 text-center shadow-sm backdrop-blur">
          <MailX className="mx-auto size-10 text-muted-foreground/60" />
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Este enlace no sirve</h1>
            <p role="alert" className="text-sm text-muted-foreground">
              {estado.mensaje} Pedile a tu profe que te mande una invitación nueva.
            </p>
          </div>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Ir a ingresar
          </Link>
        </div>
      )}

      {estado.tipo === "lista" && (
        <form onSubmit={enviar} className="space-y-4 rounded-2xl border bg-card/80 p-6 shadow-sm backdrop-blur">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Hola, {estado.nombre}!</h1>
            <p className="text-sm text-muted-foreground">
              {estado.profe} te sumó a Aktiv. Elegí tu contraseña para ver tu plan. Vas a entrar con{" "}
              <span className="font-medium text-foreground">{estado.email}</span>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clave-nueva">Contraseña</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="clave-nueva"
                type="password"
                value={clave}
                onChange={(e) => {
                  setClave(e.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                placeholder="Al menos 8 caracteres"
                className="h-10 pl-8"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clave-repetida">Repetí la contraseña</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="clave-repetida"
                type="password"
                value={repetida}
                onChange={(e) => {
                  setRepetida(e.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                className="h-10 pl-8"
                required
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="h-10 w-full" disabled={enviando}>
            {enviando ? "Guardando…" : "Crear mi acceso"}
            {!enviando && <ArrowRight data-icon="inline-end" />}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function InvitacionPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <LogoMark
        className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] text-foreground opacity-[0.025]"
        title=""
      />
      <Suspense fallback={null}>
        <Contenido />
      </Suspense>
    </main>
  );
}
