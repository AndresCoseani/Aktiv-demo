import { describe,it,expect } from "vitest";
import { textoRunningPlanificado, actividadesDelDia,actualizarDistribucion,asignarDiaApi,distribucionSchema,remapearDistribucion,quitarSesionDistribucion } from "./planificacion";
const id="a0000000-0000-4000-8000-000000000001",otro="a0000000-0000-4000-8000-000000000002";
describe("Planificación compartida",()=>{
 it("interpreta planes previos sin convertirlos ni asociar GYM a una rutina",()=>{
  const p={sesiones:[{id,tipo:"Fuerza",dia:1}],running:{1:{martes:"Rodaje",miercoles:"GYM",viernes:"Descanso"}}};
  expect(actividadesDelDia(p,1,1)).toEqual([{tipo:"Fuerza",sesionId:id}]);expect(actividadesDelDia(p,2,1)).toEqual([{tipo:"Running"}]);expect(actividadesDelDia(p,3,1)).toEqual([{tipo:"GYM"}]);expect(actividadesDelDia(p,5,1)).toEqual([{tipo:"Descanso"}]);
 });
 it("respeta una excepción vacía y una base vacía sin rescatar datos anteriores",()=>{
  const p={sesiones:[{id,tipo:"Fuerza",dia:1}],distribucion:{base:{1:[{tipo:"Fuerza",sesionId:id}]},semanas:{2:{1:[]}}}};
  expect(actividadesDelDia(p,1,1)).toHaveLength(1);expect(actividadesDelDia(p,1,2)).toEqual([]);expect(actividadesDelDia({...p,distribucion:{base:{1:[]}}},1,1)).toEqual([]);
 });
 it("cambia un día de toda la planificación sin tocar otro día",()=>{
  const actual={base:{1:[{tipo:"Running"}],3:[{tipo:"Fuerza",sesionId:id}]},semanas:{2:{1:[{tipo:"Descanso"}],3:[{tipo:"Running"}]}}};
  const siguiente=actualizarDistribucion(actual,{dia:1,actividades:[{tipo:"Fuerza",sesionId:id}]});expect(siguiente.semanas?.[2][1]).toBeUndefined();expect(siguiente.semanas?.[2][3]).toEqual([{tipo:"Running"}]);expect(actual.semanas[2][1]).toEqual([{tipo:"Descanso"}]);
 });
 it("remapea rutinas al copiar y quita únicamente los vínculos de la borrada",()=>{
  const d={base:{1:[{tipo:"Fuerza",sesionId:id},{tipo:"Running"}]},semanas:{2:{3:[{tipo:"Fuerza",sesionId:id}]}}};
  const copia=remapearDistribucion(d,new Map([[id,otro]]));expect(copia.base![1][0].sesionId).toBe(otro);expect(copia.semanas![2][3][0].sesionId).toBe(otro);expect(d.base[1][0].sesionId).toBe(id);expect(quitarSesionDistribucion(d,id).base![1]).toEqual([{tipo:"Running"}]);
 });
 it("la grilla y el resumen priorizan la asignación sobre la etiqueta anterior",()=>{const p={sesiones:[],running:{1:{lunes:"Rodaje",lunes_tipo:"GYM"}},distribucion:{base:{1:[{tipo:"Running"}]}}};expect(textoRunningPlanificado(p,1,1)).toBe("Rodaje");expect(textoRunningPlanificado({...p,distribucion:{base:{1:[{tipo:"Fuerza"}]}}},1,1)).toBe("");});
 it("valida límites, días, semanas, duplicados y propiedades permitidas",()=>{
  for(const dto of [{dia:0,actividades:[]},{dia:1,semana:105,actividades:[]},{dia:1,actividades:[{tipo:"Running"},{tipo:"Running"}]},{dia:1,actividades:[{tipo:"Fuerza",sesionId:"otro"}]}])expect(asignarDiaApi.safeParse(dto).success).toBe(false);
  expect(distribucionSchema.safeParse({base:{8:[]}}).success).toBe(false);expect(distribucionSchema.safeParse({otro:true}).success).toBe(false);expect(asignarDiaApi.safeParse({dia:1,actividades:[{tipo:"Movilidad"},{tipo:"Fuerza",sesionId:id}]}).success).toBe(true);
 });
});
