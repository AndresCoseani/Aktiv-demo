"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, User } from "lucide-react";
import { LogoBadge, LogoLockup, LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginDemoDto, loginDto, validar } from "@/lib/schemas";
import { login, useHydrated, useStore } from "@/lib/store";
import { MODO_API } from "@/lib/modo";

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { session, listo } = useStore();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (hydrated && listo && session) {
      router.replace(session.role === "coach" ? "/dashboard" : "/mi-plan");
    }
  }, [hydrated, listo, session, router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = validar(MODO_API ? loginDto : loginDemoDto, { usuario, clave });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setEnviando(true);
    const r = await login(v.datos.usuario, v.datos.clave);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.replace(r.session.role === "coach" ? "/dashboard" : "/mi-plan");
  }

  function rellenar(u: string) {
    setUsuario(u);
    setClave(u);
    setError("");
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* marca de agua del isotipo */}
      <LogoMark
        className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] text-foreground opacity-[0.025]"
        title=""
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-5 text-center">
          <LogoBadge className="size-20 ring-2 ring-primary/30 shadow-[0_0_60px_-10px] shadow-primary/40" />
          <LogoLockup />
        </div>

        <form
          onSubmit={enviar}
          className="space-y-4 rounded-2xl border bg-card/80 p-6 shadow-sm backdrop-blur"
        >
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Ingresar</h1>
            <p className="text-sm text-muted-foreground">
              Accedé al panel de entrenamiento.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usuario">{MODO_API ? "Email" : "Usuario"}</Label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="usuario"
                value={usuario}
                onChange={(e) => {
                  setUsuario(e.target.value);
                  setError("");
                }}
                type={MODO_API ? "email" : "text"}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={MODO_API ? "tu@email.com" : "admin"}
                className="h-10 pl-8"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clave">Contraseña</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="clave"
                type="password"
                value={clave}
                onChange={(e) => {
                  setClave(e.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                placeholder="••••••"
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

          <Button
            type="submit"
            size="lg"
            className="h-10 w-full"
            disabled={enviando || !listo}
          >
            {enviando ? "Entrando…" : "Entrar"}
            {!enviando && <ArrowRight data-icon="inline-end" />}
          </Button>
        </form>

        {!MODO_API && (
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p className="mb-2">Cuentas de la demo</p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => rellenar("admin")}
              className="rounded-full border px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Profe · admin
            </button>
            <button
              type="button"
              onClick={() => rellenar("alumno")}
              className="rounded-full border px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              Alumno · alumno
            </button>
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
