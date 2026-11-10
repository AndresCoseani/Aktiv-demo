import { randomUUID } from "node:crypto";
import { altaSesionApi, altaEjercicioMensualApi, duplicarSesionApi, parcheSesionApi, parcheEjercicioMensualApi, parcheCeldaProfeApi, planModeloSchema, type PlanModelo, type OperacionModelo, type SesionEntrenamiento } from "@aktiv/contrato";
import { ErrorApi, noEncontrado } from "../common/errores";
import { validarOLanzar } from "../common/zod.pipe";

export function copiarSesiones(sesiones: SesionEntrenamiento[]) {
  return sesiones.map((s) => ({ ...structuredClone(s), id: randomUUID(), activacion: s.activacion.map((e) => ({ ...e, id: randomUUID() })), ejercicios: s.ejercicios.map((e) => ({ ...structuredClone(e), id: randomUUID(), semanas: e.semanas.map((c) => ({ ...c, peso: null, pesoFecha: null })) })) }));
}

/** Aplica solo operaciones del editor sobre recursos que pertenecen a este modelo. */
export function operarModelo(original: PlanModelo, op: OperacionModelo): PlanModelo {
  const m = structuredClone(original);
  const partes = op.ruta.split("/").filter(Boolean);
  const [recurso, id, accion, numero] = partes;
  if (recurso === "planes-mensuales" && id === m.id && accion === "sesiones" && partes.length === 3 && op.metodo === "POST") {
    const dto = validarOLanzar(altaSesionApi, op.datos);
    if (!m.sesiones.some((s) => s.id === dto.id)) m.sesiones.push({ ...dto, orden: Math.max(-1, ...m.sesiones.map((s) => s.orden)) + 1, ejercicios: [] });
  } else if (recurso === "sesiones") {
    const s = m.sesiones.find((s) => s.id === id); if (!s) throw noEncontrado("El entrenamiento");
    if (partes.length === 2 && op.metodo === "PATCH") Object.assign(s, validarOLanzar(parcheSesionApi, op.datos));
    else if (partes.length === 2 && op.metodo === "DELETE") m.sesiones = m.sesiones.filter((s) => s.id !== id);
    else if (partes.length === 3 && accion === "duplicar" && op.metodo === "POST") {
      const dto = validarOLanzar(duplicarSesionApi, op.datos);
      if (!m.sesiones.some((s) => s.id === dto.id)) m.sesiones.push({ ...copiarSesiones([s])[0], id: dto.id, nombre: dto.nombre, dia: dto.dia, orden: Math.max(-1, ...m.sesiones.map((s) => s.orden)) + 1 });
    } else if (partes.length === 3 && accion === "ejercicios" && op.metodo === "POST") {
      const dto = validarOLanzar(altaEjercicioMensualApi, op.datos);
      if (!s.ejercicios.some((e) => e.id === dto.id)) s.ejercicios.push({ ...dto, orden: Math.max(-1, ...s.ejercicios.map((e) => e.orden)) + 1, semanas: Array.from({ length: m.semanas }, (_, i) => ({ semana: i + 1, prescripcion: "", peso: null, pesoFecha: null })) });
    } else throw noEncontrado("La operación");
  } else if (recurso === "sesion-ejercicios") {
    const s = m.sesiones.find((s) => s.ejercicios.some((e) => e.id === id));
    const e = s?.ejercicios.find((e) => e.id === id); if (!s || !e) throw noEncontrado("El ejercicio");
    if (partes.length === 2 && op.metodo === "PATCH") Object.assign(e, validarOLanzar(parcheEjercicioMensualApi, op.datos));
    else if (partes.length === 2 && op.metodo === "DELETE") s.ejercicios = s.ejercicios.filter((e) => e.id !== id);
    else if (partes.length === 4 && accion === "semanas" && op.metodo === "PATCH") {
      const semana = e.semanas.find((c) => c.semana === Number(numero)); if (!semana) throw noEncontrado("La semana");
      const dto = validarOLanzar(parcheCeldaProfeApi, op.datos);
      if (dto.peso != null || dto.pesoFecha != null) throw new ErrorApi(400, "modelo_sin_pesos", "Los modelos no llevan pesos personales.");
      Object.assign(semana, dto);
    } else throw noEncontrado("La operación");
  } else throw noEncontrado("La operación");
  return validarOLanzar(planModeloSchema, m);
}

export function cambiarDuracion(modelo: PlanModelo, semanas: number) {
  if (semanas < modelo.semanas && modelo.sesiones.some((s) => s.ejercicios.some((e) => e.semanas.some((c) => c.semana > semanas && c.prescripcion.trim())))) throw new ErrorApi(422, "semanas_con_indicaciones", "Las semanas que querés quitar tienen indicaciones. Vacialas primero para conservar tu trabajo.");
  return { ...modelo, semanas, sesiones: modelo.sesiones.map((s) => ({ ...s, ejercicios: s.ejercicios.map((e) => ({ ...e, semanas: Array.from({ length: semanas }, (_, i) => e.semanas.find((c) => c.semana === i + 1) ?? { semana: i + 1, prescripcion: "", peso: null, pesoFecha: null }) })) })) };
}
