"use client";

import { useSyncExternalStore } from "react";
import type { z } from "zod";
import { catalogoCompleto, fichaVacia, semanaVacia } from "./dominio";
import { hoyISO, nuevoId } from "./format";
import * as remoto from "./remoto";
import {
  actualizarAlumnoDto,
  actualizarEjercicioDto,
  actualizarFichaDto,
  crearAlumnoDto,
  crearCarreraDto,
  crearEjercicioCustomDto,
  crearPlanDto,
  inscribirAlumnoDto,
  inscripcionSchema,
  lesionSchema,
  marcaSchema,
  nuevaMarcaSchema,
  planSchema,
  registrarResultadoDto,
  subirCertificadoDto,
  validar,
} from "./schemas";
import type {
  Alumno,
  CategoriaEjercicio,
  Carrera,
  Ejercicio,
  EjercicioCustom,
  FichaMedica,
  Inscripcion,
  Lesion,
  Marca,
  Plan,
  Session,
  Bloque,
  TipoPlan,
} from "./types";

/**
 * Store de la app. Todo vive en memoria (la UI responde al instante) y cada
 * cambio se sincroniza solo con la API de NestJS (ver remoto.ts), que decide
 * qué puede ver y editar cada usuario. No hay datos de ejemplo: lo que se ve
 * es lo que hay en la base.
 */

type State = {
  session: Session | null;
  alumnos: Alumno[];
  carreras: Carrera[];
  inscripciones: Inscripcion[];
  /** ejercicios que el profe creó al armar planes */
  ejerciciosCustom: EjercicioCustom[];
  /** ya se resolvió la sesión y se cargaron los datos */
  listo: boolean;
};

const SERVER_STATE: State = {
  session: null,
  alumnos: [],
  carreras: [],
  inscripciones: [],
  ejerciciosCustom: [],
  listo: false,
};

let state: State = SERVER_STATE;
const listeners = new Set<() => void>();

/* ───────────── Núcleo del store ───────────── */

function notificar() {
  listeners.forEach((l) => l());
}

/** cambia el estado sin sincronizar (carga inicial, login, logout, recargas) */
function publicar(next: State) {
  state = next;
  notificar();
}

/** cambia el estado y programa el guardado en la API */
function set(next: State) {
  state = next;
  remoto.programarSync();
  notificar();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
}

/** false en el servidor y durante la hidratación */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/* ───────────── Arranque y sesión ───────────── */

let iniciando: Promise<void> | null = null;

/** Recupera la sesión (cookie) y carga los datos. Llamar una vez. */
export function iniciarStore() {
  if (iniciando) return iniciando;

  remoto.configurarSync({
    obtener: () =>
      state.session
        ? {
            datos: {
              alumnos: state.alumnos,
              carreras: state.carreras,
              inscripciones: state.inscripciones,
              ejerciciosCustom: state.ejerciciosCustom,
            },
          }
        : null,
    alFallar: () => void recargarDatos(true),
  });
  remoto.alCerrarSesion(() => {
    if (state.session) vaciar();
  });
  // si el profe y el alumno editan a la vez, al volver a la pestaña se actualiza
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void remoto.sincronizar();
    else void recargarDatos(false);
  });

  iniciando = (async () => {
    try {
      const session = await remoto.obtenerSesion();
      if (session) await aplicarSesion(session);
      else publicar({ ...state, listo: true });
    } catch (e) {
      console.error("No se pudo iniciar la sesión guardada", e);
      publicar({ ...SERVER_STATE, listo: true });
    }
  })();
  return iniciando;
}

async function aplicarSesion(session: Session) {
  const datos = await remoto.cargarDatos();
  remoto.fijarBase(datos);
  publicar({
    session: { ...session, alumnoId: datos.alumnoIdPropio },
    alumnos: datos.alumnos,
    carreras: datos.carreras,
    inscripciones: datos.inscripciones,
    ejerciciosCustom: datos.ejerciciosCustom,
    listo: true,
  });
}

