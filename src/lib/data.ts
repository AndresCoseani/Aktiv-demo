import { sumarDias } from "./format";
import type {
  Alumno,
  DiaEntrenamiento,
  CategoriaEjercicio,
  Ejercicio,
  Nivel,
  Plan,
  Session,
} from "./types";

/* ───────────── Cuentas de la demo ───────────── */

export const CUENTAS: Record<
  string,
  { password: string; session: Session }
> = {
  admin: {
    password: "admin",
    session: { username: "admin", role: "coach", nombre: "Lucas" },
  },
  alumno: {
    password: "alumno",
    session: {
      username: "alumno",
      role: "alumno",
      nombre: "Andres",
      alumnoId: "a1",
    },
  },
};

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

/* ───────────── Semilla de alumnos ───────────── */

let contador = 0;
const id = (prefijo: string) => `${prefijo}${++contador}`;

type FilaEjercicio = [nombre: string, series: number, repeticiones: string];

function ejercicios(filas: FilaEjercicio[]): Ejercicio[] {
  return filas.map(([nombre, series, repeticiones]) => ({
    id: id("e"),
    nombre,
    series,
    repeticiones,
  }));
}

const PLANTILLAS: Record<string, FilaEjercicio[]> = {
  "Base aeróbica": [
    ["Movilidad de cadera", 2, "10"],
    ["Trote regenerativo", 1, "40 min"],
    ["Pasadas progresivas", 4, "80 m"],
    ["Estiramiento de isquiotibiales", 2, "30 s"],
  ],
  "Fuerza y core": [
    ["Sentadilla búlgara", 3, "10"],
    ["Peso muerto rumano", 3, "12"],
    ["Puente de glúteo", 3, "15"],
    ["Plancha frontal", 3, "45 s"],
    ["Plancha lateral", 3, "30 s"],
    ["Elevación de talones", 4, "15"],
  ],
  "Velocidad 5K": [
    ["Skipping A", 3, "20 m"],
    ["Rodillas altas", 3, "20 m"],
    ["Series 400 m", 8, "1"],
    ["Series 800 m", 4, "1"],
    ["Trote regenerativo", 1, "15 min"],
  ],
  "Preparación 10K": [
    ["Zancadas dinámicas", 2, "12"],
    ["Tempo run", 1, "25 min"],
    ["Series 1000 m", 5, "1"],
    ["Cuestas 30 m", 6, "1"],
    ["Foam roller de cuádriceps", 2, "1 min"],
  ],
  "Fondo y recuperación": [
    ["Fondo largo", 1, "75 min"],
    ["Movilidad de tobillo", 2, "10"],
    ["Foam roller de cuádriceps", 2, "1 min"],
  ],
};

const PESOS_DEMO: Record<string, string> = {
  "Sentadilla búlgara": "12",
  "Peso muerto rumano": "30",
  "Puente de glúteo": "20",
  "Elevación de talones": "16",
};

function plan(nombre: keyof typeof PLANTILLAS, conPesos = false): Plan {
  const lista = ejercicios(PLANTILLAS[nombre]);
  if (conPesos) {
    for (const e of lista) {
      if (PESOS_DEMO[e.nombre]) {
        e.peso = PESOS_DEMO[e.nombre];
        e.pesoFecha = sumarDias(-3);
      }
    }
  }
  return { id: id("p"), nombre, ejercicios: lista };
}

/* ───────────── Semana de entrenamiento ───────────── */

export function semanaVacia(): DiaEntrenamiento[] {
  return Array.from({ length: 7 }, () => ({ correr: false, fuerza: false }));
}

/** días 0 = lunes … 6 = domingo */
const PATRONES: { correr: number[]; fuerza: number[] }[] = [
  { correr: [1, 3, 5], fuerza: [0, 4] },
  { correr: [0, 2, 5], fuerza: [1, 3] },
  { correr: [1, 2, 4, 6], fuerza: [0, 3] },
  { correr: [0, 3, 5], fuerza: [2] },
];

function semanaDesde(i: number): DiaEntrenamiento[] {
  const p = PATRONES[i % PATRONES.length];
  return semanaVacia().map((_, dia) => ({
    correr: p.correr.includes(dia),
    fuerza: p.fuerza.includes(dia),
  }));
}

type Semilla = {
  nombre: string;
  telefono: string;
  objetivo: string;
  nivel: Nivel;
  activo: boolean;
  /** días desde hoy hasta el próximo pago; null = sin pago programado */
  pagoEn: number | null;
  altaHace: number;
  planes: (keyof typeof PLANTILLAS)[];
  notas?: string;
};

