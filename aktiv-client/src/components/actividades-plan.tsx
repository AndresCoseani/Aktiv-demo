"use client";
import { useEffect, useState } from "react";
import { actividadPlanSchema } from "@aktiv/contrato";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function useActividadesPlan(habilitado = true) {
  const [actividades, setActividades] = useState(["Fuerza", "Running"]);
  const [error, setError] = useState("");
  useEffect(() => {
    if(!habilitado)return;
    let vigente = true;
    api.get<string[]>("/actividades-plan").then((r) => { if (vigente) setActividades(r); }).catch(() => { if (vigente) setError("No pudimos cargar las actividades. Revisá la conexión y la migración 48."); });
    return () => { vigente = false; };
  }, [habilitado]);
  async function crear(nombre: string) {
    const dto = actividadPlanSchema.safeParse(nombre);
    if (!dto.success) throw new Error(dto.error.issues[0].message);
    const r = await api.post<{ nombre: string }>("/actividades-plan", { nombre: dto.data });
    setActividades((anteriores) => [...new Set([...anteriores, r.nombre])]);
    return r.nombre;
  }
  return { actividades, crear, error };
}

export function NuevaActividad({ crear, onCreada }: { crear: (nombre: string) => Promise<string>; onCreada: (nombre: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  if (!abierto) return <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}><Plus aria-hidden="true" />Agregar actividad</Button>;
  return <div className="flex min-w-0 flex-wrap gap-2"><Input className="min-w-0 flex-1 basis-40" aria-label="Nombre de la actividad" placeholder="Ej: Movilidad" value={nombre} maxLength={80} disabled={ocupado} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} /><Button type="button" disabled={ocupado || !nombre.trim()} onClick={async () => { setOcupado(true); try { const nueva = await crear(nombre); onCreada(nueva); setNombre(""); setAbierto(false); } catch (e) { toast.error(e instanceof Error ? e.message : "No pudimos crear la actividad"); } finally { setOcupado(false); } }}>{ocupado ? "Creando…" : "Crear actividad"}</Button><Button type="button" variant="ghost" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</Button></div>;
}

export function ActividadesIniciales() {
  const { actividades, crear, error } = useActividadesPlan();
  const [elegidas, setElegidas] = useState<Record<string, number>>({ Fuerza: 3 });
  return <section className="space-y-3"><p className="text-sm font-medium">Actividades del plan</p><p className="text-sm text-muted-foreground">Elegí una o varias. Podés agregar más después.</p>
    <input type="hidden" name="actividadesIniciales" value={JSON.stringify(Object.entries(elegidas).map(([tipo, dias]) => ({ tipo, dias })))} />
    <div className="grid gap-3 sm:grid-cols-2">{actividades.map((tipo) => <div key={tipo} className="min-w-0 space-y-2 rounded-lg border p-3"><label className="flex min-h-8 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={Object.hasOwn(elegidas, tipo)} className="size-4 accent-primary" onChange={(e) => setElegidas((prev) => e.target.checked ? { ...prev, [tipo]: 3 } : Object.fromEntries(Object.entries(prev).filter(([nombre]) => nombre !== tipo)))} /><span className="break-words">{tipo}</span></label>{Object.hasOwn(elegidas, tipo) && <label className="block space-y-1 text-sm">Días<Input aria-label={`Días de ${tipo.toLowerCase()}`} type="number" min={1} max={7} required value={elegidas[tipo] || ""} onChange={(e) => setElegidas({ ...elegidas, [tipo]: Number(e.target.value) })} /></label>}</div>)}</div>
    <NuevaActividad crear={crear} onCreada={(tipo) => setElegidas((prev) => ({ ...prev, [tipo]: 1 }))} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