async function recargarDatos(forzar: boolean) {
  if (!state.session) return;
  if (!forzar && remoto.hayCambiosPendientes()) return;
  try {
    const datos = await remoto.cargarDatos();
    remoto.fijarBase(datos);
    publicar({
      ...state,
      alumnos: datos.alumnos,
      carreras: datos.carreras,
      inscripciones: datos.inscripciones,
      ejerciciosCustom: datos.ejerciciosCustom,
    });
  } catch (e) {
    console.error("No se pudo recargar", e);
  }
}

function vaciar() {
  remoto.limpiarBase();
  publicar({ ...SERVER_STATE, listo: true });
}

export type ResultadoLogin =
  | { ok: true; session: Session }
  | { ok: false; error: string };

export async function login(usuario: string, clave: string): Promise<ResultadoLogin> {
  const r = await remoto.iniciarSesion(usuario, clave);
  if ("error" in r) return { ok: false, error: r.error };
  try {
    await aplicarSesion(r.session);
  } catch (e) {
    console.error("No se pudieron cargar los datos", e);
    await remoto.cerrarSesion();
    return { ok: false, error: "No pudimos cargar tus datos. Probá de nuevo." };
  }
  return { ok: true, session: state.session! };
}

export async function logout() {
  await remoto.sincronizar();
  await remoto.cerrarSesion();
  vaciar();
}

/* ───────────── Invitaciones ───────────── */

/**
 * El profe invita (o reenvía el acceso) a un alumno: la API crea su cuenta y le
 * manda un mail con un enlace para elegir contraseña. Lanza un ErrorHttp con un
 * mensaje listo para mostrar si algo falla.
 */
export async function invitarAlumno(alumnoId: string) {
  // el alumno (y su email, si se acaba de cargar) tiene que estar ya en el servidor
  await remoto.sincronizar();
  const r = await remoto.invitar(alumnoId);
  // trae la cuenta recién vinculada y el estado del acceso
  await recargarDatos(true);
  return r;
}

/**
 * El profe le da el acceso a un alumno con una contraseña aleatoria (o se la restablece si ya
 * tenía cuenta). Devuelve email y contraseña: se muestran una sola vez y no se guardan en el navegador.
 */
export async function entregarCredenciales(alumnoId: string) {
  await remoto.sincronizar();
  const r = await remoto.entregarCredenciales(alumnoId);
  await recargarDatos(true);
  return r;
}

/** Cambia la contraseña de quien tiene la sesión iniciada (profe o alumno). Lanza ErrorHttp con un mensaje listo. */
export const cambiarClave = remoto.cambiarClave;

/** El alumno abre el enlace del mail, elige su contraseña y queda con la sesión iniciada */
export async function aceptarInvitacion(token: string, clave: string): Promise<ResultadoLogin> {
  const r = await remoto.aceptarInvitacion(token, clave);
  if ("error" in r) return { ok: false, error: r.error };
  try {
    await aplicarSesion(r.session);
  } catch (e) {
    console.error("No se pudieron cargar los datos", e);
    return { ok: false, error: "Tu contraseña quedó guardada, pero no pudimos cargar tus datos. Iniciá sesión." };
  }
  return { ok: true, session: state.session! };
}

/* ───────────── Validación (contrato de datos) ───────────── */

/**
 * Altas: si los datos no cumplen el contrato es un error de quien llama (los
 * formularios ya validan con los DTOs), así que se corta con un mensaje claro.
 */
function exigir<S extends z.ZodType>(schema: S, datos: unknown): z.output<S> {
  const r = validar(schema, datos);
  if (!r.ok) throw new Error(r.error);
  return r.datos;
}

/**
 * Cambios mientras se escribe: si no cumplen el contrato se descartan sin
 * interrumpir (el input controlado simplemente no acepta ese carácter).
 */
function aceptar<S extends z.ZodType>(schema: S, cambios: unknown): z.output<S> | null {
  const r = validar(schema, cambios);
  if (!r.ok) {
    console.warn("Cambio descartado:", r.error);
    return null;
  }
  return r.datos;
}

