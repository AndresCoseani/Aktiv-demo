"use client";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { reintentarCarga } from "@/lib/store";
import { Button } from "./ui/button";
type Solicitud={id:string;nombre:string;email:string;dni:string;telefono:string};
export function SolicitudesAlta(){
  const [filas,setFilas]=useState<Solicitud[]>([]),[error,setError]=useState(""),[cargando,setCargando]=useState(true),[ocupado,setOcupado]=useState<string|null>(null);
  async function cargar(){setCargando(true);try{setFilas(await api.get<Solicitud[]>("/auth/solicitudes-alta"));setError("");}catch(e){setError(e instanceof Error?e.message:"No pudimos cargar las solicitudes.");}finally{setCargando(false);}}
  useEffect(()=>{let vigente=true;api.get<Solicitud[]>("/auth/solicitudes-alta").then((r)=>{if(vigente)setFilas(r);}).catch((e)=>{if(vigente)setError(e instanceof Error?e.message:"No pudimos cargar las solicitudes.");}).finally(()=>{if(vigente)setCargando(false);});return()=>{vigente=false;};},[]);
  return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Solicitudes de alta"><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Solicitudes de alta{filas.length>0?` (${filas.length})`:""}</h2><p className="mt-1 text-sm text-muted-foreground">Aprobá con el tilde cuando hayas hablado con el alumno. No vencen.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/registro`);toast.success("Enlace de registro copiado");}catch{toast.error("No pudimos copiar el enlace. Es la dirección de la app seguida de /registro.");}}}><Copy/>Copiar enlace de registro</Button><Button variant="ghost" size="sm" disabled={cargando} onClick={()=>void cargar()}>Actualizar</Button></div></header>
    {error?<div role="alert" className="text-sm text-destructive">{error}</div>:cargando?<p role="status" className="text-sm text-muted-foreground">Consultando solicitudes…</p>:filas.length?<ul className="divide-y">{filas.map((s)=><li key={s.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1 basis-48"><p className="break-words font-medium">{s.nombre}</p><p className="break-all text-sm text-muted-foreground">{s.email}</p><p className="text-sm text-muted-foreground">DNI {s.dni}{s.telefono?` · ${s.telefono}`:""}</p></div><Button size="sm" disabled={ocupado!==null} aria-label={`Aprobar a ${s.nombre}`} onClick={async()=>{setOcupado(s.id);try{await api.post(`/auth/solicitudes-alta/${s.id}/aprobar`,{});setFilas((antes)=>antes.filter((v)=>v.id!==s.id));toast.success(`${s.nombre} ya puede ingresar`);await reintentarCarga();}catch(e){toast.error(e instanceof Error?e.message:"No pudimos aprobar el alta.");}finally{setOcupado(null);}}}><Check/>{ocupado===s.id?"Aprobando…":"Aprobar"}</Button></li>)}</ul>:<p className="text-sm text-muted-foreground">No hay altas pendientes con email confirmado.</p>}
  </section>;
}
