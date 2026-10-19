import type {
  CategoriaEjercicio,
  Certificado,
  DiaEntrenamiento,
  FichaMedica,
} from "./types";
import { diasHasta } from "./format";
import { LIMITES } from "./schemas";

/**
 * Reglas y constantes del dominio. Sirven igual con la demo y con Supabase,
 * por eso viven separadas de la semilla de datos falsos (data.ts).
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

/** ejercicios donde tiene sentido registrar el peso (fuerza, core y los creados a mano) */
export function admitePeso(nombre: string) {
  const c = categoriaDe(nombre);
  return c === "Fuerza" || c === "Personalizado";
}

/** los que no están en el catálogo base los creó el profe */
export function categoriaDe(nombre: string) {
  if (!nombre) return undefined;
  return CATEGORIA_POR_NOMBRE.get(nombre) ?? "Personalizado";
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
