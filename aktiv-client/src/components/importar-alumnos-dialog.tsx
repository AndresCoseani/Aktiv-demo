"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { CAMPOS_CSV, leerCsv, revisarImportacion, sugerirColumnas, type ColumnasCsv } from "@/lib/importar-alumnos";
import { importarAlumnos, useStore } from "@/lib/store";
import { nuevoId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function ImportarAlumnosDialog() {
  const { alumnos } = useStore();
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<string[][]>([]);
  const [columnas, setColumnas] = useState<ColumnasCsv>({ nombre: -1, apellido: -1, dni: -1, email: -1, telefono: -1 });
  const [omitidas, setOmitidas] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const revision = useMemo(() => filas.length ? revisarImportacion(filas, columnas, alumnos) : [], [filas, columnas, alumnos]);
  const elegidas = revision.filter((r) => !r.error && !omitidas.includes(r.fila));
  async function leer(archivo?: File) {
    setError(""); setFilas([]); setOmitidas([]);
    if (!archivo) return;
    if (archivo.size > 1_000_000) { setError("El archivo no puede superar 1 MB."); return; }
    try { const datos = leerCsv(await archivo.text()); setColumnas(sugerirColumnas(datos[0])); setFilas(datos); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos leer el CSV."); }
  }
  async function confirmar() {
    if (!elegidas.length || ocupado) return;
    setOcupado(true); setError("");
    try { const r = await importarAlumnos(elegidas.map((r) => ({ ...r.datos, id: nuevoId() }))); toast.success(`Se importaron ${r.cantidad} alumnos`); setAbierto(false); setFilas([]); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos importar los alumnos."); }
    finally { setOcupado(false); }
  }
  return <><Button size="sm" variant="outline" onClick={() => { setAbierto(true); setError(""); }}><Upload />Importar CSV</Button><Dialog open={abierto} onOpenChange={(v) => { if (!ocupado) setAbierto(v); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Importar alumnos</DialogTitle><DialogDescription>En Google Sheets, descargá las respuestas del formulario como CSV. Elegí qué columnas usar y revisá los alumnos antes de importarlos. Las cuentas se habilitan después desde cada ficha.</DialogDescription></DialogHeader>
    <label className="space-y-2 text-sm">Archivo CSV<Input type="file" accept=".csv,text/csv" disabled={ocupado} onChange={(e) => void leer(e.target.files?.[0])} /></label>
    {filas.length > 0 && <><fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2">{CAMPOS_CSV.map((campo) => <label key={campo} className="space-y-1 text-xs capitalize text-muted-foreground">{campo}<select aria-label={`Columna de ${campo}`} value={columnas[campo]} className="h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground" onChange={(e) => { setColumnas({ ...columnas, [campo]: Number(e.target.value) }); setOmitidas([]); }}><option value={-1}>No importar</option>{filas[0].map((nombre, i) => <option key={i} value={i}>{nombre || `Columna ${i + 1}`}</option>)}</select></label>)}</fieldset>
    <p className="text-sm">{elegidas.length} {elegidas.length === 1 ? "alumno seleccionado" : "alumnos seleccionados"} · {revision.filter((r) => r.error).length} filas para revisar</p><div className="max-h-72 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-card"><tr><th className="p-3">Importar</th><th className="p-3">Alumno</th><th className="p-3">DNI</th><th className="p-3">Email / revisión</th></tr></thead><tbody className="divide-y">{revision.map((r) => <tr key={r.fila}><td className="p-3"><input type="checkbox" aria-label={`Importar fila ${r.fila}`} disabled={Boolean(r.error) || ocupado} checked={!r.error && !omitidas.includes(r.fila)} onChange={(e) => setOmitidas(e.target.checked ? omitidas.filter((f) => f !== r.fila) : [...omitidas, r.fila])} /></td><td className="max-w-52 break-words p-3">{r.datos.nombre || `Fila ${r.fila}`}</td><td className="p-3">{r.datos.dni || "Sin DNI"}</td><td className={`max-w-64 break-words p-3 ${r.error ? "text-destructive" : "text-muted-foreground"}`}>{r.error || r.datos.email || "Sin email: no se podrá preparar el acceso todavía"}</td></tr>)}</tbody></table></div></>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="ghost" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</Button><Button disabled={ocupado || !elegidas.length} onClick={() => void confirmar()}>{ocupado ? "Importando…" : `Importar ${elegidas.length} ${elegidas.length === 1 ? "alumno" : "alumnos"}`}</Button></DialogFooter>
  </DialogContent></Dialog></>;
}
