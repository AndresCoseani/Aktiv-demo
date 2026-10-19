/**
 * Modo de persistencia de la app (se decide al compilar):
 *  - API  (NEXT_PUBLIC_MODO=api): datos reales vía la API de NestJS + Supabase.
 *  - Demo (sin la variable): datos falsos en localStorage, sin servidor. Transitorio.
 */
export const MODO_API = process.env.NEXT_PUBLIC_MODO === "api";
