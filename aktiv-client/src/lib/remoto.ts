"use client";

import { toast } from "sonner";
import * as http from "./api";
import { ErrorHttp, api } from "./api";
import type {
  Alumno,
  CategoriaEjercicio,
  Carrera,
  Certificado,
  EjercicioCustom,
  Bloque,
  Inscripcion,
  Session,
  TipoPlan,
} from "./types";

/**
 * Persistencia contra la API de Aktiv (NestJS).
 *
 * El store mantiene todo en memoria (la UI es instantánea) y esta capa:
 *  - carga los datos al iniciar sesión (la API decide qué ve cada usuario),
 *  - detecta qué cambió respecto de lo último que sabemos del servidor y manda
 *    solo esas diferencias a los endpoints REST (POST / PATCH / DELETE), con
 *    debounce. Los PATCH llevan solo los campos que cambiaron.
 *
 * Así el resto de la app no sabe que hay un servidor.
 */

export type Datos = {
  alumnos: Alumno[];
  carreras: Carrera[];
  inscripciones: Inscripcion[];
  ejerciciosCustom: EjercicioCustom[];
  /** alumno vinculado a la cuenta, si el usuario es alumno */
  alumnoIdPropio?: string;
};

/* ───────────── Sesión y carga ───────────── */

export async function iniciarSesion(
  email: string,
  clave: string,
): Promise<{ session: Session } | { error: string }> {
  try {
    return { session: await http.login(email, clave) };
  } catch (e) {
    if (e instanceof ErrorHttp) return { error: e.message };
    return { error: "No pudimos iniciar sesión. Probá de nuevo en un momento." };
  }
}

export const invitar = http.invitar;
export const entregarCredenciales = http.entregarCredenciales;
export const cambiarClave = http.cambiarClave;
export const consultarInvitacion = http.consultarInvitacion;

export async function aceptarInvitacion(
  token: string,
  clave: string,
): Promise<{ session: Session } | { error: string }> {
  try {
    return { session: await http.aceptarInvitacion(token, clave) };
  } catch (e) {
    if (e instanceof ErrorHttp) return { error: e.message };
    return { error: "No pudimos guardar tu contraseña. Probá de nuevo en un momento." };
  }
}

export const cerrarSesion = http.logout;
export const obtenerSesion = http.sesionActual;

/** avisa cuando la sesión ya no se puede renovar (venció, se cerró en otro lado) */
export const alCerrarSesion = http.alPerderLaSesion;

export async function cargarDatos(): Promise<Datos> {
  const d = await http.cargarTodo();
  return {
    alumnos: d.alumnos,
    carreras: d.carreras,
    inscripciones: d.inscripciones,
    ejerciciosCustom: d.ejerciciosCustom,
    alumnoIdPropio: d.session.alumnoId,
  };
}

/* ───────────── Modelo "plano": una colección por recurso REST ───────────── */

type Mapa<T> = Map<string, T>;

type AlumnoPlano = Pick<
  Alumno,
  | "nombre"
  | "email"
  | "telefono"
  | "objetivo"
  | "nivel"
  | "activo"
  | "proximoPago"
  | "semana"
  | "notasProfe"
  | "notasAlumno"
>;
type FichaPlana = Pick<Alumno["ficha"], "fechaNacimiento" | "lugarNacimiento" | "enfermedades" | "contacto">;
type LesionPlana = { alumnoId: string } & Omit<Alumno["ficha"]["lesiones"][number], "id">;
type MarcaPlana = { alumnoId: string } & Omit<Alumno["marcas"][number], "id">;
type PlanPlano = { alumnoId: string; nombre: string; tipo: TipoPlan; activo: boolean };
type EjercicioPlano = {
  planId: string;
  bloque: Bloque;
  descanso: string;
  nombre: string;
  series: number;
  repeticiones: string;
  peso: string;
  pesoFecha: string | null;
};
type CarreraPlana = Omit<Carrera, "id" | "coachId">;
type InscripcionPlana = Omit<Inscripcion, "id">;

type Entidades = {
  alumnos: Mapa<AlumnoPlano>;
  fichas: Mapa<FichaPlana>;
  /** vencimiento del certificado, solo para alumnos que tienen uno */
  certVenc: Mapa<string | null>;
  lesiones: Mapa<LesionPlana>;
  marcas: Mapa<MarcaPlana>;
  planes: Mapa<PlanPlano>;
  ejercicios: Mapa<EjercicioPlano>;
  carreras: Mapa<CarreraPlana>;
  inscripciones: Mapa<InscripcionPlana>;
  custom: Mapa<{ nombre: string; categoria: CategoriaEjercicio }>;
};

