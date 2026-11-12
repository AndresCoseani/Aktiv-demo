import { z } from "zod";
import { tipoDiaRunning, textoDiaRunning, DIAS_RUNNING, type Running } from "./running";

export const actividadDiaSchema = z.object({
  tipo: z.string().trim().min(1).max(80),
  sesionId: z.uuid().optional(),
}).strict();
export const actividadesDiaSchema = z.array(actividadDiaSchema).max(8)
  .refine(a => new Set(a.map(v => v.sesionId ?? v.tipo)).size === a.length, "Actividad repetida");
const dias = z.record(z.string().regex(/^[1-7]$/), actividadesDiaSchema);
export const distribucionSchema = z.object({
  base: dias.optional(),
  semanas: z.record(z.string().regex(/^(?:[1-9]|[1-9][0-9]|10[0-4])$/), dias).optional(),
}).strict();
export const asignarDiaApi = z.object({
  dia: z.number().int().min(1).max(7),
  semana: z.number().int().min(1).max(104).optional(),
  actividades: actividadesDiaSchema,
}).strict();
export type ActividadDia = z.infer<typeof actividadDiaSchema>;
export type Distribucion = z.infer<typeof distribucionSchema>;
type PlanDistribuido = { distribucion?: Distribucion; running?: Running; sesiones: {id:string;tipo:string;dia:number|null;dias?:number[]}[] };

/** Una sola lectura para calendario, resumen y grilla; conserva planes anteriores. */
export function actividadesDelDia(plan: PlanDistribuido, dia: number, semana: number): ActividadDia[] {
  const particular = plan.distribucion?.semanas?.[semana]?.[dia];
  if (particular !== undefined) return particular;
  const base = plan.distribucion?.base?.[dia];
  if (base !== undefined) return base;
  const asignadas: ActividadDia[] = plan.sesiones.filter(s => (s.dias ?? (s.dia ? [s.dia] : [])).includes(dia)).map(s => ({tipo:s.tipo,sesionId:s.id}));
  const campo = DIAS_RUNNING[dia-1], datos=plan.running?.[semana];
  if (textoDiaRunning(datos,campo).trim()) {
    const tipo=tipoDiaRunning(datos,campo);
    if (tipo === "Running" && !asignadas.some(a=>a.tipo==="Running")) asignadas.push({tipo:"Running"});
    if (tipo === "GYM" && !asignadas.some(a=>a.tipo==="Fuerza")) asignadas.push({tipo:"GYM"});
    if (tipo === "Descanso" && !asignadas.length) asignadas.push({tipo:"Descanso"});
  }
  return asignadas;
}
export function actualizarDistribucion(actual:Distribucion,cambio:z.infer<typeof asignarDiaApi>):Distribucion {
  return cambio.semana === undefined
    ? {...actual,base:{...actual.base,[cambio.dia]:cambio.actividades},semanas:Object.fromEntries(Object.entries(actual.semanas??{}).map(([s,d])=>[s,Object.fromEntries(Object.entries(d).filter(([dia])=>dia!==String(cambio.dia)))]))}
    : {...actual,semanas:{...actual.semanas,[cambio.semana]:{...actual.semanas?.[cambio.semana],[cambio.dia]:cambio.actividades}}};
}
export function remapearDistribucion(actual:Distribucion|undefined,mapa:Map<string,string>):Distribucion {
  const lista=(a:ActividadDia[])=>a.map(v=>v.sesionId?{...v,sesionId:mapa.get(v.sesionId)??v.sesionId}:v);
  const dias=(d:Record<string,ActividadDia[]>)=>Object.fromEntries(Object.entries(d).map(([k,a])=>[k,lista(a)]));
  return {...(actual?.base?{base:dias(actual.base)}:{}),...(actual?.semanas?{semanas:Object.fromEntries(Object.entries(actual.semanas).map(([k,d])=>[k,dias(d)]))}:{})};
}

export function quitarSesionDistribucion(actual:Distribucion|undefined,id:string):Distribucion {
 const limpiar=(d:Record<string,ActividadDia[]>)=>Object.fromEntries(Object.entries(d).map(([k,a])=>[k,a.filter(v=>v.sesionId!==id)]));
 return {...(actual?.base?{base:limpiar(actual.base)}:{}),...(actual?.semanas?{semanas:Object.fromEntries(Object.entries(actual.semanas).map(([k,d])=>[k,limpiar(d)]))}:{})};
}

/** La asignación explícita prevalece sobre las etiquetas históricas de Running. */
export function textoRunningPlanificado(plan:PlanDistribuido,dia:number,semana:number):string {
 const campo=DIAS_RUNNING[dia-1];
 const explicita=plan.distribucion?.semanas?.[semana]?.[dia]??plan.distribucion?.base?.[dia];
 if(explicita!==undefined)return explicita.some(a=>a.tipo==="Running"&&!a.sesionId)?(plan.running?.[semana]?.[campo]??""):"";
 return textoDiaRunning(plan.running?.[semana],campo);
}
