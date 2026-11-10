import { z } from "zod";
export const CAMPOS_RUNNING = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo", "volumen", "sugerencias"] as const;
export const campoRunningSchema = z.enum(CAMPOS_RUNNING);
export const semanaRunningSchema = z.partialRecord(campoRunningSchema, z.string().max(4000));
export const runningSchema = z.record(z.string().regex(/^(?:[1-9]|[1-9][0-9]|10[0-4])$/), semanaRunningSchema);
export const guardarRunningApi = z.object({semana:z.number().int().min(1).max(104), campo:campoRunningSchema, texto:z.string().max(4000)}).strict().superRefine((v,ctx)=>{
 if(v.campo==="volumen" && !/^(?:[0-9]{1,4}(?:[.,][0-9]{1,2})?)?$/.test(v.texto))ctx.addIssue({code:"custom",message:"Escribí los kilómetros, por ejemplo 32,5, o dejá vacío.",path:["texto"]});
});
export const copiarSemanaRunningApi = z.object({origen:z.number().int().min(1).max(104),destino:z.number().int().min(1).max(104)}).strict().refine(v=>v.origen!==v.destino,"Elegí otra semana de destino");
export type Running = z.infer<typeof runningSchema>;
export type CampoRunning = z.infer<typeof campoRunningSchema>;
export function actualizarRunning(running:Running, cambio:z.infer<typeof guardarRunningApi>):Running {
 return {...running,[cambio.semana]:{...running[String(cambio.semana)],[cambio.campo]:cambio.texto}};
}
