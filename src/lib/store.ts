"use client";

import { useSyncExternalStore } from "react";
import { CUENTAS, crearCalendarioSemilla, crearSemilla } from "./data";
import { EJERCICIOS_CATALOGO, fichaVacia, semanaVacia } from "./dominio";
import { hoyISO, nuevoId } from "./format";
import * as remoto from "./remoto";
import { z } from "zod";
import {
  actualizarAlumnoDto,
  alumnoSchema,
  carreraSchema,
  actualizarEjercicioDto,
  actualizarFichaDto,
  crearAlumnoDto,
  crearCarreraDto,
  crearPlanDto,
  ejercicioCustomSchema,
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
import { MODO_API } from "./modo";
import type {
  Alumno,
  Carrera,
  Certificado,
  Ejercicio,
  EjercicioCustom,
  FichaMedica,
  Inscripcion,
  Lesion,
  Marca,
  Plan,
  Session,
} from "./types";

/**
 * Store de la app. Todo vive en memoria (la UI responde al instante) y se
 * persiste según el modo:
 *  - API (NEXT_PUBLIC_MODO=api): ver remoto.ts. Cada cambio se sincroniza solo
 *    con la API de NestJS, que decide qué puede ver y editar cada usuario.
 *  - Demo (sin la variable): localStorage con datos falsos. Es transitorio.
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

const STORAGE_KEY = "aktiv-demo-v2";

const SERVER_STATE: State = {
  session: null,
  alumnos: [],
  carreras: [],
  inscripciones: [],
  ejerciciosCustom: [],
  listo: false,
};

let state: State = SERVER_STATE;
let cargadoLocal = false;
const listeners = new Set<() => void>();

/* ───────────── Persistencia local (modo demo) ───────────── */

function cargarLocal() {
  if (MODO_API || cargadoLocal || typeof window === "undefined") return;
  cargadoLocal = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State> & { ejerciciosCustom?: unknown[] };
      if (Array.isArray(parsed.alumnos)) {
        // completa lo que se guardó antes de que existieran semana, ficha, marcas y carreras
        const semilla = crearSemilla();
        // si se guardó antes del calendario de carreras, arrancamos con el de ejemplo
        const calendario = Array.isArray(parsed.inscripciones)
          ? null
          : crearCalendarioSemilla();
        const candidato: State = {
          session: parsed.session ?? null,
          alumnos: parsed.alumnos.map((a) => {
            const s = semilla.find((x) => x.id === a.id);
            return {
              ...a,
              semana: a.semana ?? s?.semana ?? semanaVacia(),
              ficha: a.ficha ? { ...fichaVacia(), ...a.ficha } : (s?.ficha ?? fichaVacia()),
              marcas: a.marcas ?? s?.marcas ?? [],
            };
          }),
          carreras: calendario ? calendario.carreras : (parsed.carreras ?? []),
          inscripciones: calendario ? calendario.inscripciones : (parsed.inscripciones ?? []),
          ejerciciosCustom: (parsed.ejerciciosCustom ?? []).map((e) =>
            typeof e === "string"
              ? { id: nuevoId(), nombre: e }
              : (e as EjercicioCustom),
          ),
          listo: true,
        };
        // lo guardado tiene que cumplir el contrato actual; si no (datos de una
        // versión vieja, edición a mano…), se descarta y se arranca limpio
        if (estadoCumpleContrato(candidato)) {
          state = candidato;
          return;
        }
        console.warn("Los datos guardados no cumplen el contrato actual: se reinician.");
      }
    }
  } catch {
    // storage bloqueado o corrupto: arrancamos desde la semilla
  }
  const calendario = crearCalendarioSemilla();
  state = {
    session: null,
    alumnos: crearSemilla(),
    carreras: calendario.carreras,
    inscripciones: calendario.inscripciones,
    ejerciciosCustom: [],
    listo: true,
  };
}

function estadoCumpleContrato(s: State) {
  return (
    z.array(alumnoSchema).safeParse(s.alumnos).success &&
    z.array(carreraSchema).safeParse(s.carreras).success &&
    z.array(inscripcionSchema).safeParse(s.inscripciones).success &&
    z.array(ejercicioCustomSchema).safeParse(s.ejerciciosCustom).success
  );
}

function guardarLocal(s: State) {
  try {
    const { listo: _listo, ...resto } = s;
    void _listo;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resto));
  } catch {
    // sin persistencia, la demo sigue funcionando en memoria
  }
}

/* ───────────── Núcleo del store ───────────── */

function notificar() {
  listeners.forEach((l) => l());
}

/** cambia el estado sin persistir (carga inicial, login, logout) */
function publicar(next: State) {
  state = next;
  notificar();
}

/** cambia el estado y lo persiste */
function set(next: State) {
  state = next;
  if (MODO_API) remoto.programarSync();
  else guardarLocal(next);
  notificar();
}

