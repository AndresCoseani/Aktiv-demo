"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRol } from "@/lib/guards";
import { guias, normalizarBusqueda } from "@/lib/manual";

export default function ManualPage() {
  return <Suspense fallback={<p role="status">Cargando manual…</p>}><Manual /></Suspense>;
}

function Manual() {
  const session = useRol("coach");
  const parametros = useSearchParams();
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const guia = guias.find((item) => item.id === parametros.get("guia"));
  const palabras = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean);
  const resultados = guias.filter((item) => (categoria === "Todas" || item.categoria === categoria) && palabras.every((palabra) => normalizarBusqueda(`${item.titulo} ${item.descripcion} ${item.categoria} ${item.pasos.join(" ")}`).includes(palabra)));
  if (!session) return null;

  if (guia) return <div className="mx-auto max-w-3xl space-y-7">
    <Button variant="ghost" size="sm" render={<Link href="/manual" />}><ArrowLeft />Todas las guías</Button>
    <header className="space-y-3"><p className="text-sm font-medium text-primary">{guia.categoria}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{guia.titulo}</h1><p className="text-muted-foreground">{guia.descripcion}</p></header>
    <ol className="divide-y rounded-2xl border bg-card px-5 sm:px-7">{guia.pasos.map((paso, indice) => <li key={paso} className="flex gap-4 py-5 sm:py-6"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">{indice + 1}</span><p className="min-w-0 pt-0.5 leading-relaxed">{paso}</p></li>)}</ol>
    <aside className="border-l-2 border-primary/50 pl-4 text-sm leading-relaxed text-muted-foreground">{guia.nota}</aside>
    <Button render={<Link href={guia.destino} />}>Ir a {guia.categoria}<ArrowUpRight /></Button>
  </div>;

  return <div className="mx-auto max-w-4xl space-y-7">
    <header className="max-w-2xl space-y-3"><BookOpen className="size-6 text-primary" /><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Manual de uso</h1><p className="text-muted-foreground">¿Qué necesitás hacer, Lucas? Buscá una tarea y seguí los pasos.</p></header>
    <div className="space-y-4"><div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar en el manual" placeholder="Por ejemplo: crear alumno" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} className="h-12 pl-12 text-base" /></div><div className="flex flex-wrap gap-2" role="group" aria-label="Temas del manual">{["Todas", "Alumnos", "Planes", "Clases", "Ejercicios", "Carreras"].map((tema) => <Button key={tema} variant={categoria === tema ? "secondary" : "ghost"} size="sm" aria-pressed={categoria === tema} onClick={() => setCategoria(tema)}>{tema}</Button>)}</div></div>
    <p role="status" className="text-sm text-muted-foreground">{resultados.length} {resultados.length === 1 ? "guía disponible" : "guías disponibles"}</p>
    {resultados.length ? <div className="divide-y rounded-2xl border bg-card">{resultados.map((item) => <Link key={item.id} href={`/manual?guia=${item.id}`} className="group flex min-w-0 items-center justify-between gap-4 px-5 py-5 outline-none transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:px-6"><div className="min-w-0 space-y-1"><p className="text-xs font-medium text-primary">{item.categoria}</p><h2 className="font-semibold">{item.titulo}</h2><p className="text-sm text-muted-foreground">{item.descripcion}</p></div><ChevronRight className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" /></Link>)}</div> : <div className="space-y-3 rounded-2xl border border-dashed p-8 text-center"><p>No encontramos esa tarea.</p><p className="text-sm text-muted-foreground">Probá con «alumno», «horario» o «plan».</p><Button variant="outline" onClick={() => { setBusqueda(""); setCategoria("Todas"); }}>Ver todas las guías</Button></div>}
  </div>;
}