/* ───────────── Alumnos ───────────── */

export function actualizarAlumno(id: string, cambios: Partial<Alumno>) {
  const validos = aceptar(actualizarAlumnoDto, cambios);
  if (!validos) return;
  const s = getSnapshot();
  set({
    ...s,
    alumnos: s.alumnos.map((a) => (a.id === id ? { ...a, ...validos } : a)),
  });
}

export function crearAlumno(
  datos: Pick<Alumno, "nombre" | "email" | "telefono" | "objetivo" | "nivel">,
) {
  const s = getSnapshot();
  const alumno: Alumno = {
    id: nuevoId(),
    ...exigir(crearAlumnoDto, datos),
    activo: true,
    proximoPago: null,
    altaEn: hoyISO(),
    planes: [],
    semana: semanaVacia(),
    ficha: fichaVacia(),
    marcas: [],
    coachId: s.session?.userId,
    userId: null,
    acceso: { estado: "sin_cuenta", expiraEn: null },
    notasProfe: "",
    notasAlumno: "",
  };
  set({ ...s, alumnos: [alumno, ...s.alumnos] });
  return alumno;
}

/** Borra al alumno con todo lo suyo; si tenía cuenta de acceso, la API también la borra */
export function eliminarAlumno(id: string) {
  const s = getSnapshot();
  set({
    ...s,
    alumnos: s.alumnos.filter((a) => a.id !== id),
    inscripciones: s.inscripciones.filter((i) => i.alumnoId !== id),
  });
}

export function alternarDia(
  alumnoId: string,
  dia: number,
  tipo: "correr" | "fuerza",
) {
  editarAlumno(alumnoId, (a) => ({
    semana: a.semana.map((d, i) => (i === dia ? { ...d, [tipo]: !d[tipo] } : d)),
  }));
}

function editarAlumno(alumnoId: string, fn: (a: Alumno) => Partial<Alumno>) {
  const s = getSnapshot();
  set({
    ...s,
    alumnos: s.alumnos.map((a) => (a.id === alumnoId ? { ...a, ...fn(a) } : a)),
  });
}

/* ───────────── Catálogo ───────────── */

/** Suma un ejercicio al catálogo y devuelve el nombre canónico (sin duplicar) */
export function crearEjercicioPersonalizado(nombre: string, categoria: CategoriaEjercicio) {
  const s = getSnapshot();
  const dto = exigir(crearEjercicioCustomDto, { nombre: nombre.trim(), categoria });
  const existente = catalogoCompleto(s.ejerciciosCustom)
    .map((e) => e.nombre)
    .find((n) => n.toLowerCase() === dto.nombre.toLowerCase());
  if (existente) return existente;
  set({
    ...s,
    ejerciciosCustom: [...s.ejerciciosCustom, { id: nuevoId(), ...dto }],
  });
  return dto.nombre;
}

/**
 * Renombra un ejercicio del profe o le cambia la categoría. Si cambia el nombre, los planes
 * que ya lo usan se renombran también. Devuelve un mensaje si no se puede (nombre repetido).
 */
export function editarEjercicioPersonalizado(
  id: string,
  cambios: { nombre?: string; categoria?: CategoriaEjercicio },
): string | null {
  const s = getSnapshot();
  const actual = s.ejerciciosCustom.find((e) => e.id === id);
  if (!actual) return "No encontramos ese ejercicio";
  const dto = exigir(crearEjercicioCustomDto, {
    nombre: (cambios.nombre ?? actual.nombre).trim(),
    categoria: cambios.categoria ?? actual.categoria,
  });
  const repetido = catalogoCompleto(s.ejerciciosCustom).some(
    (e) => e.nombre.toLowerCase() === dto.nombre.toLowerCase() && e.nombre !== actual.nombre,
  );
  if (repetido) return "Ese ejercicio ya está en la lista";
  set({
    ...s,
    ejerciciosCustom: s.ejerciciosCustom.map((e) => (e.id === id ? { ...e, ...dto } : e)),
    alumnos:
      dto.nombre === actual.nombre
        ? s.alumnos
        : s.alumnos.map((a) => ({
            ...a,
            planes: a.planes.map((p) => ({
              ...p,
              ejercicios: p.ejercicios.map((x) => (x.nombre === actual.nombre ? { ...x, nombre: dto.nombre } : x)),
            })),
          })),
  });
  return null;
}

