import {
  datosApiSchema,
  invitacionConsultaSchema,
  invitacionEnviadaSchema,
  type DatosApi,
  type InvitacionConsulta,
  type InvitacionEnviada,
} from "@aktiv/contrato";
import type { Certificado, Session } from "./types";

/**
 * Cliente HTTP de la API de Aktiv (NestJS).
 *
 *  - Las rutas son relativas (/api/...): Next las reenvía a la API (rewrites),
 *    así el navegador solo habla con su propio origen y las cookies son del
 *    mismo sitio.
 *  - La sesión vive en cookies httpOnly: JavaScript nunca ve los tokens.
 *  - Los pedidos que modifican datos llevan X-Requested-With (protección CSRF).
 *  - Si el access token venció, se renueva solo una vez y se reintenta.
 */

export class ErrorHttp extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: Record<string, string>,
  ) {
    super(mensaje);
    this.name = "ErrorHttp";
  }
}

let alPerderSesion: (() => void) | null = null;

/** El store se entera cuando la sesión ya no se puede renovar */
export function alPerderLaSesion(cb: () => void) {
  alPerderSesion = cb;
}

let renovando: Promise<boolean> | null = null;

/** Renueva la sesión una sola vez aunque haya varios pedidos fallando a la vez */
function renovarSesion(): Promise<boolean> {
  renovando ??= fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "x-requested-with": "aktiv" },
    credentials: "same-origin",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

async function leerError(res: Response): Promise<ErrorHttp> {
  let cuerpo: { codigo?: string; mensaje?: string; detalles?: Record<string, string> } = {};
  try {
    cuerpo = await res.json();
  } catch {
    // respuesta sin JSON (proxy caído, etc.)
  }
  return new ErrorHttp(
    res.status,
    cuerpo.codigo ?? `http_${res.status}`,
    cuerpo.mensaje ?? (res.status >= 500 ? "El servidor no respondió. Probá de nuevo." : "No se pudo completar la acción."),
    cuerpo.detalles,
  );
}

async function llamar<T>(
  metodo: "GET" | "POST" | "PATCH" | "DELETE",
  ruta: string,
  cuerpo?: unknown,
  opciones: { reintentar?: boolean; formData?: FormData } = {},
): Promise<T> {
  const { reintentar = true, formData } = opciones;
  const headers: Record<string, string> = {};
  if (metodo !== "GET") headers["x-requested-with"] = "aktiv";
  if (cuerpo !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      headers,
      body: formData ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ErrorHttp(0, "sin_conexion", "No hay conexión con el servidor.");
  }

  // login, refresh y logout no se reintentan; /auth/me sí (es la forma de recuperar la sesión)
  const sinRenovar = ["/auth/login", "/auth/refresh", "/auth/logout"].includes(ruta) || ruta.startsWith("/auth/invitacion");
  if (res.status === 401 && reintentar && !sinRenovar) {
    if (await renovarSesion()) return llamar<T>(metodo, ruta, cuerpo, { reintentar: false, formData });
    alPerderSesion?.();
  }
  if (!res.ok) throw await leerError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(ruta: string) => llamar<T>("GET", ruta),
  post: <T = { id: string }>(ruta: string, cuerpo: unknown) => llamar<T>("POST", ruta, cuerpo),
  patch: <T = { id: string }>(ruta: string, cuerpo: unknown) => llamar<T>("PATCH", ruta, cuerpo),
  delete: (ruta: string) => llamar<void>("DELETE", ruta),
};

/* ───────────── Endpoints con forma propia ───────────── */

export async function login(usuario: string, clave: string): Promise<Session> {
  const r = await llamar<{ session: Session }>("POST", "/auth/login", { usuario, clave }, { reintentar: false });
  return r.session;
}

export async function logout() {
  await llamar<void>("POST", "/auth/logout", undefined, { reintentar: false }).catch(() => undefined);
}

/** La sesión actual, o null si no hay (o venció y no se pudo renovar) */
export async function sesionActual(): Promise<Session | null> {
  try {
    return (await llamar<{ session: Session }>("GET", "/auth/me")).session;
  } catch (e) {
    if (e instanceof ErrorHttp && e.status === 401) return null;
    throw e;
  }
}

/** El profe invita (o reenvía el acceso) a un alumno: la API le manda el mail */
export async function invitar(alumnoId: string): Promise<InvitacionEnviada> {
  return invitacionEnviadaSchema.parse(await llamar<unknown>("POST", `/alumnos/${alumnoId}/invitar`, {}));
}

/** A quién pertenece el enlace del mail (público, antes de elegir contraseña) */
export async function consultarInvitacion(token: string): Promise<InvitacionConsulta> {
  return invitacionConsultaSchema.parse(
    await llamar<unknown>("GET", `/auth/invitacion/${encodeURIComponent(token)}`, undefined, { reintentar: false }),
  );
}

/** El alumno elige su contraseña; la API deja la sesión iniciada en las cookies */
export async function aceptarInvitacion(token: string, clave: string): Promise<Session> {
  const r = await llamar<{ session: Session }>("POST", "/auth/invitacion/aceptar", { token, clave }, { reintentar: false });
  return r.session;
}

/** Todo lo que el usuario puede ver; se valida contra el contrato */
export async function cargarTodo(): Promise<DatosApi> {
  return datosApiSchema.parse(await llamar<unknown>("GET", "/datos"));
}

export function subirCertificado(alumnoId: string, archivo: File, vencimiento: string | null) {
  const form = new FormData();
  form.append("archivo", archivo);
  if (vencimiento) form.append("vencimiento", vencimiento);
  return llamar<Certificado>("POST", `/alumnos/${alumnoId}/certificado`, undefined, { formData: form });
}

export function quitarCertificadoRemoto(alumnoId: string) {
  return llamar<void>("DELETE", `/alumnos/${alumnoId}/certificado`);
}

/** URL firmada de 2 minutos para abrir el certificado */
export async function urlCertificadoRemoto(alumnoId: string) {
  return (await llamar<{ url: string }>("GET", `/alumnos/${alumnoId}/certificado/url`)).url;
}
