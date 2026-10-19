import { z } from "zod";
import {
  alumnoSchema,
  carreraSchema,
  ejercicioCustomSchema,
  inscripcionSchema,
  type Alumno,
  type Carrera,
  type Certificado,
  type EjercicioCustom,
  type FichaMedica,
  type Inscripcion,
  type Plan,
} from "@aktiv/contrato";
import {
  filaAlumnoSchema,
  filaCarreraSchema,
  filaEjercicioCustomSchema,
  filaFichaSchema,
  filaInscripcionSchema,
  filaLesionSchema,
  filaMarcaSchema,
  filaPlanEjercicioSchema,
  filaPlanSchema,
} from "./filas";

/**
 * Mapeo entre las tablas de Supabase (snake_case) y el modelo de la app
 * (camelCase). Es puro: se prueba sin red.
 *
 *  desdeFilas  → valida la forma de cada tabla y el dominio de cada entidad
 *  columnas*   → traducen un parche del contrato a columnas (solo las enviadas)
 */

export type Datos = {
  alumnos: Alumno[];
  carreras: Carrera[];
  inscripciones: Inscripcion[];
  ejerciciosCustom: EjercicioCustom[];
  /** alumno vinculado a la cuenta, si el usuario es alumno */
  alumnoIdPropio?: string;
};

export const TABLAS_DATOS = [
  "alumnos",
  "planes",
  "plan_ejercicios",
  "fichas_medicas",
  "lesiones",
  "marcas",
  "carreras",
  "inscripciones",
  "ejercicios_custom",
] as const;
export type TablaDatos = (typeof TABLAS_DATOS)[number];
export type FilasCrudas = Record<TablaDatos, unknown[]>;

/* ───────────── Base → app ───────────── */

function leer<S extends z.ZodType>(tabla: string, schema: S, filas: unknown[]): z.output<S>[] {
  const r = z.array(schema).safeParse(filas);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new Error(
      `La tabla ${tabla} no coincide con lo que espera la API (${i?.path.join(".")}: ${i?.message}). ` +
        "¿Falta aplicar una migración o actualizar src/datos/filas.ts?",
    );
  }
  return r.data;
}

function validarEntidades<S extends z.ZodType>(nombre: string, schema: S, datos: unknown[]) {
  const r = z.array(schema).safeParse(datos);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new Error(`Datos inválidos en ${nombre}: ${i?.path.join(".")}: ${i?.message}`);
  }
  return r.data as z.output<S>[];
}

const semanaVacia = () => Array.from({ length: 7 }, () => ({ correr: false, fuerza: false }));

const fichaVacia = (): FichaMedica => ({
  fechaNacimiento: null,
  lugarNacimiento: "",
  enfermedades: "",
  lesiones: [],
  certificado: null,
  contacto: { nombre: "", parentesco: "", telefono: "" },
});

