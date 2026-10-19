/**
 * Dirección pública de la app: es la que se le pasa a los alumnos en el mensaje de acceso,
 * aunque el profe esté probando en su compu (localhost). Si algún día hay dominio propio,
 * se cambia con NEXT_PUBLIC_APP_URL (se fija al compilar).
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://aktiv-running.vercel.app").replace(/\/$/, "");