const SEMANA_VACIA = Array.from({ length: 7 }, () => ({ correr: false, fuerza: false }));
const FICHA_VACIA: FichaPlana = {
  fechaNacimiento: null,
  lugarNacimiento: "",
  enfermedades: "",
  contacto: { nombre: "", parentesco: "", telefono: "" },
};

function aEntidades(d: Omit<Datos, "alumnoIdPropio">): Entidades {
  const e: Entidades = {
    alumnos: new Map(),
    fichas: new Map(),
    certVenc: new Map(),
    lesiones: new Map(),
    marcas: new Map(),
    planes: new Map(),
    ejercicios: new Map(),
    carreras: new Map(),
    inscripciones: new Map(),
    custom: new Map(),
  };
  for (const a of d.alumnos) {
    e.alumnos.set(a.id, {
      nombre: a.nombre,
      email: a.email,
      telefono: a.telefono,
      objetivo: a.objetivo,
      nivel: a.nivel,
      activo: a.activo,
      proximoPago: a.proximoPago,
      semana: a.semana,
      notasProfe: a.notasProfe,
      notasAlumno: a.notasAlumno,
    });
    e.fichas.set(a.id, {
      fechaNacimiento: a.ficha.fechaNacimiento,
      lugarNacimiento: a.ficha.lugarNacimiento,
      enfermedades: a.ficha.enfermedades,
      contacto: a.ficha.contacto,
    });
    if (a.ficha.certificado) e.certVenc.set(a.id, a.ficha.certificado.vencimiento);
    for (const l of a.ficha.lesiones) {
      e.lesiones.set(l.id, { alumnoId: a.id, descripcion: l.descripcion, fecha: l.fecha, estado: l.estado });
    }
    for (const m of a.marcas) {
      e.marcas.set(m.id, {
        alumnoId: a.id,
        distanciaKm: m.distanciaKm,
        tiempoSeg: m.tiempoSeg,
        fecha: m.fecha,
        carrera: m.carrera,
      });
    }
    for (const p of a.planes) {
      e.planes.set(p.id, { alumnoId: a.id, nombre: p.nombre, tipo: p.tipo, activo: p.activo });
      for (const x of p.ejercicios) {
        e.ejercicios.set(x.id, {
          planId: p.id,
          bloque: x.bloque,
          descanso: x.descanso,
          nombre: x.nombre,
          series: x.series,
          repeticiones: x.repeticiones,
          peso: x.peso ?? "",
          pesoFecha: x.pesoFecha ?? null,
        });
      }
    }
  }
  for (const c of d.carreras) {
    e.carreras.set(c.id, {
      nombre: c.nombre,
      fecha: c.fecha,
      lugar: c.lugar,
      distanciasKm: c.distanciasKm,
      notas: c.notas,
    });
  }
  for (const i of d.inscripciones) {
    e.inscripciones.set(i.id, {
      alumnoId: i.alumnoId,
      carreraId: i.carreraId,
      distanciaKm: i.distanciaKm,
      objetivoSeg: i.objetivoSeg,
      resultadoSeg: i.resultadoSeg,
    });
  }
  for (const c of d.ejerciciosCustom) e.custom.set(c.id, { nombre: c.nombre, categoria: c.categoria });
  return e;
}

/** campos que cambiaron entre lo que sabe el servidor y lo que hay ahora */
function cambios<T extends object>(previo: T, actual: T, claves: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of claves) {
    if (JSON.stringify(previo[k]) !== JSON.stringify(actual[k])) out[k] = actual[k];
  }
  return out;
}

const hayClaves = (o: object) => Object.keys(o).length > 0;

/* ───────────── Envío de diferencias ───────────── */