export function desdeFilas(crudas: FilasCrudas, userId: string): Datos {
  const al = leer("alumnos", filaAlumnoSchema, crudas.alumnos);
  const pl = leer("planes", filaPlanSchema, crudas.planes);
  const pe = leer("plan_ejercicios", filaPlanEjercicioSchema, crudas.plan_ejercicios);
  const fi = leer("fichas_medicas", filaFichaSchema, crudas.fichas_medicas);
  const le = leer("lesiones", filaLesionSchema, crudas.lesiones);
  const ma = leer("marcas", filaMarcaSchema, crudas.marcas);
  const ca = leer("carreras", filaCarreraSchema, crudas.carreras);
  const ins = leer("inscripciones", filaInscripcionSchema, crudas.inscripciones);
  const ec = leer("ejercicios_custom", filaEjercicioCustomSchema, crudas.ejercicios_custom);

  const fichas = new Map(fi.map((f) => [f.alumno_id, f]));

  const alumnos: Alumno[] = al.map((a) => {
    const planes: Plan[] = pl
      .filter((p) => p.alumno_id === a.id)
      .sort((x, y) => x.orden - y.orden)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        ejercicios: pe
          .filter((e) => e.plan_id === p.id)
          .sort((x, y) => x.orden - y.orden)
          .map((e) => ({
            id: e.id,
            nombre: e.nombre,
            series: e.series,
            repeticiones: e.repeticiones,
            ...(e.peso != null ? { peso: e.peso } : {}),
            ...(e.peso_fecha != null ? { pesoFecha: e.peso_fecha } : {}),
          })),
      }));
    const f = fichas.get(a.id);
    const ficha: FichaMedica = f
      ? {
          fechaNacimiento: f.fecha_nacimiento,
          lugarNacimiento: f.lugar_nacimiento,
          enfermedades: f.enfermedades,
          lesiones: le
            .filter((l) => l.alumno_id === a.id)
            .map((l) => ({ id: l.id, descripcion: l.descripcion, fecha: l.fecha, estado: l.estado })),
          certificado: f.cert_ruta
            ? {
                ruta: f.cert_ruta,
                nombre: f.cert_nombre ?? "",
                tipo: f.cert_tipo as Certificado["tipo"],
                tamano: f.cert_tamano ?? 0,
                subidoEn: f.cert_subido_en ?? "",
                vencimiento: f.cert_vencimiento,
              }
            : null,
          contacto: {
            nombre: f.contacto_nombre,
            parentesco: f.contacto_parentesco,
            telefono: f.contacto_telefono,
          },
        }
      : fichaVacia();
    return {
      id: a.id,
      coachId: a.coach_id,
      userId: a.user_id,
      nombre: a.nombre,
      email: a.email,
      telefono: a.telefono,
      objetivo: a.objetivo,
      nivel: a.nivel,
      activo: a.activo,
      proximoPago: a.proximo_pago,
      altaEn: a.alta_en,
      planes,
      planActivoId: a.plan_activo_id,
      semana: a.semana.length === 7 ? a.semana : semanaVacia(),
      ficha,
      marcas: ma
        .filter((m) => m.alumno_id === a.id)
        .map((m) => ({
          id: m.id,
          distanciaKm: m.distancia_km,
          tiempoSeg: m.tiempo_seg,
          fecha: m.fecha,
          carrera: m.carrera,
        })),
      notasProfe: a.notas_profe,
      notasAlumno: a.notas_alumno,
    };
  });

  const carreras: Carrera[] = ca.map((c) => ({
    id: c.id,
    coachId: c.coach_id,
    nombre: c.nombre,
    fecha: c.fecha,
    lugar: c.lugar,
    distanciasKm: c.distancias_km,
    notas: c.notas,
  }));

  const inscripciones: Inscripcion[] = ins.map((i) => ({
    id: i.id,
    alumnoId: i.alumno_id,
    carreraId: i.carrera_id,
    distanciaKm: i.distancia_km,
    objetivoSeg: i.objetivo_seg,
    resultadoSeg: i.resultado_seg,
  }));

  const ejerciciosCustom: EjercicioCustom[] = ec.map((e) => ({ id: e.id, nombre: e.nombre, categoria: e.categoria }));

  // segunda barrera: el dominio completo (límites, formatos, fechas reales)
  return {
    alumnos: validarEntidades("alumnos", alumnoSchema, alumnos),
    carreras: validarEntidades("carreras", carreraSchema, carreras),
    inscripciones: validarEntidades("inscripciones", inscripcionSchema, inscripciones),
    ejerciciosCustom: validarEntidades("ejercicios_custom", ejercicioCustomSchema, ejerciciosCustom),
    alumnoIdPropio: al.find((a) => a.user_id === userId)?.id,
  };
}

/* ───────────── App → base (parches) ───────────── */

type Mapa = Record<string, string>;

/** Pasa solo las claves presentes, traducidas a su columna */
function aColumnas(parche: Record<string, unknown>, mapa: Mapa): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [clave, columna] of Object.entries(mapa)) {
    if (parche[clave] !== undefined) out[columna] = parche[clave];
  }
  return out;
}

export const columnasAlumno = (p: Record<string, unknown>) =>
  aColumnas(p, {
    nombre: "nombre",
    email: "email",
    telefono: "telefono",
    objetivo: "objetivo",
    nivel: "nivel",
    activo: "activo",
    proximoPago: "proximo_pago",
    planActivoId: "plan_activo_id",
    semana: "semana",
    notasProfe: "notas_profe",
    notasAlumno: "notas_alumno",
  });

export function columnasFicha(p: { contacto?: { nombre: string; parentesco: string; telefono: string } } & Record<string, unknown>) {
  const out = aColumnas(p, {
    fechaNacimiento: "fecha_nacimiento",
    lugarNacimiento: "lugar_nacimiento",
    enfermedades: "enfermedades",
  });
  if (p.contacto) {
    out.contacto_nombre = p.contacto.nombre;
    out.contacto_parentesco = p.contacto.parentesco;
    out.contacto_telefono = p.contacto.telefono;
  }
  return out;
}

export const columnasLesion = (p: Record<string, unknown>) =>
  aColumnas(p, { descripcion: "descripcion", fecha: "fecha", estado: "estado" });

export const columnasMarca = (p: Record<string, unknown>) =>
  aColumnas(p, { distanciaKm: "distancia_km", tiempoSeg: "tiempo_seg", fecha: "fecha", carrera: "carrera" });

export const columnasPlan = (p: Record<string, unknown>) => aColumnas(p, { nombre: "nombre" });

export const columnasEjercicio = (p: Record<string, unknown>) =>
  aColumnas(p, {
    nombre: "nombre",
    series: "series",
    repeticiones: "repeticiones",
    peso: "peso",
    pesoFecha: "peso_fecha",
  });

export const columnasCarrera = (p: Record<string, unknown>) =>
  aColumnas(p, {
    nombre: "nombre",
    fecha: "fecha",
    lugar: "lugar",
    distanciasKm: "distancias_km",
    notas: "notas",
  });

export const columnasInscripcion = (p: Record<string, unknown>) =>
  aColumnas(p, {
    distanciaKm: "distancia_km",
    objetivoSeg: "objetivo_seg",
    resultadoSeg: "resultado_seg",
  });