/** Saca un ejercicio de la lista del profe. Los planes que ya lo usan lo conservan. */
export function eliminarEjercicioPersonalizado(id: string) {
  const s = getSnapshot();
  set({ ...s, ejerciciosCustom: s.ejerciciosCustom.filter((e) => e.id !== id) });
}

/* ───────────── Planes ───────────── */

/** El primer plan de cada tipo queda activo (es el que ve el alumno); los demás quedan de borrador */
export function crearPlan(alumnoId: string, nombre: string, tipo: TipoPlan) {
  const datos = exigir(crearPlanDto, { nombre, tipo });
  const alumno = getSnapshot().alumnos.find((a) => a.id === alumnoId);
  const hayActivo = alumno?.planes.some((p) => p.tipo === datos.tipo && p.activo) ?? false;
  const plan: Plan = { id: nuevoId(), ...datos, activo: !hayActivo, ejercicios: [] };
  editarAlumno(alumnoId, (a) => ({ planes: [...a.planes, plan] }));
  return plan;
}

export function renombrarPlan(alumnoId: string, planId: string, nombre: string) {
  if (aceptar(planSchema.shape.nombre, nombre) === null) return;
  editarAlumno(alumnoId, (a) => ({
    planes: a.planes.map((p) => (p.id === planId ? { ...p, nombre } : p)),
  }));
}

/** Si se borra el plan activo, el siguiente de su mismo tipo pasa a ser el activo */
export function eliminarPlan(alumnoId: string, planId: string) {
  editarAlumno(alumnoId, (a) => {
    const borrado = a.planes.find((p) => p.id === planId);
    const planes = a.planes.filter((p) => p.id !== planId);
    if (!borrado?.activo) return { planes };
    const heredero = planes.find((p) => p.tipo === borrado.tipo);
    return { planes: planes.map((p) => (p.id === heredero?.id ? { ...p, activo: true } : p)) };
  });
}

/** Deja activo este plan y desactiva el que estaba activo de su mismo tipo */
export function activarPlan(alumnoId: string, planId: string) {
  editarAlumno(alumnoId, (a) => {
    const objetivo = a.planes.find((p) => p.id === planId);
    if (!objetivo) return {};
    return {
      planes: a.planes.map((p) =>
        p.tipo !== objetivo.tipo ? p : { ...p, activo: p.id === planId },
      ),
    };
  });
}

function editarPlan(
  alumnoId: string,
  planId: string,
  fn: (ejercicios: Ejercicio[]) => Ejercicio[],
) {
  editarAlumno(alumnoId, (a) => ({
    planes: a.planes.map((p) =>
      p.id === planId ? { ...p, ejercicios: fn(p.ejercicios) } : p,
    ),
  }));
}

export function agregarEjercicio(alumnoId: string, planId: string, bloque: Bloque = "Entrenamiento") {
  editarPlan(alumnoId, planId, (ej) => [
    ...ej,
    { id: nuevoId(), bloque, nombre: "", series: 3, repeticiones: "10", descanso: "" },
  ]);
}

export function actualizarEjercicio(
  alumnoId: string,
  planId: string,
  ejercicioId: string,
  cambios: Partial<Ejercicio>,
) {
  const validos = aceptar(actualizarEjercicioDto, cambios);
  if (!validos) return;
  editarPlan(alumnoId, planId, (ej) =>
    ej.map((e) => (e.id === ejercicioId ? { ...e, ...validos } : e)),
  );
}

