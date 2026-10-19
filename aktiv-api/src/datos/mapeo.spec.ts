import { TABLAS_DATOS, columnasAlumno, columnasEjercicio, columnasFicha, desdeFilas, type FilasCrudas } from "./mapeo";

const COACH = "c0000000-0000-4000-8000-000000000001";
const ALUMNO = "a0000000-0000-4000-8000-000000000001";
const CUENTA = "u0000000-0000-4000-8000-000000000001";
const PLAN = "p0000000-0000-4000-8000-000000000001";

const semana = Array.from({ length: 7 }, (_, i) => ({ correr: i % 2 === 0, fuerza: i === 3 }));

/** Lo que devuelve PostgREST (snake_case, numeric como número, fechas como texto) */
function filas(): FilasCrudas {
  return {
    alumnos: [
      {
        id: ALUMNO, coach_id: COACH, user_id: CUENTA, nombre: "Andres Coseani", email: "andres@mail.com",
        telefono: "+54 11 5555-0000", objetivo: "10K", nivel: "Intermedio", activo: true,
        proximo_pago: "2026-11-01", alta_en: "2026-01-10", semana,
        notas_profe: "rodilla", notas_alumno: "",
        creado_en: "2026-01-10T10:00:00Z", // columna que la app no usa: se ignora
      },
    ],
    planes: [{ id: PLAN, alumno_id: ALUMNO, nombre: "Plan base", orden: 0, tipo: "Fuerza", activo: true }],
    plan_ejercicios: [
      { id: "e1", plan_id: PLAN, orden: 1, bloque: "Enfriamiento", nombre: "Plancha", series: 3, repeticiones: "30 s", descanso: "", peso: null, peso_fecha: null },
      { id: "e0", plan_id: PLAN, orden: 0, bloque: "Entrenamiento", nombre: "Sentadilla", series: 3, repeticiones: "10", descanso: "90 s", peso: "12,5", peso_fecha: "2026-10-01" },
    ],
    fichas_medicas: [
      {
        alumno_id: ALUMNO, fecha_nacimiento: "1990-05-10", lugar_nacimiento: "Salta", enfermedades: "",
        cert_ruta: `${ALUMNO}/x.pdf`, cert_nombre: "x.pdf", cert_tipo: "application/pdf", cert_tamano: "84000",
        cert_subido_en: "2026-10-01", cert_vencimiento: "2027-10-01",
        contacto_nombre: "Ana", contacto_parentesco: "Madre", contacto_telefono: "+54 11 4444-5555",
      },
    ],
    lesiones: [{ id: "l1", alumno_id: ALUMNO, descripcion: "Tendinitis", fecha: null, estado: "activa" }],
    marcas: [{ id: "m1", alumno_id: ALUMNO, distancia_km: "5", tiempo_seg: 1500, fecha: "2026-03-01", carrera: "5K Palermo" }],
    carreras: [{ id: "r1", coach_id: COACH, nombre: "Media", fecha: "2026-12-01", lugar: "CABA", distancias_km: [10, "21.097"], notas: "" }],
    inscripciones: [{ id: "i1", alumno_id: ALUMNO, carrera_id: "r1", distancia_km: 21.097, objetivo_seg: 6000, resultado_seg: null }],
    ejercicios_custom: [{ id: "x1", coach_id: COACH, nombre: "Burpees", categoria: "Fuerza" }],
  };
}

describe("mapeo base → app", () => {
  it("arma el alumno completo con sus planes, ficha y marcas", () => {
    const d = desdeFilas(filas(), CUENTA);
    const a = d.alumnos[0];
    expect(a).toMatchObject({ id: ALUMNO, coachId: COACH, userId: CUENTA, nombre: "Andres Coseani", proximoPago: "2026-11-01" });
    expect(a.planes[0].ejercicios.map((e) => e.nombre)).toEqual(["Sentadilla", "Plancha"]); // por orden, no por llegada
    expect(a.planes[0].ejercicios[0]).toMatchObject({ peso: "12,5", pesoFecha: "2026-10-01", descanso: "90 s" });
    expect(a.planes[0].ejercicios[1]).not.toHaveProperty("peso");
    expect(a.ficha.contacto).toEqual({ nombre: "Ana", parentesco: "Madre", telefono: "+54 11 4444-5555" });
    expect(a.ficha.certificado).toMatchObject({ tipo: "application/pdf", tamano: 84000, vencimiento: "2027-10-01" });
    expect(a.ficha.lesiones).toHaveLength(1);
    expect(a.marcas[0]).toMatchObject({ distanciaKm: 5, tiempoSeg: 1500 });
  });

  it("convierte los numeric de texto a número y reconoce al alumno de la cuenta", () => {
    const d = desdeFilas(filas(), CUENTA);
    expect(d.carreras[0].distanciasKm).toEqual([10, 21.097]);
    expect(d.inscripciones[0].distanciaKm).toBe(21.097);
    expect(d.alumnoIdPropio).toBe(ALUMNO);
    expect(desdeFilas(filas(), "otra-cuenta").alumnoIdPropio).toBeUndefined();
  });

  it("sin certificado ni ficha devuelve una ficha vacía coherente", () => {
    const f = filas();
    f.fichas_medicas = [];
    const d = desdeFilas(f, CUENTA);
    expect(d.alumnos[0].ficha).toMatchObject({ certificado: null, lesiones: [], fechaNacimiento: null });
  });

  it("falla con un mensaje claro si la base tiene una forma que la API no espera", () => {
    const f = filas();
    delete (f.alumnos[0] as Record<string, unknown>).nivel;
    expect(() => desdeFilas(f, CUENTA)).toThrow(/tabla alumnos/);
  });

  it("falla si una fila no cumple el dominio (email inválido, carrera sin distancias)", () => {
    const a = filas();
    (a.alumnos[0] as Record<string, unknown>).email = "no-es-un-email";
    expect(() => desdeFilas(a, CUENTA)).toThrow(/Datos inválidos en alumnos/);
    const b = filas();
    (b.carreras[0] as Record<string, unknown>).distancias_km = [];
    expect(() => desdeFilas(b, CUENTA)).toThrow(/carreras/);
  });

  it("cubre todas las tablas", () => {
    expect(Object.keys(filas()).sort()).toEqual([...TABLAS_DATOS].sort());
  });
});

describe("mapeo app → base (parches)", () => {
  it("traduce solo las claves enviadas a sus columnas", () => {
    expect(columnasAlumno({ proximoPago: "2030-01-01", notasAlumno: "x" })).toEqual({
      proximo_pago: "2030-01-01",
      notas_alumno: "x",
    });
    expect(columnasEjercicio({ pesoFecha: "2026-10-01", series: 4 })).toEqual({ peso_fecha: "2026-10-01", series: 4 });
  });

  it("no deja pasar claves desconocidas (no se puede colar coach_id ni user_id)", () => {
    expect(columnasAlumno({ coach_id: "x", coachId: "y", userId: "z", nombre: "ok" })).toEqual({ nombre: "ok" });
  });

  it("el contacto se reparte en sus tres columnas", () => {
    expect(columnasFicha({ contacto: { nombre: "Ana", parentesco: "Madre", telefono: "1" } })).toEqual({
      contacto_nombre: "Ana",
      contacto_parentesco: "Madre",
      contacto_telefono: "1",
    });
  });

  it("un valor null se envía (para vaciar un campo); undefined se ignora", () => {
    expect(columnasAlumno({ proximoPago: null, notasProfe: undefined })).toEqual({ proximo_pago: null });
  });
});