async function enviar(prev: Entidades, act: Entidades) {
  // Orden: altas (padres antes que hijos), cambios y bajas (hijos antes que padres).
  // Las altas van de a una: el servidor numera el orden de planes y ejercicios.

  const altas = async <T>(
    previo: Mapa<T>,
    actual: Mapa<T>,
    enviarAlta: (id: string, v: T) => Promise<unknown>,
    trasAlta?: (id: string, v: T) => void,
  ) => {
    for (const [id, v] of actual) {
      if (previo.has(id)) continue;
      await enviarAlta(id, v);
      previo.set(id, v);
      trasAlta?.(id, v);
    }
  };

  // ---- altas
  await altas(
    prev.alumnos,
    act.alumnos,
    (id, a) =>
      api.post("/alumnos", {
        id,
        nombre: a.nombre,
        email: a.email,
        telefono: a.telefono,
        objetivo: a.objetivo,
        nivel: a.nivel,
      }),
    (id, a) => {
      // el servidor crea el alumno con valores por defecto y su ficha vacía: lo demás va como cambio
      prev.alumnos.set(id, {
        ...a,
        activo: true,
        proximoPago: null,
        semana: SEMANA_VACIA,
        notasProfe: "",
        notasAlumno: "",
      });
      prev.fichas.set(id, FICHA_VACIA);
    },
  );
  await altas(prev.planes, act.planes, (id, p) =>
    api.post(`/alumnos/${p.alumnoId}/planes`, { id, nombre: p.nombre, tipo: p.tipo, activo: p.activo }),
  );
  await altas(prev.ejercicios, act.ejercicios, (id, x) =>
    api.post(`/planes/${x.planId}/ejercicios`, {
      id,
      bloque: x.bloque,
      ...(x.descanso !== "" ? { descanso: x.descanso } : {}),
      nombre: x.nombre,
      series: x.series,
      repeticiones: x.repeticiones,
      ...(x.peso !== "" ? { peso: x.peso } : {}),
      ...(x.pesoFecha ? { pesoFecha: x.pesoFecha } : {}),
    }),
  );
  await altas(prev.carreras, act.carreras, (id, c) =>
    api.post("/carreras", {
      id,
      nombre: c.nombre,
      fecha: c.fecha,
      lugar: c.lugar,
      distanciasKm: c.distanciasKm,
      notas: c.notas,
    }),
  );
  await altas(prev.lesiones, act.lesiones, (id, l) =>
    api.post(`/alumnos/${l.alumnoId}/lesiones`, {
      id,
      descripcion: l.descripcion,
      fecha: l.fecha,
      estado: l.estado,
    }),
  );
  await altas(prev.marcas, act.marcas, (id, m) =>
    api.post(`/alumnos/${m.alumnoId}/marcas`, {
      id,
      distanciaKm: m.distanciaKm,
      tiempoSeg: m.tiempoSeg,
      fecha: m.fecha,
      carrera: m.carrera,
    }),
  );
  await altas(
    prev.inscripciones,
    act.inscripciones,
    (id, i) =>
      api.post(`/alumnos/${i.alumnoId}/inscripciones`, {
        id,
        carreraId: i.carreraId,
        distanciaKm: i.distanciaKm,
        objetivoSeg: i.objetivoSeg,
      }),
    (id, i) => prev.inscripciones.set(id, { ...i, resultadoSeg: null }),
  );
  await altas(prev.custom, act.custom, (id, c) => api.post("/catalogo/ejercicios", { id, nombre: c.nombre, categoria: c.categoria }));

  // ---- cambios (solo los campos modificados)
  const parches: Promise<unknown>[] = [];
  const parchar = <T extends object>(
    previo: Mapa<T>,
    actual: Mapa<T>,
    claves: (keyof T)[],
    ruta: (id: string) => string,
    adaptar?: (c: Partial<T>, v: T) => object,
  ) => {
    for (const [id, v] of actual) {
      const p = previo.get(id);
      if (!p) continue;
      const c = cambios(p, v, claves);
      const cuerpo = adaptar ? adaptar(c, v) : c;
      if (!hayClaves(cuerpo)) continue;
      parches.push(api.patch(ruta(id), cuerpo).then(() => previo.set(id, v)));
    }
  };
  parchar(
    prev.alumnos,
    act.alumnos,
    ["nombre", "email", "telefono", "objetivo", "nivel", "activo", "proximoPago", "semana", "notasProfe", "notasAlumno"],
    (id) => `/alumnos/${id}`,
  );
  parchar(prev.fichas, act.fichas, ["fechaNacimiento", "lugarNacimiento", "enfermedades", "contacto"], (id) => `/alumnos/${id}/ficha`);
  for (const [id, venc] of act.certVenc) {
    if (prev.certVenc.has(id) && prev.certVenc.get(id) !== venc) {
      parches.push(api.patch(`/alumnos/${id}/certificado`, { vencimiento: venc }).then(() => prev.certVenc.set(id, venc)));
    }
  }
  parchar(prev.lesiones, act.lesiones, ["descripcion", "fecha", "estado"], (id) => `/lesiones/${id}`);
  parchar(prev.marcas, act.marcas, ["distanciaKm", "tiempoSeg", "fecha", "carrera"], (id) => `/marcas/${id}`);
  // activar un plan desactiva en la base el de su mismo tipo: sirve tanto el orden en que lleguen
  parchar(prev.planes, act.planes, ["nombre", "activo"], (id) => `/planes/${id}`);
  parchar(
    prev.ejercicios,
    act.ejercicios,
    ["bloque", "nombre", "series", "repeticiones", "descanso", "peso", "pesoFecha"],
    (id) => `/ejercicios/${id}`,
    (c) => {
      // pesoFecha nunca vuelve a null: solo se manda cuando hay una fecha
      const { pesoFecha, ...resto } = c;
      return pesoFecha ? { ...resto, pesoFecha } : resto;
    },
  );
  parchar(prev.custom, act.custom, ["nombre", "categoria"], (id) => `/catalogo/ejercicios/${id}`);
  parchar(prev.carreras, act.carreras, ["nombre", "fecha", "lugar", "distanciasKm", "notas"], (id) => `/carreras/${id}`);
  parchar(prev.inscripciones, act.inscripciones, ["distanciaKm", "objetivoSeg", "resultadoSeg"], (id) => `/inscripciones/${id}`);
  await Promise.all(parches);

  // ---- bajas (hijos antes que padres)
  const bajas: Promise<unknown>[] = [];
  const borrar = <T>(previo: Mapa<T>, actual: Mapa<T>, ruta: (id: string) => string) => {
    for (const id of [...previo.keys()]) {
      if (actual.has(id)) continue;
      bajas.push(api.delete(ruta(id)).then(() => previo.delete(id)));
    }
  };
  borrar(prev.ejercicios, act.ejercicios, (id) => `/ejercicios/${id}`);
  borrar(prev.inscripciones, act.inscripciones, (id) => `/inscripciones/${id}`);
  borrar(prev.marcas, act.marcas, (id) => `/marcas/${id}`);
  borrar(prev.lesiones, act.lesiones, (id) => `/lesiones/${id}`);
  borrar(prev.planes, act.planes, (id) => `/planes/${id}`);
  await Promise.all(bajas.splice(0));
  borrar(prev.carreras, act.carreras, (id) => `/carreras/${id}`);
  borrar(prev.custom, act.custom, (id) => `/catalogo/ejercicios/${id}`);
  await Promise.all(bajas.splice(0));
  // al borrar un alumno el servidor borra todo lo suyo (ficha, certificado, planes…)
  for (const id of [...prev.alumnos.keys()]) {
    if (act.alumnos.has(id)) continue;
    await api.delete(`/alumnos/${id}`);
    prev.alumnos.delete(id);
    prev.fichas.delete(id);
    prev.certVenc.delete(id);
  }
}

