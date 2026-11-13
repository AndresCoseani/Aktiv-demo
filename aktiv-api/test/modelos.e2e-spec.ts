import type { NestExpressApplication } from "@nestjs/platform-express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Entorno, Sesion, levantarApi, entornoDeTest, uuid, PASS } from "./helpers";

describe("Biblioteca de planes modelo",()=>{
  const env=new Entorno();let app:NestExpressApplication,A:Sesion,B:Sesion,S:Sesion,alumno:string,ajeno:string,db:SupabaseClient,dbAlumno:SupabaseClient,dbOtro:SupabaseClient;
  const modelo=uuid(),dia=uuid(),ejercicio=uuid(),asignado=uuid(),activo=uuid();
  beforeAll(async()=>{
    app=await levantarApi();const a=await env.usuario("modelos-profe","coach"),b=await env.usuario("modelos-ajeno","coach"),s=await env.usuario("modelos-alumno","alumno");
    alumno=await env.alumno(a,"Alumno modelos",s);ajeno=await env.alumno(b,"Alumno ajeno");
    A=await new Sesion(app).entrar(a.email);B=await new Sesion(app).entrar(b.email);S=await new Sesion(app).entrar(s.email);
    const conf=entornoDeTest();db=createClient(conf.SUPABASE_URL,conf.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
    expect((await db.auth.signInWithPassword({email:a.email,password:PASS})).error).toBeNull();
    dbAlumno=createClient(conf.SUPABASE_URL,conf.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
    dbOtro=createClient(conf.SUPABASE_URL,conf.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
    expect((await dbAlumno.auth.signInWithPassword({email:s.email,password:PASS})).error).toBeNull();
    expect((await dbOtro.auth.signInWithPassword({email:b.email,password:PASS})).error).toBeNull();
    expect((await A.post(`/api/alumnos/${alumno}/planes-mensuales`,{id:activo,nombre:"Plan activo",tipo:"Fuerza",inicio:"2026-11-01",semanas:4,activo:true})).status).toBe(201);
  });
  afterAll(async()=>{await env.limpiar();if(app)await app.close();});
  const operar=(metodo:string,ruta:string,datos?:unknown)=>A.post(`/api/planes-modelo/${modelo}/contenido`,{metodo,ruta,datos});
  it("crea un modelo de un solo tipo sin alumno, inicio ni estado activo",async()=>{
    const r=await A.post("/api/planes-modelo",{id:modelo,nombre:"Base inicial",tipo:"Fuerza",semanas:6,diasIniciales:{tipo:"Fuerza",dias:1}});
    expect(r.status).toBe(201);expect(r.body.sesiones).toHaveLength(1);expect(r.body).not.toHaveProperty("inicio");expect(r.body).not.toHaveProperty("alumnoId");expect(r.body).not.toHaveProperty("activo");
    expect((await A.get("/api/planes-modelo")).body).toEqual([expect.objectContaining({id:modelo,tipo:"Fuerza",semanas:6,dias:1})]);
  });
  it("reutiliza el editor: días, movilidad, bloques vacíos, ejercicios y prescripciones",async()=>{
    expect((await operar("POST",`/planes-mensuales/${modelo}/sesiones`,{id:dia,tipo:"Fuerza",dia:1,nombre:"Fuerza inicial",calentamiento:"Una serie",enfriamiento:"Suave"})).status).toBe(201);
    expect((await operar("PATCH",`/sesiones/${dia}`,{bloques:[2,1],activacion:[{id:uuid(),nombre:"Tobillo",indicacion:"10 rep",fase:"Movilidad"}]})).status).toBe(201);
    expect((await operar("POST",`/sesiones/${dia}/ejercicios`,{id:ejercicio,nombre:"Sentadilla",grupo:2,descanso:"90s"})).status).toBe(201);
    const resultados=await Promise.all([1,2,3,4].map((semana)=>operar("PATCH",`/sesion-ejercicios/${ejercicio}/semanas/${semana}`,{prescripcion:`${semana+2}x8`})));
    expect(resultados.map((r)=>r.status)).toEqual([201,201,201,201]);
    const p=(await A.get(`/api/planes-modelo/${modelo}`)).body;
    expect(p.sesiones.find((s:{id:string})=>s.id===dia)).toMatchObject({bloques:[2,1],activacion:[{fase:"Movilidad"}],ejercicios:[{semanas:[{prescripcion:"3x8"},{prescripcion:"4x8"},{prescripcion:"5x8"},{prescripcion:"6x8"},{prescripcion:""},{prescripcion:""}]}]});
    expect((await operar("PATCH",`/sesion-ejercicios/${ejercicio}/semanas/1`,{peso:"50"})).status).toBe(400);
  });
  it("asigna copia independiente, como borrador y con IDs nuevos; conserva el activo",async()=>{
    const r=await A.post(`/api/planes-modelo/${modelo}/asignar`,{id:asignado,alumnoId:alumno,nombre:"Base para alumno",inicio:"2026-12-01"});expect(r.status).toBe(201);
    const planes=(await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body;
    const copia=planes.find((p:{id:string})=>p.id===asignado);
    expect(planes.find((p:{id:string})=>p.id===activo).activo).toBe(true);expect(copia.activo).toBe(false);expect(copia.semanas).toBe(6);
    const s=copia.sesiones.find((s:{nombre:string})=>s.nombre==="Fuerza inicial");expect(s.id).not.toBe(dia);expect(s.activacion[0].fase).toBe("Movilidad");expect(s.bloques).toEqual([2,1]);
    expect(s.ejercicios[0].id).not.toBe(ejercicio);expect(s.ejercicios[0].semanas.every((c:{peso:string|null;pesoFecha:string|null})=>c.peso===null&&c.pesoFecha===null)).toBe(true);
    expect((await A.post(`/api/planes-modelo/${modelo}/asignar`,{id:asignado,alumnoId:alumno,nombre:"Base para alumno",inicio:"2026-12-01"})).status).toBe(201);
    await operar("PATCH",`/sesion-ejercicios/${ejercicio}/semanas/1`,{prescripcion:"NUEVO MODELO"});
    expect((await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body.find((p:{id:string})=>p.id===asignado).sesiones.find((s:{nombre:string})=>s.nombre==="Fuerza inicial").ejercicios[0].semanas[0].prescripcion).toBe("3x8");
    await A.patch(`/api/sesion-ejercicios/${s.ejercicios[0].id}/semanas/1`,{prescripcion:"SOLO ALUMNO"});
    expect((await A.get(`/api/planes-modelo/${modelo}`)).body.sesiones.find((s:{id:string})=>s.id===dia).ejercicios[0].semanas[0].prescripcion).toBe("NUEVO MODELO");
  });
  it("bloquea alumnos, otros profesores y recursos ajenos al modelo",async()=>{
    expect((await S.get("/api/planes-modelo")).status).toBe(403);expect((await B.get(`/api/planes-modelo/${modelo}`)).status).toBe(404);
    expect((await B.patch(`/api/planes-modelo/${modelo}`,{nombre:"Ajeno"})).status).toBe(404);
    expect((await A.post(`/api/planes-modelo/${modelo}/asignar`,{id:uuid(),alumnoId:ajeno,nombre:"No",inicio:"2026-12-01"})).status).toBe(404);
    expect((await operar("PATCH",`/sesiones/${uuid()}`,{nombre:"Ajeno"})).status).toBe(404);
    expect((await A.patch(`/api/planes-modelo/${modelo}`,{coach_id:uuid()})).status).toBe(400);
  });
  it("protege tabla y RPC también accediendo directamente a Supabase",async()=>{
    expect((await dbAlumno.from("planes_modelo").select("id")).data).toEqual([]);
    expect((await dbOtro.from("planes_modelo").select("id").eq("id",modelo)).data).toEqual([]);
    expect((await dbAlumno.from("planes_modelo").insert({id:uuid(),coach_id:env.usuarios[2].id,nombre:"No",semanas:4})).error?.code).toBe("42501");
    expect((await db.from("planes_modelo").update({coach_id:env.usuarios[1].id}).eq("id",modelo)).error?.code).toBe("42501");
    const parametros={p_modelo:modelo,p_id:uuid(),p_alumno:alumno,p_nombre:"No",p_inicio:"2026-12-01"};
    expect((await dbAlumno.rpc("asignar_plan_modelo",parametros)).error?.code).toBe("42501");
    expect((await dbOtro.rpc("asignar_plan_modelo",{...parametros,p_alumno:ajeno})).error?.code).toBe("P0002");
    const conf=entornoDeTest(),anon=createClient(conf.SUPABASE_URL,conf.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
    expect((await anon.from("planes_modelo").select("id")).error).toBeTruthy();
    expect((await anon.rpc("asignar_plan_modelo",parametros)).error?.code).toBe("42501");
  });
  it("revierte toda la asignación si el contenido inválido falla a mitad de la copia",async()=>{
    const malo=uuid(),copia=uuid();
    expect((await env.admin.from("planes_modelo").insert({id:malo,coach_id:env.usuarios[0].id,nombre:"Modelo inválido de prueba",semanas:4,sesiones:[{nombre:"X",tipo:"Fuerza",dia:8,orden:0,calentamiento:"",enfriamiento:"",ejercicios:[],activacion:[],bloques:[]}]})).error).toBeNull();
    try {
      expect((await db.rpc("asignar_plan_modelo",{p_modelo:malo,p_id:copia,p_alumno:alumno,p_nombre:"No debe quedar",p_inicio:"2026-12-01"})).error).toBeTruthy();
      expect((await env.admin.from("planes_mensuales").select("id").eq("id",copia)).data).toEqual([]);
    } finally {await env.admin.from("planes_modelo").delete().eq("id",malo);}
  });
  it("duplica modelos y guarda un plan de alumno como modelo sin los pesos",async()=>{
    const copia=uuid();expect((await A.post(`/api/planes-modelo/${modelo}/duplicar`,{id:copia,nombre:"Copia de base"})).status).toBe(201);
    const p=(await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body.find((p:{id:string})=>p.id===asignado);
    const e=p.sesiones.flatMap((s:{ejercicios:{id:string}[]})=>s.ejercicios)[0];
    expect((await A.patch(`/api/sesion-ejercicios/${e.id}/semanas/1`,{peso:"20"})).status).toBe(200);
    const desde=uuid(),r=await A.post(`/api/planes-modelo/desde-plan/${asignado}`,{id:desde,nombre:"Guardado del alumno"});expect(r.status).toBe(201);
    expect(r.body.sesiones.flatMap((s:{ejercicios:{semanas:{peso:string|null}[]}[]})=>s.ejercicios).every((e:{semanas:{peso:string|null}[]})=>e.semanas.every((c)=>c.peso===null))).toBe(true);
    expect((await A.patch(`/api/planes-modelo/${modelo}`,{semanas:2})).status).toBe(422);
    expect((await A.patch(`/api/planes-modelo/${modelo}`,{semanas:8,nombre:"Base de ocho"})).status).toBe(200);
    expect((await A.get(`/api/planes-modelo/${modelo}`)).body.sesiones.find((s:{id:string})=>s.id===dia).ejercicios[0].semanas).toHaveLength(8);
    expect((await A.delete(`/api/planes-modelo/${modelo}`)).status).toBe(204);
    expect((await A.get(`/api/alumnos/${alumno}/planes-mensuales`)).body.some((p:{id:string})=>p.id===asignado)).toBe(true);
  });
});

