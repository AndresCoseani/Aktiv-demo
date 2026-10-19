import { z } from "zod";

/**
 * Configuración de la API, validada al arrancar: si falta algo o está mal,
 * el proceso no levanta y dice exactamente qué corregir.
 *
 * Ojo con los secretos: la API usa SOLO la clave pública (publishable/anon) de
 * Supabase y accede a la base *como el usuario* (con su token), así que las
 * políticas RLS siguen valiendo. No hace falta ni se debe cargar la clave
 * service_role acá.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  SUPABASE_URL: z.url("SUPABASE_URL tiene que ser una URL (https://<proyecto>.supabase.co)"),
  SUPABASE_ANON_KEY: z.string().min(20, "Falta SUPABASE_ANON_KEY (la clave pública publishable/anon)"),

  /** orígenes del frontend permitidos (CORS y verificación anti-CSRF), separados por coma */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),

  /** cookies con flag Secure; por defecto solo en producción */
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  /** cuántos proxies hay delante de la API (para leer la IP real del cliente) */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).default(300),
  /** intentos fallidos de login por minuto, por IP + email */
  LOGIN_FALLOS_POR_MIN: z.coerce.number().int().min(1).default(8),
});

export type Env = Omit<z.output<typeof envSchema>, "COOKIE_SECURE" | "WEB_ORIGIN"> & {
  origenes: string[];
  cookieSecure: boolean;
};

export const ENV = Symbol("ENV");

export function cargarEnv(raw: Record<string, string | undefined> = process.env): Env {
  const r = envSchema.safeParse(raw);
  if (!r.success) {
    const detalle = r.error.issues
      .map((i) => `  - ${i.path.join(".") || "(general)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración inválida de la API:\n${detalle}\nRevisá backend/.env (ver backend/.env.example).`);
  }
  const { COOKIE_SECURE, WEB_ORIGIN, ...resto } = r.data;
  return {
    ...resto,
    origenes: WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
    cookieSecure: COOKIE_SECURE ? COOKIE_SECURE === "true" : resto.NODE_ENV === "production",
  };
}

/** Carga backend/.env si existe (en producción las variables las inyecta el host) */
export function cargarArchivoEnv(ruta = ".env") {
  try {
    process.loadEnvFile(ruta);
  } catch {
    // sin archivo: se usan las variables del entorno
  }
}
