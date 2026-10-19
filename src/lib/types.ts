export type Role = "coach" | "alumno";

export type Session = {
  username: string;
  role: Role;
  /** nombre para mostrar en el saludo */
  nombre: string;
  /** solo para el rol alumno: a qué alumno corresponde la cuenta */
  alumnoId?: string;
};

export type Nivel = "Principiante" | "Intermedio" | "Avanzado";

export type CategoriaEjercicio =
  | "Series y ritmo"
  | "Técnica de carrera"
  | "Fuerza"
  | "Movilidad";

export type Ejercicio = {
  id: string;
  /** nombre del ejercicio del catálogo; vacío mientras no se eligió */
  nombre: string;
  series: number;
  /** texto libre: "12", "400 m", "30 min" */
  repeticiones: string;
  /** kg usados, solo en ejercicios de fuerza y core */
  peso?: string;
  /** ISO yyyy-mm-dd del último registro de peso */
  pesoFecha?: string;
};

export type Plan = {
  id: string;
  nombre: string;
  ejercicios: Ejercicio[];
};

/** qué toca un día de la semana (puede ser correr, fuerza, las dos o descanso) */
export type DiaEntrenamiento = { correr: boolean; fuerza: boolean };

export type Alumno = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  objetivo: string;
  nivel: Nivel;
  activo: boolean;
  /** ISO yyyy-mm-dd, null si no tiene un pago programado */
  proximoPago: string | null;
  altaEn: string;
  planes: Plan[];
  planActivoId: string | null;
  /** 7 días, de lunes (0) a domingo (6) */
  semana: DiaEntrenamiento[];
  /** lesiones y apuntes privados del profe */
  notasProfe: string;
  /** notas que escribe el propio alumno */
  notasAlumno: string;
};
