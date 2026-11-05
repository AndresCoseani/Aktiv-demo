"use client";

import Link from "next/link";
import { useState } from "react";
import { recuperarClaveApi } from "@aktiv/contrato";
import { recuperarClave } from "@/lib/api";
import { useHydrated } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoLockup } from "@/components/logo";

export default function RecuperarClavePage() {
  const listo = useHydrated();
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const dto = recuperarClaveApi.safeParse({ email: email.trim() });
    if (!dto.success) { setError("Escribí un email válido."); return; }
    setOcupado(true);
    try { await recuperarClave(dto.data.email); setEnviado(true); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo solicitar el correo."); }
    finally { setOcupado(false); }
  }
  return <main className="flex min-h-dvh items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm space-y-7"><div className="flex justify-center"><LogoLockup /></div>
      <form onSubmit={enviar} className="space-y-5 rounded-2xl border bg-card p-6">
        <div className="space-y-2"><h1 className="text-xl font-semibold">Recuperar contraseña</h1>
          <p className="text-sm text-muted-foreground">Ingresá el email con el que entrás a Aktiv.</p></div>
        {enviado ? <p role="status" className="text-sm">Si ese email tiene una cuenta, recibirás un enlace para elegir una contraseña nueva. Revisá también la carpeta de spam.</p> : <>
          <div className="space-y-2"><Label htmlFor="recuperar-email">Email</Label><Input id="recuperar-email" type="email" autoComplete="email" autoCapitalize="none" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!listo || ocupado} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={!listo || ocupado}>{ocupado ? "Solicitando…" : "Enviar enlace"}</Button>
        </>}
        <Link href="/login" className="block text-center text-sm text-primary underline-offset-4 hover:underline">Volver a ingresar</Link>
      </form>
    </div>
  </main>;
}
