"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearCategoriaEjercicio, useStore } from "@/lib/store";
import { categoriasDelCatalogo } from "@/lib/dominio";

export function CategoriaEjercicioSelector({ value, onChange }: { value: string; onChange: (nombre: string) => void }) {
  const { ejerciciosCustom, categoriasEjercicio } = useStore();
  const categorias = categoriasDelCatalogo(ejerciciosCustom, [...categoriasEjercicio, value]);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function crear() {
    if (!nombre.trim() || ocupado) return;
    setOcupado(true);
    try {
      onChange(await crearCategoriaEjercicio(nombre));
      setNombre(""); setCreando(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar la categoría. Reintentá.");
    } finally { setOcupado(false); }
  }
  return <div className="min-w-0 space-y-2">
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-full" aria-label="Categoría"><SelectValue /></SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>{categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
    </Select>
    {creando ? <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Nombre de categoría" placeholder="Nombre de la categoría" value={nombre} maxLength={80} disabled={ocupado} className="min-w-32 flex-1" autoFocus onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void crear(); } }} />
      <Button type="button" size="sm" disabled={ocupado || !nombre.trim()} onClick={() => void crear()}>{ocupado ? "Guardando…" : "Crear categoría"}</Button>
      <Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => setCreando(false)}>Cancelar</Button>
    </div> : <Button type="button" variant="ghost" size="sm" onClick={() => setCreando(true)}><Plus />Nueva categoría</Button>}
  </div>;
}