function subscribe(listener: () => void) {
  cargarLocal();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  cargarLocal();
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

/** Con la API: recupera la sesión (cookie) y carga los datos. Llamar una vez. */
export function iniciarStore() {
  if (!MODO_API) return Promise.resolve();
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
  if (!MODO_API || !state.session) return;
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
  if (!MODO_API) {
    const cuenta = CUENTAS[usuario.trim().toLowerCase()];
    if (!cuenta || cuenta.password !== clave) {
      return { ok: false, error: "Usuario o contraseña incorrectos." };
    }
    publicar({ ...getSnapshot(), session: cuenta.session });
    guardarLocal(state);
    return { ok: true, session: cuenta.session };
  }
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
  if (!MODO_API) {
    publicar({ ...getSnapshot(), session: null });
    guardarLocal(state);
    return;
  }
  await remoto.sincronizar();
  await remoto.cerrarSesion();
  vaciar();
}

/** Solo demo: vuelve a los datos de ejemplo */
export function resetDemo() {
  if (MODO_API) return;
  const calendario = crearCalendarioSemilla();
  set({
    session: getSnapshot().session,
    alumnos: crearSemilla(),
    carreras: calendario.carreras,
    inscripciones: calendario.inscripciones,
    ejerciciosCustom: [],
    listo: true,
  });
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
    planActivoId: null,
    semana: semanaVacia(),
    ficha: fichaVacia(),
    marcas: [],
    coachId: s.session?.userId,
    userId: null,
    notasProfe: "",
    notasAlumno: "",
  };
  set({ ...s, alumnos: [alumno, ...s.alumnos] });
  return alumno;
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
export function crearEjercicioPersonalizado(nombre: string) {
  const s = getSnapshot();
  const limpio = exigir(ejercicioCustomSchema.shape.nombre, nombre.trim());
  const existente = [
    ...EJERCICIOS_CATALOGO.map((e) => e.nombre),
    ...s.ejerciciosCustom.map((e) => e.nombre),
  ].find((n) => n.toLowerCase() === limpio.toLowerCase());
  if (existente) return existente;
  set({
    ...s,
    ejerciciosCustom: [...s.ejerciciosCustom, { id: nuevoId(), nombre: limpio }],
  });
  return limpio;
}

/* ───────────── Planes ───────────── */

export function crearPlan(alumnoId: string, nombre: string) {
  const plan: Plan = { id: nuevoId(), ...exigir(crearPlanDto, { nombre }), ejercicios: [] };
  editarAlumno(alumnoId, (a) => ({
    planes: [...a.planes, plan],
    planActivoId: a.planActivoId ?? plan.id,
  }));
  return plan;
}

export function renombrarPlan(alumnoId: string, planId: string, nombre: string) {
  if (aceptar(planSchema.shape.nombre, nombre) === null) return;
  editarAlumno(alumnoId, (a) => ({
    planes: a.planes.map((p) => (p.id === planId ? { ...p, nombre } : p)),
  }));
}

export function eliminarPlan(alumnoId: string, planId: string) {
  editarAlumno(alumnoId, (a) => {
    const planes = a.planes.filter((p) => p.id !== planId);
    return {
      planes,
      planActivoId:
        a.planActivoId === planId ? (planes[0]?.id ?? null) : a.planActivoId,
    };
  });
}

export function activarPlan(alumnoId: string, planId: string) {
  actualizarAlumno(alumnoId, { planActivoId: planId });
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

export function agregarEjercicio(alumnoId: string, planId: string) {
  editarPlan(alumnoId, planId, (ej) => [
    ...ej,
    { id: nuevoId(), nombre: "", series: 3, repeticiones: "10" },
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

/** en la demo el archivo se guarda en el navegador, así que lo limitamos */
const DEMO_MAX_BYTES = 1_500_000;

function leerComoDataUrl(archivo: File) {
  return new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });
}

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
  if (!MODO_API && archivo.size > DEMO_MAX_BYTES) {
    throw new Error("En la demo el archivo puede pesar hasta 1,5 MB.");
  }

  if (MODO_API) {
    // el alumno tiene que existir en el servidor antes de subirle un archivo
    await remoto.sincronizar();
    // la API valida el contenido real del archivo y actualiza la ficha
    const certificado = await remoto.subirCertificado(alumnoId, archivo, meta.vencimiento);
    actualizarFicha(alumnoId, { certificado });
    return;
  }

  const certificado: Certificado = {
    nombre: archivo.name,
    tipo: meta.tipo,
    tamano: meta.tamano,
    subidoEn: hoyISO(),
    vencimiento: meta.vencimiento,
    ruta: await leerComoDataUrl(archivo),
  };
  actualizarFicha(alumnoId, { certificado });
}

export async function quitarCertificado(alumnoId: string) {
  if (MODO_API) {
    await remoto.sincronizar();
    await remoto.quitarCertificado(alumnoId);
  }
  actualizarFicha(alumnoId, { certificado: null });
}

/** PDF mínimo para los certificados de ejemplo de la demo */
function pdfDeEjemplo() {
  const contenido = "BT /F1 16 Tf 30 100 Td (Certificado medico de ejemplo - demo) Tj ET";
  const pdf = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    `4 0 obj<</Length ${contenido.length}>>stream\n${contenido}\nendstream endobj`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n");
  return new Blob([pdf], { type: "application/pdf" });
}

/** URL para abrir el certificado de un alumno en una pestaña nueva */
export async function urlCertificado(alumnoId: string) {
  if (MODO_API) return remoto.urlCertificado(alumnoId);
  const cert = getSnapshot().alumnos.find((a) => a.id === alumnoId)?.ficha.certificado;
  if (!cert) throw new Error("Este alumno no tiene certificado.");
  if (cert.ruta === "demo") return URL.createObjectURL(pdfDeEjemplo());
  const blob = await (await fetch(cert.ruta)).blob();
  return URL.createObjectURL(blob);
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
