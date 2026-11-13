import type { NestExpressApplication } from "@nestjs/platform-express";
import type { PlanMensual } from "@aktiv/contrato";
import { Entorno, Sesion, levantarApi, uuid } from "./helpers";

describe("Planificación unificada",()=>{
 const env=new Entorno();let app:NestExpressApplication,A:Sesion,B:Sesion,S:Sesion,alumno:string,fuerza:string,movilidad:string;
 const plan=uuid(),ejercicio=uuid(),modelo=uuid();
 const leer=async(id=plan)=>((await S.get(`/api/alumnos/${alumno}/planes-mensuales`)).body as PlanMensual[]).find(p=>p.id===id)!;
 const asignar=(dia:number,actividades:object[],semana?:number)=>A.patch(`/api/planes-mensuales/${plan}/distribucion`,{dia,actividades,...(semana?{semana}:{})});
 beforeAll(async()=>{
  app=await levantarApi();const a=await env.usuario("unificada-profe","coach"),b=await env.usuario("unificada-ajeno","coach"),s=await env.usuario("unificada-alumno","alumno");alumno=await env.alumno(a,"Alumno de planificación",s);
  A=await new Sesion(app).entrar(a.email);B=await new Sesion(app).entrar(b.email);S=await new Sesion(app).entrar(s.email);
  expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`,{id:plan,nombre:"Plan de fuerza",tipo:"Fuerza",inicio:"2026-11-01",semanas:4,activo:true,diasIniciales:{tipo:"Fuerza",dias:2}})).status).toBe(201);
  const p=await leer();fuerza=p.sesiones.find(s=>s.tipo==="Fuerza")!.id;movilidad=p.sesiones[1].id;
  expect((await A.patch(`/api/sesiones/${movilidad}`,{nombre:"Fuerza complementaria"})).status).toBe(200);
  expect((await A.post(`/api/sesiones/${fuerza}/ejercicios`,{id:ejercicio,nombre:"Sentadilla de prueba",descanso:"60 s",grupo:1})).status).toBe(201);
  await A.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/1`,{prescripcion:"3×8"});
 });
 afterAll(async()=>{await env.limpiar();if(app)await app.close();});
 it("asigna días concurrentemente y limita la distribución al tipo del plan",async()=>{
  const r=await Promise.all([asignar(1,[{tipo:"Fuerza",sesionId:fuerza}]),asignar(2,[{tipo:"Descanso"}]),asignar(3,[{tipo:"Fuerza",sesionId:movilidad}]),asignar(7,[{tipo:"Descanso"}])]);
  expect(r.map(v=>v.status)).toEqual([200,200,200,200]);const d=(await leer()).distribucion!.base!;expect(d[1][0].sesionId).toBe(fuerza);expect(d[2]).toEqual([{tipo:"Descanso"}]);expect(d[3]).toEqual([{tipo:"Fuerza",sesionId:movilidad}]);
  expect((await leer()).sesiones).toHaveLength(2);
 });
 it("una excepción semanal no cambia la base ni otra semana",async()=>{
  expect((await asignar(1,[{tipo:"Descanso"}],2)).status).toBe(200);const d=(await leer()).distribucion!;expect(d.semanas![2][1]).toEqual([{tipo:"Descanso"}]);expect(d.base![1][0].sesionId).toBe(fuerza);expect(d.semanas?.[3]).toBeUndefined();
 });
 it("protege alumnos, otros profesores y rutinas ajenas",async()=>{
  const ruta=`/api/planes-mensuales/${plan}/distribucion`,cambio={dia:1,actividades:[]};expect((await S.patch(ruta,cambio)).status).toBe(403);expect((await B.patch(ruta,cambio)).status).toBe(404);
  for(const dto of [{dia:8,actividades:[]},{dia:1,actividades:[{tipo:"Fuerza",sesionId:uuid()}]},{dia:1,actividades:[{tipo:"Movilidad"}]}])expect((await A.patch(ruta,dto)).status).toBeGreaterThanOrEqual(400);
  const r=await env.admin.from("planes_mensuales").update({distribucion:{base:{1:[{tipo:"Fuerza",sesionId:uuid()}]}}}).eq("id",plan);expect(r.error?.code).toBe("23514");expect((await A.patch(`/api/sesiones/${fuerza}`,{tipo:"Movilidad"})).status).toBe(422);
 });
 it("duplica semanas con indicaciones y asignaciones, sin reemplazar pesos",async()=>{
  await S.patch(`/api/sesion-ejercicios/${ejercicio}/semanas/3`,{peso:"20",pesoFecha:"2026-11-01"});
  expect((await asignar(2,[{tipo:"Running"}],2)).status).toBe(200);
  expect((await A.patch(`/api/planes-mensuales/${plan}/running`,{semana:2,campo:"martes",texto:"Rodaje de prueba"})).status).toBe(200);
  expect((await A.post(`/api/planes-mensuales/${plan}/planificacion/copiar`,{origen:2,destino:3})).status).toBe(201);
  let p=await leer();expect(p.distribucion!.semanas![3][1]).toEqual([{tipo:"Descanso"}]);expect(p.distribucion!.semanas![3][2]).toEqual([{tipo:"Running"}]);expect(p.running![3].martes).toBe("Rodaje de prueba");expect(p.sesiones[0].ejercicios[0].semanas[2].peso).toBe("20");
  expect((await A.post(`/api/planes-mensuales/${plan}/planificacion/copiar`,{origen:1,destino:4})).status).toBe(201);p=await leer();expect(p.sesiones[0].ejercicios[0].semanas[3].prescripcion).toBe("3×8");
 });
 it("cambiar un día para todo el plan limpia solo sus excepciones",async()=>{
  expect((await asignar(1,[{tipo:"Fuerza",sesionId:fuerza}])).status).toBe(200);const d=(await leer()).distribucion!;expect(d.semanas?.[2]?.[1]).toBeUndefined();expect(d.semanas?.[3]?.[1]).toBeUndefined();expect(d.base![3]).toHaveLength(1);
 });
 it("duplicar plan remapea vínculos a sus propias rutinas y no copia pesos",async()=>{
  const id=uuid();expect((await A.post(`/api/planes-mensuales/${plan}/duplicar`,{id,alumnoId:alumno,nombre:"Copia",inicio:"2026-12-01"})).status).toBe(201);
  const p=await leer(id),referencia=p.distribucion!.base![1][0].sesionId;expect(referencia).not.toBe(fuerza);expect(p.sesiones.some(s=>s.id===referencia)).toBe(true);expect(p.sesiones.flatMap(s=>s.ejercicios.flatMap(e=>e.semanas)).every(c=>c.peso===null)).toBe(true);
 });
 it("guardar como modelo, duplicarlo y asignarlo remapea los vínculos en cada copia",async()=>{
  expect((await A.post(`/api/planes-modelo/desde-plan/${plan}`,{id:modelo,nombre:"Modelo fuerza"})).status).toBe(201);const m=(await A.get(`/api/planes-modelo/${modelo}`)).body;
  const referencia=m.distribucion.base?.["1"]?.[0]?.sesionId ?? m.distribucion.base?.["3"]?.[0]?.sesionId;expect(m.sesiones.some((s:{id:string})=>s.id===referencia)).toBe(true);
  const copia=uuid();expect((await A.post(`/api/planes-modelo/${modelo}/duplicar`,{id:copia,nombre:"Otra base"})).status).toBe(201);const otro=(await A.get(`/api/planes-modelo/${copia}`)).body;const referenciaCopia=otro.distribucion.base?.["1"]?.[0]?.sesionId ?? otro.distribucion.base?.["3"]?.[0]?.sesionId;expect(referenciaCopia).not.toBe(referencia);
  const id=uuid();expect((await A.post(`/api/planes-modelo/${copia}/asignar`,{id,alumnoId:alumno,nombre:"Asignado",inicio:"2026-12-01",asignaciones:[{dia:1,sesionId:otro.sesiones[0].id}]})).status).toBe(201);const p=await leer(id);expect(p.sesiones.some(s=>s.id===p.distribucion!.base![1][0].sesionId)).toBe(true);
 });
 it("borrar una rutina limpia sus vínculos sin borrar otra actividad",async()=>{
  expect((await A.delete(`/api/sesiones/${movilidad}`)).status).toBe(204);const d=(await leer()).distribucion!;expect(d.base![3]).toEqual([]);expect(d.base![1][0].sesionId).toBe(fuerza);
  const m=(await A.get(`/api/planes-modelo/${modelo}`)).body;const rutina=m.distribucion.base[1][0].sesionId;expect((await A.post(`/api/planes-modelo/${modelo}/contenido`,{metodo:"DELETE",ruta:`/sesiones/${rutina}`})).status).toBe(201);expect((await A.get(`/api/planes-modelo/${modelo}`)).body.distribucion.base[1]).toEqual([]);
 });
});
