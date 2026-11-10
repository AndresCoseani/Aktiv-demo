"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LogoLockup } from "@/components/logo";

let confirmacion: {token:string;promesa:Promise<unknown>}|undefined;
export default function ConfirmarRegistroPage(){
  const [estado,setEstado]=useState("Confirmando tu email…"),[error,setError]=useState(false);
  useEffect(()=>{
    const fragmento=new URLSearchParams(window.location.hash.slice(1));const token=fragmento.get("access_token");
    let vigente=true;
    if(!token&&!confirmacion){Promise.resolve().then(()=>{if(vigente)setEstado("Abrí el enlace del correo de confirmación. Si ya lo usaste, probá ingresar para consultar el estado de tu alta.");});return()=>{vigente=false;};}
    if(token){window.history.replaceState(null,"",window.location.pathname);if(confirmacion?.token!==token)confirmacion={token,promesa:api.post("/auth/confirmar-registro",{token})};}
    confirmacion!.promesa.then(()=>{if(vigente)setEstado("Tu email está confirmado. Tu solicitud queda pendiente de aprobación de Lucas y no vence. Cuando él te avise, ingresá con tu email y tu DNI sin puntos.");}).catch((e)=>{if(vigente){setError(true);setEstado(e instanceof Error?e.message:"No pudimos confirmar la solicitud. Probá ingresar o contactá a Lucas.");}});
    return()=>{vigente=false;};
  },[]);
  return <main className="flex min-h-dvh items-center justify-center px-4 py-10"><div className="w-full max-w-md space-y-7"><div className="flex justify-center"><LogoLockup/></div><section className="space-y-5 rounded-2xl border bg-card p-6"><h1 className="text-xl font-semibold">Tu registro en Aktiv</h1><p role={error?"alert":"status"} className="text-sm leading-relaxed">{estado}</p><Link href="/login" className="block text-sm text-primary underline">Ir a ingresar</Link></section></div></main>;
}
