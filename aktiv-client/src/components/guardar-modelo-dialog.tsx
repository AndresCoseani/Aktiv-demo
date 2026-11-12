"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PlanMensual } from "@aktiv/contrato";
import { api } from "@/lib/api";
import { nuevoId } from "@/lib/format";
import { hayBorradoresMensuales } from "@/lib/mensual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function GuardarModeloDialog({ plan, onCerrar }: { plan: PlanMensual; onCerrar: () => void }) {
  const [id] = useState(nuevoId), [ocupado,setOcupado]=useState(false), [error,setError]=useState("");
  const router=useRouter();
  return <Dialog open onOpenChange={(o)=>!o&&!ocupado&&onCerrar()}><DialogContent className="sm:max-w-md" showCloseButton={!ocupado}>
    <form className="space-y-4" onSubmit={async(e)=>{
      e.preventDefault(); if(ocupado)return;
      if(hayBorradoresMensuales()){setError("Esperá a que terminen de guardarse los cambios del plan.");return;}
      const nombre=String(new FormData(e.currentTarget).get("nombre")).trim();
      setOcupado(true);setError("");
      try {await api.post(`/planes-modelo/desde-plan/${plan.id}`,{id,nombre});onCerrar();toast.success("Modelo guardado",{action:{label:"Ver modelo",onClick:()=>router.push(`/planes?modelo=${id}`)}});}
      catch(e){setError(e instanceof Error?e.message:"No pudimos guardar el modelo.");}finally{setOcupado(false);}
    }}>
      <DialogHeader><DialogTitle>Guardar como modelo</DialogTitle><DialogDescription>Se guarda una copia completa en Planes para reutilizarla con otros alumnos. Incluye sesiones y progresiones; no incluye pesos ni seguimiento personal, y permanece aunque borres este plan.</DialogDescription></DialogHeader>
      <label className="block space-y-1 text-sm">Nombre<Input name="nombre" defaultValue={plan.nombre} maxLength={120} required disabled={ocupado} autoFocus /></label>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={ocupado} onClick={onCerrar}>Cancelar</Button><Button type="submit" disabled={ocupado}>{ocupado?"Guardando…":"Guardar modelo"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
