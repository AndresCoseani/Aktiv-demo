import { z } from "zod";

/**
 * Configuración de la API, validada al arrancar: si falta algo o está mal,
 * el proceso no levanta y dice exactamente qué corregir.
 *
 * Secretos: casi toda la API usa SOLO la clave pública (publishable/anon) de
 * Supabase y accede a la base *como el usuario* (con su token), así que las
 * políticas RLS siguen valiendo.
 *
 * Excepción acotada: SUPABASE_SERVICE_ROLE_KEY. Solo la usa el módulo de
 * invitaciones (crear/borrar la cuenta de un alumno, ponerle contraseña y
 * guardar sus enlaces), siempre después de comprobar que quien lo pide es el
 * profe dueño de ese alumno. Si no está configurada, el resto de la API
 * funciona igual y las invitaciones responden 503.
 */

/** Una variable vacía (`CLAVE=`) cuenta como "no configurada" */
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), esquema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  SUPABASE_URL: z.url("SUPABASE_URL tiene que ser una URL (https://<proyecto>.supabase.co)"),
  SUPABASE_ANON_KEY: z.string().min(20, "Falta SUPABASE_ANON_KEY (la clave pública publishable/anon)"),
  /** clave secret/service_role: solo para el módulo de invitaciones (ver arriba) */
  SUPABASE_SERVICE_ROLE_KEY: opcional(z.string().min(20)),

  /** orígenes del frontend permitidos (CORS y verificación anti-CSRF), separados por coma */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  /** URL base para los enlaces de los mails; por defecto, el primer WEB_ORIGIN */
  APP_URL: opcional(z.url()),

  /** Resend: clave de API y remitente verificado, por ejemplo  Aktiv <aktiv@tu-dominio.com> */
  RESEND_API_KEY: opcional(z.string().min(10)),
  MAIL_FROM: opcional(z.string().min(5)),

  /** días de vida del enlace de invitación */
  INVITACION_DIAS: z.coerce.number().int().min(1).max(30).default(7),
  /** invitaciones por alumno y por hora (evita mandar mails en ráfaga) */
  INVITACIONES_POR_HORA: z.coerce.number().int().min(1).default(5),

  /** cookies con flag Secure; por defecto solo en producción */
  COOKIE_SECURE: opcional(z.enum(["true", "false"])),
  /** cuántos proxies hay delante de la API (para leer la IP real del cliente) */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).default(300),
  /** intentos fallidos de login por minuto, por IP + email */
  LOGIN_FALLOS_POR_MIN: z.coerce.number().int().min(1).default(8),
});

export type Env = Omit<z.output<typeof envSchema>, "COOKIE_SECURE" | "WEB_ORIGIN" | "APP_URL"> & {
  origenes: string[];
  cookieSecure: boolean;
  /** base de los enlaces que van en los mails, sin barra final */
  appUrl: string;
};

export const ENV = Symbol("ENV");

export function cargarEnv(raw: Record<string, string | undefined> = process.env): Env {
  const r = envSchema.safeParse(raw);
  if (!r.success) {
    const detalle = r.error.issues
      .map((i) => `  - ${i.path.join(".") || "(general)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración inválida de la API:\n${detalle}\nRevisá .env (ver .env.example).`);
  }
  const { COOKIE_SECURE, WEB_ORIGIN, APP_URL, ...resto } = r.data;
  const origenes = WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  return {
    ...resto,
    origenes,
    cookieSecure: COOKIE_SECURE ? COOKIE_SECURE === "true" : resto.NODE_ENV === "production",
    appUrl: (APP_URL ?? origenes[0] ?? "http://localhost:3000").replace(/\/$/, ""),
  };
}

/** Carga .env si existe (en producción las variables las inyecta el host) */
export function cargarArchivoEnv(ruta = ".env") {
  try {
    process.loadEnvFile(ruta);
  } catch {
    // sin archivo: se usan las variables del entorno
  }
}
