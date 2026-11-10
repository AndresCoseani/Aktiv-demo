"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { registroAlumnoApi, normalizarDni } from "@aktiv/contrato";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoLockup } from "@/components/logo";

export default function RegistroPage() {
  const [habilitado,setHabilitado]=useState<boolean|null>(null),[ocupado,setOcupado]=useState(false),[enviado,setEnviado]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let vigente=true;api.get<{habilitado:boolean}>("/auth/registro").then((r)=>{if(vigente)setHabilitado(r.habilitado);}).catch(()=>{if(vigente){setHabilitado(false);setError("No pudimos consultar el registro. Probá recargar en un momento.");}});return()=>{vigente=false;};},[]);
  async function enviar(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(ocupado)return;setError("");const f=new FormData(e.currentTarget);
    const dto=registroAlumnoApi.safeParse({nombre:String(f.get("nombre")).trim(),dni:normalizarDni(String(f.get("dni"))),email:String(f.get("email")).trim(),telefono:""});
    if(!dto.success){setError(dto.error.issues[0].message);return;}setOcupado(true);
    try{await api.post("/auth/registro",dto.data);setEnviado(true);}catch(e){setError(e instanceof Error?e.message:"No pudimos enviar la solicitud.");}finally{setOcupado(false);}
  }
  return <main className="flex min-h-dvh items-center justify-center px-4 py-10"><div className="w-full max-w-md space-y-7"><div className="flex justify-center"><LogoLockup/></div><section className="space-y-5 rounded-2xl border bg-card p-6"><header className="space-y-2"><h1 className="text-2xl font-semibold">Registrarme en Aktiv</h1><p className="text-sm text-muted-foreground">Completá estos tres datos y Lucas aprobará tu acceso.</p></header>
    {enviado?<div role="status" className="space-y-3 text-sm leading-relaxed"><p>Tu solicitud ya está enviada. No tenés que confirmar el email.</p><p>Cuando Lucas apruebe tu alta, ingresá con tu email y tu DNI sin puntos. La solicitud no vence.</p><p>Si ya tenés una cuenta, podés ingresar o recuperar tu contraseña.</p></div>:habilitado===null?<p role="status">Consultando registro…</p>:habilitado?<form onSubmit={enviar} className="space-y-4"><fieldset disabled={ocupado} className="space-y-4">
      <label className="block space-y-2 text-sm">Nombre completo<Input name="nombre" autoComplete="name" maxLength={120} required/></label>
      <label className="block space-y-2 text-sm">DNI<Input name="dni" inputMode="numeric" maxLength={12} placeholder="Sin puntos" required/></label>
      <label className="block space-y-2 text-sm">Email<Input name="email" type="email" autoComplete="email" autoCapitalize="none" maxLength={254} required/></label>
      <p className="text-sm text-muted-foreground">Revisá que tu email y tu DNI estén bien escritos. Tu contraseña inicial será tu DNI sin puntos. Podés cambiarla después desde Mi perfil.</p>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="w-full">{ocupado?"Enviando…":"Solicitar mi alta"}</Button>
    </fieldset></form>:<p role="alert" className="text-sm">{error||"El registro todavía no está habilitado. Contactá a Lucas para preparar tu acceso."}</p>}
    <Link href="/login" className="block text-center text-sm text-primary underline-offset-4 hover:underline">Volver a ingresar</Link>
  </section></div></main>;
}