export function quitarEjercicio(
  alumnoId: string,
  planId: string,
  ejercicioId: string,
) {
  editarPlan(alumnoId, planId, (ej) => ej.filter((e) => e.id !== ejercicioId));
}

/* ───────────── Ficha médica ───────────── */

export function actualizarFicha(alumnoId: string, cambios: Partial<FichaMedica>) {
  const validos = aceptar(actualizarFichaDto, cambios);
  if (!validos) return;
  editarAlumno(alumnoId, (a) => ({ ficha: { ...a.ficha, ...validos } }));
}

export function agregarLesion(alumnoId: string, datos: Omit<Lesion, "id">) {
  const lesion = exigir(lesionSchema.omit({ id: true }), datos);
  editarAlumno(alumnoId, (a) => ({
    ficha: {
      ...a.ficha,
      lesiones: [...a.ficha.lesiones, { id: nuevoId(), ...lesion }],
    },
  }));
}

export function actualizarLesion(
  alumnoId: string,
  lesionId: string,
  cambios: Partial<Lesion>,
) {
  const validos = aceptar(lesionSchema.omit({ id: true }).partial(), cambios);
  if (!validos) return;
  editarAlumno(alumnoId, (a) => ({
    ficha: {
      ...a.ficha,
      lesiones: a.ficha.lesiones.map((l) =>
        l.id === lesionId ? { ...l, ...validos } : l,
      ),
    },
  }));
}

export function quitarLesion(alumnoId: string, lesionId: string) {
  editarAlumno(alumnoId, (a) => ({
    ficha: {
      ...a.ficha,
      lesiones: a.ficha.lesiones.filter((l) => l.id !== lesionId),
    },
  }));
}

/* ───────────── Certificado médico ───────────── */

export async function subirCertificado(
  alumnoId: string,
  archivo: File,
  vencimiento: string | null,
) {
  // tipo, tamaño y vencimiento se validan con el contrato antes de subir nada
  const meta = exigir(subirCertificadoDto, {
    tipo: archivo.type,
    tamano: archivo.size,
    vencimiento,
  });
  // el alumno tiene que existir en el servidor antes de subirle un archivo
  await remoto.sincronizar();
  // la API valida el contenido real del archivo y actualiza la ficha
  const certificado = await remoto.subirCertificado(alumnoId, archivo, meta.vencimiento);
  actualizarFicha(alumnoId, { certificado });
}

export async function quitarCertificado(alumnoId: string) {
  await remoto.sincronizar();
  await remoto.quitarCertificado(alumnoId);
  actualizarFicha(alumnoId, { certificado: null });
}

/** URL temporal (2 minutos) para abrir el certificado de un alumno en una pestaña nueva */
export function urlCertificado(alumnoId: string) {
  return remoto.urlCertificado(alumnoId);
}

/* ───────────── Marcas ───────────── */

export function agregarMarca(alumnoId: string, datos: Omit<Marca, "id">) {
  const marca = exigir(nuevaMarcaSchema, datos);
  editarAlumno(alumnoId, (a) => ({
    marcas: [...a.marcas, { id: nuevoId(), ...marca }],
  }));
}

export function actualizarMarca(
  alumnoId: string,
  marcaId: string,
  cambios: Partial<Marca>,
) {
  const validos = aceptar(marcaSchema.omit({ id: true }).partial(), cambios);
  if (!validos) return;
  editarAlumno(alumnoId, (a) => ({
    marcas: a.marcas.map((m) => (m.id === marcaId ? { ...m, ...validos } : m)),
  }));
}

export function quitarMarca(alumnoId: string, marcaId: string) {
  editarAlumno(alumnoId, (a) => ({
    marcas: a.marcas.filter((m) => m.id !== marcaId),
  }));
}

/* ───────────── Carreras (calendario del profe) ───────────── */

