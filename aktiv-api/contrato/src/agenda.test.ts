import { describe, expect, it } from "vitest";
import { confirmarAsistenciaApi, referenciaClaseApi, altaHorarioApi, cambioHorarioApi, horarioClaseSchema, consultaAgendaApi, diaSemanal, desplazarFecha, fechaArgentina } from "./agenda";
import { dniSchema, normalizarDni } from "./alumno";
import { parcheSesionApi } from "./mensual";
import { importarAlumnosApi } from "./api";
const id = "a0000000-0000-4000-8000-000000000001";
describe("acuerdos Lucas", () => {
  it("preserva DNI de siete u ocho dígitos sin convertirlo a número", () => {
    expect(dniSchema.parse(normalizarDni("01.234.567"))).toBe("01234567");
    expect(dniSchema.parse("1234567")).toBe("1234567");
    expect(dniSchema.safeParse("123456").success).toBe(false);
    expect(dniSchema.safeParse("12A34567").success).toBe(false);
  });
  it("editar otro campo no cambia el momento del entrenamiento", () => {
    expect(parcheSesionApi.parse({ dia: 2 })).toEqual({ dia: 2 });
    expect(parcheSesionApi.parse({ franja: "Tarde" })).toEqual({ franja: "Tarde" });
    expect(parcheSesionApi.safeParse({ franja: "Madrugada" }).success).toBe(false);
  });
  it("rechaza fin anterior al inicio y consultas excesivas", () => {
    expect(altaHorarioApi.safeParse({ id, titulo: "Fuerza", dia: 1, hora: "18:00", fin: "17:00" }).success).toBe(false);
    expect(altaHorarioApi.safeParse({ id, titulo: "Fuerza", dia: 1, hora: "18:00" }).success).toBe(false);
    expect(altaHorarioApi.safeParse({ id, titulo: "Fuerza", dia: 1, hora: "18:00", fin: "19:00", lugar: "  " }).success).toBe(false);
    expect(altaHorarioApi.parse({ id, titulo: "Fuerza", dia: 1, hora: "18:00", fin: "19:00", lugar: "Parque" }).fin).toBe("19:00");
    expect(horarioClaseSchema.parse({ id, titulo: "Fuerza", dia: 1, hora: "18:00", activo: true }).fin).toBe("");
    expect(consultaAgendaApi.safeParse({ desde: "2026-11-01", hasta: "2026-12-02" }).success).toBe(false);
    expect(consultaAgendaApi.safeParse({ desde: "2026-11-02", hasta: "2026-11-01" }).success).toBe(false);
  });
  it("usa fechas argentinas incluso cerca del cambio de día UTC", () => {
    expect(fechaArgentina(new Date("2026-11-03T01:00:00Z"))).toBe("2026-11-02");
    expect(diaSemanal("2026-11-02")).toBe(1);
    expect(desplazarFecha("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("valida cambios habituales o de una fecha sin aceptar propietarios del cliente", () => {
    const cambio={fecha:'2026-11-03',alcance:'solo_fecha',titulo:'Fuerza',hora:'06:00',fin:'12:00',lugar:'Palmar'};
    expect(cambioHorarioApi.safeParse(cambio).success).toBe(true);
    expect(cambioHorarioApi.safeParse({...cambio,alcance:'habitual'}).success).toBe(true);
    expect(cambioHorarioApi.safeParse({...cambio,fin:'05:00'}).success).toBe(false);
    expect(cambioHorarioApi.safeParse({...cambio,coach_id:id}).success).toBe(false);
  });
  it("rechaza duplicados de DNI y email en el lote", () => {
    const a = { id, nombre: "Ana", email: "ana@example.test", dni: "12345678", telefono: "", objetivo: "", nivel: "Principiante" };
    expect(importarAlumnosApi.safeParse({ alumnos: [a, { ...a, id: "a0000000-0000-4000-8000-000000000002" }] }).success).toBe(false);
  });
});

it("exige hora en nuevos avisos pero no para cancelar", () => {
 const clase={horarioId:id,fecha:"2026-11-04"};
 expect(confirmarAsistenciaApi.safeParse(clase).success).toBe(false);
 expect(confirmarAsistenciaApi.safeParse({...clase,horaLlegada:"24:00"}).success).toBe(false);
 expect(confirmarAsistenciaApi.safeParse({...clase,horaLlegada:"17:30"}).success).toBe(true);
 expect(referenciaClaseApi.safeParse(clase).success).toBe(true);
});
