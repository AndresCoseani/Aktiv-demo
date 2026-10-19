import { semanaVacia } from "./dominio";
import { sumarDias } from "./format";
import type {
  Alumno,
  Carrera,
  Inscripcion,
  DiaEntrenamiento,
  Ejercicio,
  FichaMedica,
  Marca,
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
      ficha: fichaDemo(i, s.notas),
      marcas: marcasDemo(s.nivel, i),
      notasProfe: s.notas ?? "",
      notasAlumno: "",
    };
  });
}

/* ───────────── Ficha médica y marcas de ejemplo ───────────── */

const LUGARES = ["Buenos Aires", "Rosario", "Córdoba", "La Plata", "Mendoza"];
const CONTACTOS = [
  ["Marta Coseani", "Madre"],
  ["Julián Benítez", "Hermano"],
  ["Laura Paz", "Esposa"],
  ["Carlos Duarte", "Padre"],
];
const ENFERMEDADES = ["", "Asma leve inducida por ejercicio", "", "Hipotiroidismo (medicado)"];

function fichaDemo(i: number, notas?: string): FichaMedica {
  // el certificado se reparte entre vigente, por vencer, vencido y sin cargar
  const vencimientos = [200, 12, -20, null, 120];
  const venc = vencimientos[i % vencimientos.length];
  return {
    fechaNacimiento: sumarDias(-365 * (22 + ((i * 3) % 20)) - i * 41),
    lugarNacimiento: LUGARES[i % LUGARES.length],
    enfermedades: ENFERMEDADES[i % ENFERMEDADES.length],
    lesiones: notas
      ? [
          {
            id: `l${i}`,
            descripcion: notas.split(".")[0],
            fecha: sumarDias(-60 - i * 5),
            estado: i % 2 === 0 ? "activa" : "recuperada",
          },
        ]
      : [],
    contacto:
      i % 3 === 0
        ? { nombre: CONTACTOS[i % CONTACTOS.length][0], parentesco: CONTACTOS[i % CONTACTOS.length][1], telefono: `+54 11 4${500 + i * 37}-${1000 + i * 113}` }
        : { nombre: "", parentesco: "", telefono: "" },
    certificado:
      venc === null
        ? null
        : {
            nombre: "certificado-medico.pdf",
            tipo: "application/pdf",
            tamano: 84_000,
            subidoEn: sumarDias(venc - 365),
            vencimiento: sumarDias(venc),
            ruta: "demo",
          },
  };
}

function marcasDemo(nivel: Nivel, i: number): Marca[] {
  const factor = { Principiante: 1.25, Intermedio: 1.0, Avanzado: 0.78 }[nivel];
  const t5 = Math.round(1500 * factor * (1 + (i % 4) * 0.03));
  const marcas: Marca[] = [
    { id: `m${i}-5`, distanciaKm: 5, tiempoSeg: t5, fecha: sumarDias(-40 - i * 7), carrera: "5K Solidaria Palermo" },
  ];
  if (nivel !== "Principiante") {
    marcas.push({ id: `m${i}-10`, distanciaKm: 10, tiempoSeg: Math.round(t5 * 2.08), fecha: sumarDias(-90 - i * 5), carrera: "10K Parque Centenario" });
    marcas.push({ id: `m${i}-5b`, distanciaKm: 5, tiempoSeg: t5 + 48, fecha: sumarDias(-200 - i * 3), carrera: "Entrenamiento de control" });
  }
  if (nivel === "Avanzado") {
    marcas.push({ id: `m${i}-21`, distanciaKm: 21.097, tiempoSeg: Math.round(t5 * 4.4), fecha: sumarDias(-150 - i * 4), carrera: "Media Maratón de la Ciudad" });
    marcas.push({ id: `m${i}-42`, distanciaKm: 42.195, tiempoSeg: Math.round(t5 * 9.4), fecha: sumarDias(-260 - i * 2), carrera: "Maratón de Buenos Aires" });
  }
  return marcas;
}

/* ───────────── Calendario de carreras de ejemplo ───────────── */

const h = (horas: number, min: number, seg = 0) => horas * 3600 + min * 60 + seg;

export function crearCalendarioSemilla(): {
  carreras: Carrera[];
  inscripciones: Inscripcion[];
} {
  const carrera = (
    id: string,
    nombre: string,
    enDias: number,
    lugar: string,
    distanciasKm: number[],
    notas = "",
  ): Carrera => ({ id, nombre, fecha: sumarDias(enDias), lugar, distanciasKm, notas });

  const carreras: Carrera[] = [
    carrera("r1", "10K Parque Centenario", 12, "CABA", [5, 10], "Retiro de kit el día anterior en el club."),
    carrera("r2", "5K Solidaria Palermo", 20, "CABA", [3, 5], "Se dona la inscripción a un comedor barrial."),
    carrera("r3", "Media Maratón de la Ciudad", 45, "CABA", [10, 21.097]),
    carrera("r4", "Maratón de Buenos Aires", 60, "CABA", [21.097, 42.195], "Largada 7:30. Hidratación cada 5 km."),
    carrera("r5", "Carrera de la Primavera", 90, "La Plata", [5, 10]),
    carrera("r6", "Aniversario del Club 5K", -40, "CABA", [5, 10]),
    carrera("r7", "Correcaminos Rosario 15K", -25, "Rosario", [5, 15]),
    carrera("r8", "Trail Sierras 21K", -70, "Córdoba", [10, 21.097], "Terreno técnico, llevar mochila de hidratación."),
  ];

  let n = 0;
  const ins = (
    alumnoId: string,
    carreraId: string,
    distanciaKm: number,
    objetivoSeg: number | null,
    resultadoSeg: number | null = null,
  ): Inscripcion => ({ id: `i${++n}`, alumnoId, carreraId, distanciaKm, objetivoSeg, resultadoSeg });

  const inscripciones: Inscripcion[] = [
    ins("a1", "r1", 10, h(0, 52)),
    ins("a1", "r3", 21.097, h(1, 48)),
    ins("a1", "r6", 5, h(0, 24, 30), h(0, 25, 10)),
    ins("a2", "r2", 5, h(0, 35)),
    ins("a3", "r4", 42.195, h(3, 30)),
    ins("a3", "r7", 15, h(1, 2), h(1, 2, 40)),
    ins("a4", "r1", 10, h(0, 58)),
    ins("a6", "r3", 21.097, h(1, 38)),
    ins("a8", "r1", 10, h(0, 55)),
    ins("a9", "r4", 42.195, h(3, 20)),
    ins("a9", "r8", 21.097, h(2, 5), h(2, 5, 10)),
    ins("a11", "r3", 21.097, h(1, 55)),
    ins("a12", "r2", 5, h(0, 23, 30)),
    ins("a13", "r2", 5, h(0, 33)),
  ];
  return { carreras, inscripciones };
}