export function crearCarrera(
  datos: Pick<Carrera, "nombre" | "fecha" | "lugar" | "distanciasKm" | "notas">,
) {
  const s = getSnapshot();
  const carrera: Carrera = {
    id: nuevoId(),
    ...exigir(crearCarreraDto, datos),
    coachId: s.session?.userId,
  };
  set({ ...s, carreras: [...s.carreras, carrera] });
  return carrera;
}

export function actualizarCarrera(id: string, cambios: Partial<Carrera>) {
  const validos = aceptar(crearCarreraDto.partial(), cambios);
  if (!validos) return;
  const s = getSnapshot();
  set({
    ...s,
    carreras: s.carreras.map((c) => (c.id === id ? { ...c, ...validos } : c)),
  });
}

/** Borra la carrera y las inscripciones de los alumnos a esa carrera */
export function quitarCarrera(id: string) {
  const s = getSnapshot();
  set({
    ...s,
    carreras: s.carreras.filter((c) => c.id !== id),
    inscripciones: s.inscripciones.filter((i) => i.carreraId !== id),
  });
}

/* ───────────── Inscripciones (alumno ↔ carrera) ───────────── */

export function inscribirAlumno(
  alumnoId: string,
  carreraId: string,
  distanciaKm: number,
  objetivoSeg: number | null,
) {
  const s = getSnapshot();
  const carrera = s.carreras.find((c) => c.id === carreraId);
  if (!carrera) throw new Error("La carrera no existe");
  if (s.inscripciones.some((i) => i.alumnoId === alumnoId && i.carreraId === carreraId)) {
    throw new Error("El alumno ya está anotado en esa carrera");
  }
  // la distancia tiene que ser una de las que ofrece la carrera
  const dto = exigir(inscribirAlumnoDto(carrera.distanciasKm), { distanciaKm, objetivoSeg });
  const inscripcion: Inscripcion = {
    id: nuevoId(),
    alumnoId,
    carreraId,
    distanciaKm: dto.distanciaKm,
    objetivoSeg: dto.objetivoSeg,
    resultadoSeg: null,
  };
  set({ ...s, inscripciones: [...s.inscripciones, inscripcion] });
  return inscripcion;
}

export function actualizarInscripcion(id: string, cambios: Partial<Inscripcion>) {
  const validos = aceptar(
    inscripcionSchema.omit({ id: true, alumnoId: true, carreraId: true }).partial(),
    cambios,
  );
  if (!validos) return;
  const s = getSnapshot();
  set({
    ...s,
    inscripciones: s.inscripciones.map((i) => (i.id === id ? { ...i, ...validos } : i)),
  });
}

export function quitarInscripcion(id: string) {
  const s = getSnapshot();
  set({ ...s, inscripciones: s.inscripciones.filter((i) => i.id !== id) });
}

/** Anota el tiempo real y, si se pide, lo suma a las marcas del alumno */
export function registrarResultado(
  inscripcionId: string,
  resultadoSeg: number,
  sumarAMarcas: boolean,
) {
  const dto = exigir(registrarResultadoDto, { resultadoSeg, sumarAMarcas });
  const s = getSnapshot();
  const inscripcion = s.inscripciones.find((i) => i.id === inscripcionId);
  const carrera = s.carreras.find((c) => c.id === inscripcion?.carreraId);
  if (!inscripcion || !carrera) return;
  set({
    ...s,
    inscripciones: s.inscripciones.map((i) =>
      i.id === inscripcionId ? { ...i, resultadoSeg: dto.resultadoSeg } : i,
    ),
    alumnos: dto.sumarAMarcas
      ? s.alumnos.map((a) =>
          a.id === inscripcion.alumnoId
            ? {
                ...a,
                marcas: [
                  ...a.marcas,
                  {
                    id: nuevoId(),
                    distanciaKm: inscripcion.distanciaKm,
                    tiempoSeg: dto.resultadoSeg,
                    fecha: carrera.fecha,
                    carrera: carrera.nombre,
                  },
                ],
              }
            : a,
        )
      : s.alumnos,
  });
}