const SEMILLAS: Semilla[] = [
  {
    nombre: "Andres Coseani",
    telefono: "+54 11 5521-8834",
    objetivo: "Media maratón",
    nivel: "Intermedio",
    activo: true,
    pagoEn: 6,
    altaHace: 210,
    planes: ["Preparación 10K", "Fuerza y core"],
    notas:
      "Molestia leve en la rodilla derecha (banda iliotibial). Evitar cuestas esta semana y reforzar glúteo medio.",
  },
  {
    nombre: "Sofía Benítez",
    telefono: "+54 11 4012-7765",
    objetivo: "Primer 5K",
    nivel: "Principiante",
    activo: true,
    pagoEn: 2,
    altaHace: 45,
    planes: ["Base aeróbica"],
  },
  {
    nombre: "Joaquín Paz",
    telefono: "+54 11 6633-0912",
    objetivo: "Maratón",
    nivel: "Avanzado",
    activo: true,
    pagoEn: 12,
    altaHace: 380,
    planes: ["Fondo y recuperación", "Velocidad 5K", "Fuerza y core"],
    notas: "Tendinitis de Aquiles resuelta en agosto. Controlar el volumen de series.",
  },
  {
    nombre: "Camila Duarte",
    telefono: "+54 11 5870-1420",
    objetivo: "10K",
    nivel: "Intermedio",
    activo: true,
    pagoEn: -3,
    altaHace: 120,
    planes: ["Preparación 10K"],
  },
  {
    nombre: "Tomás Herrera",
    telefono: "+54 11 3321-9087",
    objetivo: "Bajar de peso",
    nivel: "Principiante",
    activo: true,
    pagoEn: 20,
    altaHace: 30,
    planes: ["Base aeróbica", "Fuerza y core"],
  },
  {
    nombre: "Valentina Ocampo",
    telefono: "+54 11 4400-5518",
    objetivo: "Media maratón",
    nivel: "Avanzado",
    activo: true,
    pagoEn: 0,
    altaHace: 290,
    planes: ["Velocidad 5K", "Fondo y recuperación"],
    notas: "Fascitis plantar en el pie izquierdo hace 2 meses. Usar plantillas.",
  },
  {
    nombre: "Lautaro Medina",
    telefono: "+54 11 6012-3345",
    objetivo: "5K",
    nivel: "Principiante",
    activo: false,
    pagoEn: null,
    altaHace: 150,
    planes: ["Base aeróbica"],
    notas: "Pausó por viaje de trabajo. Retomar con carga baja.",
  },
  {
    nombre: "Agustina Rojas",
    telefono: "+54 11 5099-2276",
    objetivo: "10K",
    nivel: "Intermedio",
    activo: true,
    pagoEn: 4,
    altaHace: 95,
    planes: ["Preparación 10K", "Fuerza y core"],
  },
  {
    nombre: "Franco Silva",
    telefono: "+54 11 4788-6601",
    objetivo: "Maratón",
    nivel: "Avanzado",
    activo: true,
    pagoEn: 9,
    altaHace: 420,
    planes: ["Fondo y recuperación", "Velocidad 5K"],
  },
  {
    nombre: "Julieta Navarro",
    telefono: "+54 11 3901-4452",
    objetivo: "Primer 5K",
    nivel: "Principiante",
    activo: false,
    pagoEn: null,
    altaHace: 200,
    planes: [],
  },
  {
    nombre: "Bruno Castro",
    telefono: "+54 11 5566-7810",
    objetivo: "Media maratón",
    nivel: "Intermedio",
    activo: true,
    pagoEn: -1,
    altaHace: 160,
    planes: ["Preparación 10K"],
    notas: "Contractura en el gemelo derecho, trabajar movilidad de tobillo.",
  },
  {
    nombre: "Martina Lugo",
    telefono: "+54 11 6277-0035",
    objetivo: "Mejorar ritmo",
    nivel: "Intermedio",
    activo: true,
    pagoEn: 15,
    altaHace: 70,
    planes: ["Velocidad 5K", "Fuerza y core"],
  },
  {
    nombre: "Ignacio Vera",
    telefono: "+54 11 4123-9988",
    objetivo: "10K",
    nivel: "Principiante",
    activo: true,
    pagoEn: 5,
    altaHace: 20,
    planes: ["Base aeróbica"],
  },
  {
    nombre: "Pilar Acosta",
    telefono: "+54 11 5832-1107",
    objetivo: "Media maratón",
    nivel: "Avanzado",
    activo: false,
    pagoEn: null,
    altaHace: 330,
    planes: ["Fondo y recuperación"],
    notas: "Lesión de cadera, en rehabilitación. Esperar alta médica.",
  },
];

function emailDe(nombre: string) {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, ".") + "@mail.com"
  );
}

export function crearSemilla(): Alumno[] {
  contador = 0;
  return SEMILLAS.map((s, i) => {
    const planes = s.planes.map((nombre) => plan(nombre, i === 0));
    return {
      id: `a${i + 1}`,
      nombre: s.nombre,
      email: emailDe(s.nombre),
      telefono: s.telefono,
      objetivo: s.objetivo,
      nivel: s.nivel,
      activo: s.activo,
      proximoPago: s.pagoEn === null ? null : sumarDias(s.pagoEn),
      altaEn: sumarDias(-s.altaHace),
      planes,
      planActivoId: planes[0]?.id ?? null,
      semana: semanaDesde(i),
      notasProfe: s.notas ?? "",
      notasAlumno: "",
    };
  });
}
