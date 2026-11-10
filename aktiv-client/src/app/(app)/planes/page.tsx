"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRol } from "@/lib/guards";
import { useModelos } from "@/lib/modelos";
import { hayBorradoresMensuales } from "@/lib/mensual";
import { claveEjercicio, type ResumenModelo } from "@aktiv/contrato";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeloContenido } from "@/components/modelo-contenido";
import { ModeloDialog, type AccionModelo } from "@/components/modelo-dialog";

export default function PlanesPage(){return <Suspense fallback={<p role="status">Cargando planes…</p>}><BibliotecaPlanes /></Suspense>;}
function BibliotecaPlanes(){
  const session=useRol("coach"),router=useRouter(),parametros=useSearchParams();
  const id=parametros.get("modelo"),datos=useModelos(id);
  const [busqueda,setBusqueda]=useState(""),[tipo,setTipo]=useState("__todos"),[accion,setAccion]=useState<AccionModelo|null>(null);
  function navegar(hacer:()=>void){if(hayBorradoresMensuales())toast.error("Esperá a que se guarden los cambios antes de continuar.");else hacer();}
  const resumen=datos.lista.find((p)=>p.id===id);
  const visibles=datos.lista.filter((p)=>claveEjercicio(p.nombre).includes(claveEjercicio(busqueda))&&(tipo==="__todos"||(tipo==="__mixto"?p.tipos.length>1:p.tipos.includes(tipo))));
  const abrir=(p:ResumenModelo)=>navegar(()=>router.push(`/planes?modelo=${p.id}`));
  if(!session)return null;
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Planes</h1><p className="mt-1 text-sm text-muted-foreground">Tus modelos para preparar y reutilizar entrenamientos.</p></div><Button onClick={()=>navegar(()=>setAccion({tipo:"crear"}))}><Plus/>Nuevo plan</Button></header>
    {datos.error?<div role="alert" className="space-y-3 rounded-xl border p-4 text-sm"><p>{datos.error}</p><Button variant="outline" onClick={datos.reintentar}>Reintentar</Button></div>:datos.cargando?<p role="status" className="py-8 text-sm text-muted-foreground">Cargando modelos…</p>:id?<>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b pb-5"><div className="min-w-0 space-y-2"><Button variant="ghost" size="sm" onClick={()=>navegar(()=>router.push("/planes"))}><ArrowLeft/>Todos los modelos</Button><h2 className="break-words text-xl font-semibold">{resumen?.nombre??datos.modelo?.nombre??"Modelo"}</h2><p className="text-sm text-muted-foreground">{datos.modelo?.semanas??resumen?.semanas} semanas · Sin asignar a alumnos</p></div>
        {resumen&&<div className="flex flex-wrap items-center gap-1"><Button variant="outline" onClick={()=>navegar(()=>setAccion({tipo:"asignar",modelo:resumen}))}>Asignar a alumno</Button><Button variant="ghost" size="icon-sm" aria-label="Duplicar modelo" onClick={()=>navegar(()=>setAccion({tipo:"duplicar",modelo:resumen}))}><Copy/></Button><Button variant="ghost" size="icon-sm" aria-label="Editar modelo" onClick={()=>navegar(()=>setAccion({tipo:"editar",modelo:resumen}))}><Pencil/></Button><Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Eliminar modelo" onClick={()=>navegar(()=>setAccion({tipo:"borrar",modelo:resumen}))}><Trash2/></Button></div>}
      </div>
      {datos.modelo?<ModeloContenido key={datos.modelo.id} modelo={datos.modelo}/>:<p role="status" className="text-sm text-muted-foreground">Cargando contenido…</p>}
    </>:<>
      <div className="space-y-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} aria-label="Buscar plan" placeholder="Buscar por nombre" className="h-10 pl-9"/></div><div role="group" aria-label="Filtrar planes" className="flex flex-wrap justify-center gap-2">{["__todos",...new Set(datos.lista.flatMap((p)=>p.tipos)),"__mixto"].map((t)=><Button key={t} className="max-w-full whitespace-normal break-words" size="sm" variant={t===tipo?"secondary":"outline"} aria-pressed={t===tipo} onClick={()=>setTipo(t)}>{t==="__todos"?"Todos":t==="__mixto"?"Mixto":t}</Button>)}</div></div>
      {visibles.length?<div className="divide-y rounded-xl border">{visibles.map((p)=><article key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-4 px-4 py-4"><button type="button" onClick={()=>abrir(p)} className="min-w-0 flex-1 basis-48 space-y-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 className="break-words font-medium">{p.nombre}</h2><p className="break-words text-sm text-muted-foreground">{p.semanas} semanas · {p.dias} {p.dias===1?"entrenamiento":"entrenamientos"} · {p.tipos.join(" + ")||"Sin entrenamientos"}</p></button><div className="flex flex-wrap items-center gap-1"><Button variant="outline" size="sm" onClick={()=>setAccion({tipo:"asignar",modelo:p})}>Asignar</Button><Button variant="ghost" size="icon-sm" aria-label={`Duplicar ${p.nombre}`} onClick={()=>setAccion({tipo:"duplicar",modelo:p})}><Copy/></Button><Button variant="ghost" size="icon-sm" aria-label={`Editar ${p.nombre}`} onClick={()=>setAccion({tipo:"editar",modelo:p})}><Pencil/></Button><Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Eliminar ${p.nombre}`} onClick={()=>setAccion({tipo:"borrar",modelo:p})}><Trash2/></Button></div></article>)}</div>:<div className="space-y-2 rounded-xl border border-dashed px-5 py-12 text-center"><p className="font-medium">{datos.lista.length?"No hay modelos que coincidan":"Creá tu primer plan modelo"}</p><p className="text-sm text-muted-foreground">{datos.lista.length?"Probá otro nombre o tipo de entrenamiento.":"Prepará una base y después adaptá una copia para cada alumno."}</p></div>}
    </>}
    {accion&&<ModeloDialog key={accion.tipo==="crear"?"crear":`${accion.tipo}:${accion.modelo.id}`} accion={accion} onCerrar={()=>setAccion(null)}/>}
  </div>;
}
