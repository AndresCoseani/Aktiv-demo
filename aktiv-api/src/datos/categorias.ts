import type { SupabaseService } from "../supabase/supabase.service";
import { lanzarSiError } from "../common/errores";

/** La migración del catálogo no puede impedir cargar alumnos, planes o sesión. */
export async function cargarCategorias(db: ReturnType<SupabaseService["delUsuario"]>, existentes: readonly { categoria: string }[]) {
  const nombres: string[] = [];
  for (let desde = 0; ; desde += 500) {
    const r = await db.from("categorias_ejercicio").select("nombre").order("nombre").range(desde, desde + 499);
    const faltaTabla = ["PGRST205", "42P01"].includes(r.error?.code ?? "") && /\bcategorias_ejercicio\b/.test(r.error?.message ?? "");
    if (faltaTabla) return [...new Set(existentes.map((e) => e.categoria))];
    lanzarSiError(r.error);
    nombres.push(...(r.data ?? []).map((c) => c.nombre as string));
    if ((r.data?.length ?? 0) < 500) return nombres;
  }
}