/* ───────────── Sincronización con debounce ───────────── */

type Contexto = {
  obtener: () => { datos: Omit<Datos, "alumnoIdPropio"> } | null;
  /** el servidor rechazó algo: hay que volver a leer */
  alFallar: () => void;
};

let ctx: Contexto | null = null;
let base: Entidades | null = null;
let temporizador: ReturnType<typeof setTimeout> | undefined;
let enCurso: Promise<void> | null = null;
let pendiente = false;

export function configurarSync(contexto: Contexto) {
  ctx = contexto;
}

/** Lo que sabemos que hay en el servidor (se fija al cargar) */
export function fijarBase(datos: Datos) {
  base = aEntidades(datos);
}

export function limpiarBase() {
  base = null;
  clearTimeout(temporizador);
  temporizador = undefined;
}

export function hayCambiosPendientes() {
  return enCurso !== null || pendiente || temporizador !== undefined;
}

export function programarSync() {
  if (!base) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => void sincronizar(), 600);
}

/**
 * Manda los cambios pendientes. La promesa se resuelve cuando terminó el
 * guardado (incluido lo que se editó mientras tanto), así que se puede esperar
 * antes de operaciones que dependen de que el dato ya exista en el servidor.
 */
export function sincronizar(): Promise<void> {
  clearTimeout(temporizador);
  temporizador = undefined;
  if (!base || !ctx) return Promise.resolve();
  if (enCurso) {
    pendiente = true;
    return enCurso;
  }
  const contexto = ctx;
  enCurso = (async () => {
    try {
      do {
        pendiente = false;
        const actual = contexto.obtener();
        if (!actual || !base) break;
        await enviar(base, aEntidades(actual.datos));
      } while (pendiente);
    } catch (e) {
      console.error("Error al sincronizar con la API", e);
      const sesionPerdida = e instanceof ErrorHttp && e.status === 401;
      if (!sesionPerdida) {
        toast.error(
          e instanceof ErrorHttp && e.status > 0 && e.status < 500
            ? `${e.message} Volvimos a cargar tus datos.`
            : "No se pudieron guardar los últimos cambios. Volvimos a cargar tus datos.",
        );
        contexto.alFallar();
      }
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

/* ───────────── Certificado médico ───────────── */

/** Sube el archivo; la API valida el contenido y actualiza la ficha */
export async function subirCertificado(
  alumnoId: string,
  archivo: File,
  vencimiento: string | null,
): Promise<Certificado> {
  const cert = await http.subirCertificado(alumnoId, archivo, vencimiento);
  // el servidor ya guardó el vencimiento: que el próximo diff no lo vuelva a mandar
  base?.certVenc.set(alumnoId, cert.vencimiento);
  return cert;
}

export async function quitarCertificado(alumnoId: string) {
  await http.quitarCertificadoRemoto(alumnoId);
  base?.certVenc.delete(alumnoId);
}

export const urlCertificado = http.urlCertificadoRemoto;
