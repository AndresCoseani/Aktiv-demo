"use client";

import { useSyncExternalStore } from "react";
import { CUENTAS, EJERCICIOS_CATALOGO, crearSemilla, semanaVacia } from "./data";
import { hoyISO, nuevoId } from "./format";
import type { Alumno, Ejercicio, Plan, Session } from "./types";

/**
 * Store de la demo: todo vive en memoria y se persiste en localStorage.
 * No hay backend ni llamadas externas.
 */

type State = {
  session: Session | null;
  alumnos: Alumno[];
  /** ejercicios que el profe creó al armar planes */
  ejerciciosCustom: string[];
};

const STORAGE_KEY = "aktiv-demo-v2";

const SERVER_STATE: State = { session: null, alumnos: [], ejerciciosCustom: [] };

let state: State = SERVER_STATE;
let cargado = false;
const listeners = new Set<() => void>();

function cargar() {
  if (cargado || typeof window === "undefined") return;
  cargado = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (Array.isArray(parsed.alumnos)) {
        // datos guardados antes de que existiera la semana: la completamos con la semilla
        const semilla = crearSemilla();
        state = {
          session: parsed.session ?? null,
          alumnos: parsed.alumnos.map((a) => ({
            ...a,
            semana:
              a.semana ?? semilla.find((s) => s.id === a.id)?.semana ?? semanaVacia(),
          })),
          ejerciciosCustom: parsed.ejerciciosCustom ?? [],
        };
        return;
      }
    }
  } catch {
    // storage bloqueado o corrupto: arrancamos desde la semilla
  }
  state = { session: null, alumnos: crearSemilla(), ejerciciosCustom: [] };
}

function set(next: State) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // sin persistencia, la demo sigue funcionando en memoria
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  cargar();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  cargar();
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

/* ───────────── Sesión ───────────── */

export function login(username: string, password: string): Session | null {
  const cuenta = CUENTAS[username.trim().toLowerCase()];
  if (!cuenta || cuenta.password !== password) return null;
  set({ ...getSnapshot(), session: cuenta.session });
  return cuenta.session;
}

export function logout() {
  set({ ...getSnapshot(), session: null });
}

export function resetDemo() {
  set({
    session: getSnapshot().session,
    alumnos: crearSemilla(),
    ejerciciosCustom: [],
  });
}

/* ───────────── Alumnos ───────────── */

export function actualizarAlumno(id: string, cambios: Partial<Alumno>) {
  const s = getSnapshot();
  set({
    ...s,
    alumnos: s.alumnos.map((a) => (a.id === id ? { ...a, ...cambios } : a)),
  });
}

export function crearAlumno(
  datos: Pick<Alumno, "nombre" | "email" | "telefono" | "objetivo" | "nivel">,
) {
  const s = getSnapshot();
  const alumno: Alumno = {
    id: `a${nuevoId()}`,
    ...datos,
    activo: true,
    proximoPago: null,
    altaEn: hoyISO(),
    planes: [],
    planActivoId: null,
    semana: semanaVacia(),
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
  const s = getSnapshot();
  set({
    ...s,
    alumnos: s.alumnos.map((a) =>
      a.id === alumnoId
        ? {
            ...a,
            semana: a.semana.map((d, i) =>
              i === dia ? { ...d, [tipo]: !d[tipo] } : d,
            ),
          }
        : a,
    ),
  });
}

/* ───────────── Catálogo ───────────── */

/** Suma un ejercicio al catálogo y devuelve el nombre canónico (sin duplicar) */
export function crearEjercicioPersonalizado(nombre: string) {
  const s = getSnapshot();
  const limpio = nombre.trim();
  const existente = [
    ...EJERCICIOS_CATALOGO.map((e) => e.nombre),
    ...s.ejerciciosCustom,
  ].find((n) => n.toLowerCase() === limpio.toLowerCase());
  if (existente) return existente;
  set({ ...s, ejerciciosCustom: [...s.ejerciciosCustom, limpio] });
  return limpio;
}

/* ───────────── Planes ───────────── */

function editarPlanes(alumnoId: string, fn: (a: Alumno) => Partial<Alumno>) {
  const s = getSnapshot();
  set({
    ...s,
    alumnos: s.alumnos.map((a) => (a.id === alumnoId ? { ...a, ...fn(a) } : a)),
  });
}

export function crearPlan(alumnoId: string, nombre: string) {
  const plan: Plan = { id: `p${nuevoId()}`, nombre, ejercicios: [] };
  editarPlanes(alumnoId, (a) => ({
    planes: [...a.planes, plan],
    planActivoId: a.planActivoId ?? plan.id,
  }));
  return plan;
}

export function renombrarPlan(alumnoId: string, planId: string, nombre: string) {
  editarPlanes(alumnoId, (a) => ({
    planes: a.planes.map((p) => (p.id === planId ? { ...p, nombre } : p)),
  }));
}

export function eliminarPlan(alumnoId: string, planId: string) {
  editarPlanes(alumnoId, (a) => {
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
  editarPlanes(alumnoId, (a) => ({
    planes: a.planes.map((p) =>
      p.id === planId ? { ...p, ejercicios: fn(p.ejercicios) } : p,
    ),
  }));
}

export function agregarEjercicio(alumnoId: string, planId: string) {
  editarPlan(alumnoId, planId, (ej) => [
    ...ej,
    { id: `e${nuevoId()}`, nombre: "", series: 3, repeticiones: "10" },
  ]);
}

export function actualizarEjercicio(
  alumnoId: string,
  planId: string,
  ejercicioId: string,
  cambios: Partial<Ejercicio>,
) {
  editarPlan(alumnoId, planId, (ej) =>
    ej.map((e) => (e.id === ejercicioId ? { ...e, ...cambios } : e)),
  );
}

export function quitarEjercicio(
  alumnoId: string,
  planId: string,
  ejercicioId: string,
) {
  editarPlan(alumnoId, planId, (ej) => ej.filter((e) => e.id !== ejercicioId));
}
