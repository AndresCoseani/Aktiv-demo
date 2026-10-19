import type {
  Bloque,
  CategoriaEjercicio,
  TipoPlan,
  Certificado,
  DiaEntrenamiento,
  FichaMedica,
} from "./types";
import { diasHasta } from "./format";
import { LIMITES } from "./schemas";

/**
 * Reglas y constantes del dominio: puras, sin acceso a datos.
 */

/* ───────────── Catálogo de ejercicios ───────────── */

const CATALOGO_POR_CATEGORIA: Record<CategoriaEjercicio, string[]> = {
  "Series y ritmo": [
    "Series 400 m",
    "Series 800 m",
    "Series 1000 m",
    "Fartlek",
    "Tempo run",
    "Trote regenerativo",
    "Fondo largo",
    "Cuestas 30 m",
  ],
  "Técnica de carrera": [
    "Skipping A",
    "Skipping B",
    "Talones al glúteo",
    "Rodillas altas",
    "Zancadas dinámicas",
    "Pasadas progresivas",
  ],
  Fuerza: [
    "Sentadilla búlgara",
    "Peso muerto rumano",
    "Puente de glúteo",
    "Step-up al cajón",
    "Estocadas caminando",
    "Elevación de talones",
    "Plancha frontal",
    "Plancha lateral",
    "Bicho muerto",
  ],
  Movilidad: [
    "Movilidad de cadera",
    "Movilidad de tobillo",
    "Foam roller de cuádriceps",
    "Estiramiento de isquiotibiales",
  ],
};

export const EJERCICIOS_CATALOGO: { nombre: string; categoria: CategoriaEjercicio }[] =
  (Object.entries(CATALOGO_POR_CATEGORIA) as [CategoriaEjercicio, string[]][]).flatMap(
    ([categoria, nombres]) => nombres.map((nombre) => ({ nombre, categoria })),
  );

const CATEGORIA_POR_NOMBRE = new Map(
  EJERCICIOS_CATALOGO.map((e) => [e.nombre, e.categoria]),
);

/** Las partes de una sesión, en el orden en que se hacen, con una pista de qué va en cada una */
export const BLOQUES: { bloque: Bloque; pista: string }[] = [
  { bloque: "Calentamiento", pista: "Movilidad, activación y técnica" },
  { bloque: "Entrenamiento", pista: "Lo principal de la sesión" },
  { bloque: "Enfriamiento", pista: "Vuelta a la calma y estiramiento" },
];

/** los dos tipos de plan: el alumno ve el plan ACTIVO de cada uno */
export const TIPOS_PLAN: TipoPlan[] = ["Running", "Fuerza"];

/** qué categorías de ejercicio tienen sentido en cada tipo de plan (Movilidad va en ambos) */
export const CATEGORIAS_POR_TIPO: Record<TipoPlan, CategoriaEjercicio[]> = {
  Running: ["Series y ritmo", "Técnica de carrera", "Movilidad"],
  Fuerza: ["Fuerza", "Movilidad"],
};

/** orden en que se muestran las categorías */
export const CATEGORIAS: CategoriaEjercicio[] = [
  "Series y ritmo",
  "Técnica de carrera",
  "Fuerza",
  "Movilidad",
];

type EjercicioDelProfe = { nombre: string; categoria: CategoriaEjercicio };

/** el catálogo base (del código) más los ejercicios que el profe agregó */
export function catalogoCompleto(custom: readonly EjercicioDelProfe[]) {
  return [...EJERCICIOS_CATALOGO, ...custom];
}

/**
 * Ejercicios donde tiene sentido registrar el peso: los de fuerza. Un nombre que
 * no está en ningún catálogo (el profe lo borró después de usarlo en un plan) se
 * trata como fuerza para no perder lo que el alumno ya anotó.
 */
export function admitePeso(nombre: string, custom: readonly EjercicioDelProfe[] = []) {
  const c = categoriaDe(nombre, custom);
  return c === "Fuerza" || c === "Personalizado";
}

/** "Personalizado" solo aparece para un nombre que ya no está en ningún catálogo */
export function categoriaDe(nombre: string, custom: readonly EjercicioDelProfe[] = []) {
  if (!nombre) return undefined;
  return (
    CATEGORIA_POR_NOMBRE.get(nombre) ??
    custom.find((e) => e.nombre === nombre)?.categoria ??
    "Personalizado"
  );
}

/* ───────────── Semana de entrenamiento ───────────── */

export function semanaVacia(): DiaEntrenamiento[] {
  return Array.from({ length: 7 }, () => ({ correr: false, fuerza: false }));
}


/* ───────────── Ficha médica ───────────── */

export function fichaVacia(): FichaMedica {
  return {
    fechaNacimiento: null,
    lugarNacimiento: "",
    enfermedades: "",
    lesiones: [],
    certificado: null,
    contacto: { nombre: "", parentesco: "", telefono: "" },
  };
}

export type EstadoCertificado = "sin-certificado" | "vencido" | "por-vencer" | "vigente";

/** dentro de cuántos días avisamos que el certificado está por vencer */
export const DIAS_AVISO_CERTIFICADO = 30;

export function estadoCertificado(c: Certificado | null): EstadoCertificado {
  if (!c) return "sin-certificado";
  if (!c.vencimiento) return "vigente";
  const dias = diasHasta(c.vencimiento);
  if (dias < 0) return "vencido";
  if (dias <= DIAS_AVISO_CERTIFICADO) return "por-vencer";
  return "vigente";
}

/** tipos y tamaño máximo del certificado médico (definidos en el contrato de datos) */
export { CERTIFICADO_TIPOS } from "./schemas";
export const CERTIFICADO_MAX_BYTES = LIMITES.certificadoBytes;

/* ───────────── Distancias de carrera ───────────── */

export const DISTANCIAS = [
  { km: 1, label: "1K" },
  { km: 3, label: "3K" },
  { km: 5, label: "5K" },
  { km: 10, label: "10K" },
  { km: 15, label: "15K" },
  { km: 21.097, label: "21K" },
  { km: 42.195, label: "42K" },
] as const;

export function distanciaLabel(km: number) {
  const d = DISTANCIAS.find((x) => Math.abs(x.km - km) < 0.001);
  if (d) return d.label;
  return `${Number.isInteger(km) ? km : km.toFixed(1).replace(".", ",")} km`;
}
