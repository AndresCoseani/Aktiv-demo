"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { restablecerClaveApi } from "@aktiv/contrato";
import { restablecerClave } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoLockup } from "@/components/logo";

export default function RestablecerClavePage() {
  const token = useRef("");
  const iniciado = useRef(false);
  const [enlaceValido, setEnlaceValido] = useState(false);
  const [listo, setListo] = useState(false);
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const fragmento = new URLSearchParams(window.location.hash.slice(1));
    // Fragmento solo en memoria: no se manda al servidor ni se guarda en storage.
    if (fragmento.get("type") === "recovery") token.current = fragmento.get("access_token") ?? "";
    const valido = Boolean(token.current);
    window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => { setEnlaceValido(valido); setListo(true); });
  }, []);
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (clave !== repetida) { setError("Las contraseñas no coinciden."); return; }
    const dto = restablecerClaveApi.safeParse({ token: token.current, claveNueva: clave });
    if (!dto.success) { setError(dto.error.issues[0]?.message ?? "Revisá la contraseña."); return; }
    setOcupado(true);
    try { await restablecerClave(dto.data.token, dto.data.claveNueva); token.current = ""; setClave(""); setRepetida(""); setGuardado(true); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña."); }
    finally { setOcupado(false); }
  }
  return <main className="flex min-h-dvh items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm space-y-7"><div className="flex justify-center"><LogoLockup /></div>
      <form onSubmit={guardar} className="space-y-5 rounded-2xl border bg-card p-6">
        <h1 className="text-xl font-semibold">Nueva contraseña</h1>
        {!listo ? <p role="status">Cargando…</p> : guardado ? <>
          <p role="status" className="text-sm">Tu contraseña se cambió. Ya podés ingresar con la nueva.</p>
          <Link href="/login" className="block text-sm text-primary hover:underline">Ingresar a Aktiv</Link>
        </> : !enlaceValido ? <>
          <p role="alert" className="text-sm">El enlace venció o no es válido. Solicitá uno nuevo para recuperar tu contraseña.</p>
          <Link href="/recuperar-clave" className="block text-sm text-primary hover:underline">Pedir otro enlace</Link>
        </> : <>
          <p className="text-sm text-muted-foreground">Elegí una contraseña de al menos 8 caracteres.</p>
          <div className="space-y-2"><Label htmlFor="clave-nueva">Contraseña nueva</Label><Input id="clave-nueva" type="password" autoComplete="new-password" minLength={8} maxLength={200} value={clave} onChange={(e) => setClave(e.target.value)} required disabled={ocupado} /></div>
          <div className="space-y-2"><Label htmlFor="clave-repetida">Repetí la contraseña</Label><Input id="clave-repetida" type="password" autoComplete="new-password" minLength={8} maxLength={200} value={repetida} onChange={(e) => setRepetida(e.target.value)} required disabled={ocupado} /></div>
          {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Link href="/recuperar-clave" className="underline">Pedir otro enlace</Link></div>}
          <Button className="w-full" type="submit" disabled={ocupado}>{ocupado ? "Guardando…" : "Cambiar contraseña"}</Button>
        </>}
      </form>
    </div>
  </main>;
}
