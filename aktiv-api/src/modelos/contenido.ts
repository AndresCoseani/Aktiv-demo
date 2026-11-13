import { quitarSesionDistribucion, asignarDiaApi, actualizarDistribucion, prescripcionEfectiva } from "@aktiv/contrato";
import { randomUUID } from "node:crypto";
import { actualizarRunning, guardarRunningApi, copiarSemanaRunningApi, altaSesionApi, altaEjercicioMensualApi, duplicarSesionApi, parcheSesionApi, parcheEjercicioMensualApi, parcheCeldaProfeApi, planModeloSchema, type PlanModelo, type OperacionModelo, type SesionEntrenamiento } from "@aktiv/contrato";
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
  if(recurso==="planes-mensuales"&&id===m.id&&accion==="distribucion"&&op.metodo==="PATCH") {
    const dto=validarOLanzar(asignarDiaApi,op.datos);if(dto.semana&&dto.semana>m.semanas)throw noEncontrado("La semana");
    for(const a of dto.actividades)if(a.sesionId&&!m.sesiones.some(s=>s.id===a.sesionId&&s.tipo===a.tipo))throw noEncontrado("La rutina");
    m.distribucion=actualizarDistribucion(m.distribucion??{},dto);
  } else if(recurso==="planes-mensuales"&&id===m.id&&accion==="planificacion"&&numero==="copiar"&&op.metodo==="POST") {
    const dto=validarOLanzar(copiarSemanaRunningApi,op.datos);if(Math.max(dto.origen,dto.destino)>m.semanas)throw noEncontrado("La semana");
    if(m.sesiones.some(s=>s.ejercicios.some(e=>!prescripcionEfectiva(e.semanas,dto.origen)&&Boolean(prescripcionEfectiva(e.semanas,dto.destino-1)))))
      throw new ErrorApi(422,"copia_semana_vacia","No se puede copiar una indicación vacía: la semana de destino heredaría una indicación anterior. Completá la semana de origen antes de duplicar.");
    for(const s of m.sesiones)for(const e of s.ejercicios){const texto=prescripcionEfectiva(e.semanas,dto.origen);const destino=e.semanas.find(c=>c.semana===dto.destino);if(destino)destino.prescripcion=texto;}
    m.running={...m.running,[dto.destino]:structuredClone(m.running?.[dto.origen]??{})};m.distribucion={...m.distribucion,semanas:{...m.distribucion?.semanas,[dto.destino]:structuredClone(m.distribucion?.semanas?.[dto.origen]??{})}};
  } else if(recurso === "planes-mensuales" && id===m.id && accion==="running") {
    if(partes.length===3 && op.metodo==="PATCH") {
      const dto=validarOLanzar(guardarRunningApi,op.datos);
      if(dto.semana>m.semanas)throw noEncontrado("La semana");
      m.running=actualizarRunning(m.running ?? {},dto);
    } else if(partes.length===4 && numero==="copiar" && op.metodo==="POST") {
      const dto=validarOLanzar(copiarSemanaRunningApi,op.datos);
      if(Math.max(dto.origen,dto.destino)>m.semanas)throw noEncontrado("La semana");
      m.running={...m.running,[dto.destino]:structuredClone(m.running?.[dto.origen] ?? {})};
    } else throw noEncontrado("La operación");
  } else if (recurso === "planes-mensuales" && id === m.id && accion === "sesiones" && partes.length === 3 && op.metodo === "POST") {
    const dto = validarOLanzar(altaSesionApi, op.datos);
    if (!m.sesiones.some((s) => s.id === dto.id)) m.sesiones.push({ ...dto, orden: Math.max(-1, ...m.sesiones.map((s) => s.orden)) + 1, ejercicios: [] });
  } else if (recurso === "sesiones") {
    const s = m.sesiones.find((s) => s.id === id); if (!s) throw noEncontrado("El entrenamiento");
    if (partes.length === 2 && op.metodo === "PATCH") {
      const dto=validarOLanzar(parcheSesionApi,op.datos);
      const dias=dto.dias ?? (Object.hasOwn(dto,"dia") ? (dto.dia == null ? [] : [dto.dia]) : undefined);
      Object.assign(s,dto);
      if(dias) {s.dias=[...dias].sort((a,b)=>a-b);s.dia=s.dias[0]??null;}
    }
    else if (partes.length === 2 && op.metodo === "DELETE") {m.sesiones = m.sesiones.filter((s) => s.id !== id);m.distribucion=quitarSesionDistribucion(m.distribucion,id);}
    else if (partes.length === 3 && accion === "duplicar" && op.metodo === "POST") {
      const dto = validarOLanzar(duplicarSesionApi, op.datos);
      if (!m.sesiones.some((s) => s.id === dto.id)) m.sesiones.push({ ...copiarSesiones([s])[0], id: dto.id, nombre: dto.nombre, dia: dto.dias ? (dto.dias[0] ?? null) : dto.dia, dias: dto.dias ?? (dto.dia === null ? [] : [dto.dia]), orden: Math.max(-1, ...m.sesiones.map((s) => s.orden)) + 1 });
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
  if(Object.entries(modelo.distribucion?.semanas??{}).some(([s,d])=>Number(s)>semanas&&Object.values(d).some(a=>a.length)))throw new ErrorApi(422,"semanas_con_actividades","Las semanas que querés quitar tienen actividades asignadas.");
  if(Object.entries(modelo.running ?? {}).some(([semana,datos])=>Number(semana)>semanas && Object.values(datos).some(v=>v?.trim())))throw new ErrorApi(422,"semanas_con_indicaciones","Las semanas de Running que querés quitar tienen contenido. Vacialas primero.");
  if (semanas < modelo.semanas && modelo.sesiones.some((s) => s.ejercicios.some((e) => e.semanas.some((c) => c.semana > semanas && c.prescripcion.trim())))) throw new ErrorApi(422, "semanas_con_indicaciones", "Las semanas que querés quitar tienen indicaciones. Vacialas primero para conservar tu trabajo.");
  return { ...modelo, semanas, sesiones: modelo.sesiones.map((s) => ({ ...s, ejercicios: s.ejercicios.map((e) => ({ ...e, semanas: Array.from({ length: semanas }, (_, i) => e.semanas.find((c) => c.semana === i + 1) ?? { semana: i + 1, prescripcion: "", peso: null, pesoFecha: null }) })) })) };
}
