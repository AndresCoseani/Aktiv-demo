"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { Navbar } from "@/components/navbar";
import { logout, reintentarCarga, useHydrated, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { session, listo, errorCarga } = useStore();
  const [reintentando, setReintentando] = useState(false);

  useEffect(() => {
    if (hydrated && listo && !session) router.replace("/login");
  }, [hydrated, listo, session, router]);

  if (!hydrated || !listo || !session) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LogoMark className="size-10 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (errorCarga) return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
    <h1 className="text-xl font-semibold">No pudimos cargar tus datos</h1>
    <p role="alert" className="text-sm text-muted-foreground">{errorCarga}</p>
    <p className="text-sm">Tu sesión sigue abierta. Podés reintentar sin volver a escribir tu contraseña.</p>
    <div className="flex gap-2"><Button disabled={reintentando} onClick={async () => { setReintentando(true); try { await reintentarCarga(); } finally { setReintentando(false); } }}>{reintentando ? "Cargando…" : "Reintentar"}</Button><Button variant="outline" disabled={reintentando} onClick={() => void logout()}>Cerrar sesión</Button></div>
  </main>;

  return (
    <>
      <Navbar session={session} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </>
  );
}
