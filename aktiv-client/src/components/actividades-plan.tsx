"use client";
import { useEffect, useState } from "react";
import { actividadPlanSchema } from "@aktiv/contrato";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function useActividadesPlan(habilitado = true) {
  const [actividades, setActividades] = useState(["Fuerza"]);
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
  const [tipo, setTipo] = useState("Fuerza");
  const tiposDePlan = actividades.filter((actividad) => actividad !== "Running");
  const [dias, setDias] = useState(3);
  return <section className="space-y-3"><p className="text-sm font-medium">Tipo de las sesiones</p><p className="text-sm text-muted-foreground">El plan contiene sesiones de una actividad. Running se elige en los días de la semana y se completa con texto libre.</p>
    <input type="hidden" name="tipo" value={tipo} /><input type="hidden" name="actividadesIniciales" value={JSON.stringify({ tipo, dias })} />
    <div role="radiogroup" aria-label="Tipo del plan" className="grid gap-2 sm:grid-cols-2">{tiposDePlan.map((actividad) => <button key={actividad} type="button" role="radio" aria-checked={tipo===actividad} className={`rounded-lg border p-3 text-left text-sm ${tipo===actividad?"border-primary bg-primary/10":"border-border"}`} onClick={()=>setTipo(actividad)}>{actividad}</button>)}</div>
    <label className="block space-y-1 text-sm">Días disponibles en la semana<Input aria-label={`Días de ${tipo.toLowerCase()}`} type="number" min={1} max={7} required value={dias || ""} onChange={(e) => setDias(Number(e.target.value))} /></label>
    <NuevaActividad crear={crear} onCreada={(actividad) => setTipo(actividad)} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

