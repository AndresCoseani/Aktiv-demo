import { describe, expect, it } from "vitest";
import { toISO } from "./fechas";

const sumarDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
};
import {
  LIMITES,
  alumnoSchema,
  crearAlumnoDto,
  crearCarreraDto,
  crearLesionDto,
  inscribirAlumnoDto,
  loginDto,
  nuevaMarcaSchema,
  pesoSchema,
  registrarResultadoDto,
  subirCertificadoDto,
  telefonoSchema,
  validar,
} from "./index";

const ok = (r: { ok: boolean }) => r.ok;

describe("alumno", () => {
  const base = { nombre: "Ana Pérez", email: "ana@mail.com", telefono: "+54 11 5555-1234", objetivo: "10K", nivel: "Intermedio" };

  it("acepta un alta válida", () => {
    expect(ok(validar(crearAlumnoDto, base))).toBe(true);
  });

  it("el email es opcional pero, si viene, tiene que ser un email", () => {
    expect(ok(validar(crearAlumnoDto, { ...base, email: "" }))).toBe(true);
    const r = validar(crearAlumnoDto, { ...base, email: "ana@" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.campos.email).toBeTruthy();
  });

  it("rechaza nombre vacío o solo espacios", () => {
    expect(ok(validar(crearAlumnoDto, { ...base, nombre: "" }))).toBe(false);
    expect(ok(validar(crearAlumnoDto, { ...base, nombre: "   " }))).toBe(false);
  });

  it("rechaza nombres que superan el límite", () => {
    expect(ok(validar(crearAlumnoDto, { ...base, nombre: "x".repeat(LIMITES.nombre + 1) }))).toBe(false);
    expect(ok(validar(crearAlumnoDto, { ...base, nombre: "x".repeat(LIMITES.nombre) }))).toBe(true);
  });

  it("rechaza un nivel que no existe", () => {
    expect(ok(validar(crearAlumnoDto, { ...base, nivel: "Experto" }))).toBe(false);
  });

  it("la semana tiene que tener 7 días", () => {
    const dia = { correr: false, fuerza: false };
    const entidad = {
      id: "a1", ...base, activo: true, proximoPago: null, altaEn: "2026-01-01", planes: [],
      planActivoId: null, semana: Array(6).fill(dia), marcas: [], notasProfe: "", notasAlumno: "",
      ficha: { fechaNacimiento: null, lugarNacimiento: "", enfermedades: "", lesiones: [], certificado: null, contacto: { nombre: "", parentesco: "", telefono: "" } },
    };
    expect(ok(validar(alumnoSchema, entidad))).toBe(false);
    expect(ok(validar(alumnoSchema, { ...entidad, semana: Array(7).fill(dia) }))).toBe(true);
  });
});

describe("campos comunes", () => {
  it("teléfono: solo números, espacios y + ( ) . -", () => {
    expect(telefonoSchema.safeParse("+54 (11) 5555-1234").success).toBe(true);
    expect(telefonoSchema.safeParse("1155551234abc").success).toBe(false);
    expect(telefonoSchema.safeParse("").success).toBe(true);
  });

  it("peso: número con coma o punto", () => {
    for (const v of ["", "12", "12,5", "12.5"]) expect(pesoSchema.safeParse(v).success).toBe(true);
    for (const v of ["abc", "1,2,3", "12kg"]) expect(pesoSchema.safeParse(v).success).toBe(false);
  });

  it("login exige un email válido", () => {
    expect(ok(validar(loginDto, { usuario: "lucas@mail.com", clave: "x" }))).toBe(true);
    expect(ok(validar(loginDto, { usuario: "admin", clave: "x" }))).toBe(false);
    expect(ok(validar(loginDto, { usuario: "lucas@mail.com", clave: "" }))).toBe(false);
  });
});

describe("marcas", () => {
  const marca = { distanciaKm: 5, tiempoSeg: 1500, fecha: "2026-01-10", carrera: "5K Palermo" };

  it("acepta una marca válida", () => {
    expect(ok(validar(nuevaMarcaSchema, marca))).toBe(true);
  });

  it("rechaza tiempos o distancias imposibles", () => {
    expect(ok(validar(nuevaMarcaSchema, { ...marca, tiempoSeg: 0 }))).toBe(false);
    expect(ok(validar(nuevaMarcaSchema, { ...marca, tiempoSeg: -5 }))).toBe(false);
    expect(ok(validar(nuevaMarcaSchema, { ...marca, tiempoSeg: 90_000 }))).toBe(false);
    expect(ok(validar(nuevaMarcaSchema, { ...marca, tiempoSeg: 12.5 }))).toBe(false);
    expect(ok(validar(nuevaMarcaSchema, { ...marca, distanciaKm: 0 }))).toBe(false);
    expect(ok(validar(nuevaMarcaSchema, { ...marca, distanciaKm: 5000 }))).toBe(false);
  });

  it("rechaza fechas futuras o que no existen", () => {
    expect(ok(validar(nuevaMarcaSchema, { ...marca, fecha: sumarDias(5) }))).toBe(false);
    expect(ok(validar(nuevaMarcaSchema, { ...marca, fecha: "2026-02-30" }))).toBe(false);
    expect(ok(validar(nuevaMarcaSchema, { ...marca, fecha: "10/01/2026" }))).toBe(false);
  });
});

describe("carreras e inscripciones", () => {
  const carrera = { nombre: "Media Maratón", fecha: "2026-12-01", lugar: "CABA", distanciasKm: [10, 21.097], notas: "" };

  it("acepta una carrera válida", () => {
    expect(ok(validar(crearCarreraDto, carrera))).toBe(true);
  });

  it("necesita nombre y al menos una distancia", () => {
    expect(ok(validar(crearCarreraDto, { ...carrera, nombre: "  " }))).toBe(false);
    const r = validar(crearCarreraDto, { ...carrera, distanciasKm: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("al menos una distancia");
  });

  it("no admite distancias repetidas ni demasiadas", () => {
    expect(ok(validar(crearCarreraDto, { ...carrera, distanciasKm: [5, 5] }))).toBe(false);
    expect(ok(validar(crearCarreraDto, { ...carrera, distanciasKm: Array.from({ length: 11 }, (_, i) => i + 1) }))).toBe(false);
  });

  it("la distancia de una inscripción tiene que existir en la carrera", () => {
    const dto = inscribirAlumnoDto([10, 21.097]);
    expect(ok(validar(dto, { distanciaKm: 21.097, objetivoSeg: 6000 }))).toBe(true);
    expect(ok(validar(dto, { distanciaKm: 10, objetivoSeg: null }))).toBe(true);
    expect(ok(validar(dto, { distanciaKm: 42.195, objetivoSeg: null }))).toBe(false);
    expect(ok(validar(dto, { distanciaKm: 10, objetivoSeg: 0 }))).toBe(false);
  });

  it("el resultado necesita un tiempo válido", () => {
    expect(ok(validar(registrarResultadoDto, { resultadoSeg: 3100, sumarAMarcas: true }))).toBe(true);
    expect(ok(validar(registrarResultadoDto, { resultadoSeg: 0, sumarAMarcas: true }))).toBe(false);
  });
});

describe("ficha médica", () => {
  it("lesión: descripción obligatoria y fecha vacía = null", () => {
    const r = validar(crearLesionDto, { descripcion: "Tendinitis", fecha: "", estado: "activa" });
    expect(r.ok && r.datos.fecha).toBe(null);
    expect(ok(validar(crearLesionDto, { descripcion: "", fecha: "", estado: "activa" }))).toBe(false);
    expect(ok(validar(crearLesionDto, { descripcion: "x", fecha: sumarDias(3), estado: "activa" }))).toBe(false);
    expect(ok(validar(crearLesionDto, { descripcion: "x", fecha: "2026-01-05", estado: "curada" }))).toBe(false);
  });

  it("certificado: solo PDF o imagen, hasta 5 MB", () => {
    const meta = { tipo: "application/pdf", tamano: 80_000, vencimiento: "2027-01-01" };
    expect(ok(validar(subirCertificadoDto, meta))).toBe(true);
    expect(ok(validar(subirCertificadoDto, { ...meta, tipo: "image/png" }))).toBe(true);
    expect(ok(validar(subirCertificadoDto, { ...meta, tipo: "application/zip" }))).toBe(false);
    expect(ok(validar(subirCertificadoDto, { ...meta, tamano: LIMITES.certificadoBytes + 1 }))).toBe(false);
    expect(ok(validar(subirCertificadoDto, { ...meta, tamano: 0 }))).toBe(false);
    expect(ok(validar(subirCertificadoDto, { ...meta, vencimiento: "mañana" }))).toBe(false);
  });
});
