import type { NestExpressApplication } from "@nestjs/platform-express";
import { createClient } from "@supabase/supabase-js";
import { hoyISO } from "@aktiv/contrato";
import { Entorno, Sesion, levantarApi, entornoDeTest, uuid } from "./helpers";

describe("Registro público con aprobación",()=>{
 const env=new Entorno();let app:NestExpressApplication,A:Sesion,B:Sesion,coach:string,otro:string;const usuarios:string[]=[];
 const conf=entornoDeTest();
 const cliente=()=>createClient(conf.SUPABASE_URL,conf.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 beforeAll(async()=>{const a=await env.usuario("registro-coach","coach"),b=await env.usuario("registro-otro","coach");coach=a.id;otro=b.id;app=await levantarApi({REGISTRO_COACH_ID:coach});A=await new Sesion(app).entrar(a.email);B=await new Sesion(app).entrar(b.email);});
 afterAll(async()=>{await env.admin.from("solicitudes_alta").delete().in("coach_id",[coach,otro]);for(const id of usuarios){await env.admin.from("alumnos").delete().eq("user_id",id);await env.admin.auth.admin.deleteUser(id);}await env.limpiar();if(app)await app.close();});
 async function crearCuenta(dni:string,email=`registro-${uuid()}@test.local`,nombre="Alumno nuevo"){
  const r=await env.admin.auth.admin.createUser({email,password:dni,email_confirm:true,user_metadata:{origen:"registro_aktiv",nombre,dni,telefono:"3511234567",rol:"coach"}});
  expect(r.error).toBeNull();usuarios.push(r.data.user!.id);const sb=cliente();const login=await sb.auth.signInWithPassword({email,password:dni});expect(login.error).toBeNull();return {sb,id:r.data.user!.id,email,token:login.data.session!.access_token,dni};
 }
 it("registra sin correo ni ficha; Lucas aprueba y se ingresa con email y DNI",async()=>{
  const email=`registro-simple-${uuid()}@test.local`,dni="45111222";
  const c=new Sesion(app);
  const r=await c.post("/api/auth/registro",{nombre:"Alumno nuevo",dni,email});expect(r.status).toBe(204);
  const lista=await env.admin.auth.admin.listUsers();const u=lista.data.users.find((u)=>u.email===email);expect(u).toBeDefined();usuarios.push(u!.id);
  // Confirmado administrativamente: no OTP, enlace ni correo para el alumno.
  expect(u!.email_confirmed_at).toBeTruthy();
  expect((await env.admin.from("profiles").select("id").eq("id",u!.id)).data).toEqual([]);
  expect((await env.admin.from("alumnos").select("id").eq("user_id",u!.id)).data).toEqual([]);
  const solicitud=(await A.get("/api/auth/solicitudes-alta")).body.find((s:{email:string})=>s.email===email);
  expect(solicitud).toMatchObject({nombre:"Alumno nuevo",dni,telefono:""});
  expect((await c.login(email,dni)).body.codigo).toBe("registro_pendiente");
  expect((await A.post(`/api/auth/solicitudes-alta/${solicitud.id}/aprobar`,{})).status).toBe(201);
  expect((await c.login(email,dni)).body.session.role).toBe("alumno");
  const ficha=(await env.admin.from("alumnos").select("dni,telefono,alta_en").eq("user_id",u!.id).single()).data;
  expect(ficha).toMatchObject({dni,telefono:"",alta_en:hoyISO()});
  // Repetir el alta no cambia el DNI/contraseña ni la identidad existente.
  expect((await new Sesion(app).post("/api/auth/registro",{nombre:"Otro nombre",dni:"45999999",email})).status).toBe(204);
  expect((await new Sesion(app).login(email,dni)).body.session.role).toBe("alumno");
 });
 it("un pendiente no entra, no ve datos ni se aprueba solo; otro profesor tampoco",async()=>{
  const u=await crearCuenta("45111223");const c=new Sesion(app);
  expect((await c.post("/api/auth/confirmar-registro",{token:u.token})).status).toBe(204);
  expect((await c.login(u.email,u.dni)).body.codigo).toBe("registro_pendiente");
  const solicitud=(await A.get("/api/auth/solicitudes-alta")).body.find((s:{email:string})=>s.email===u.email);
  expect((await u.sb.from("solicitudes_alta").select("id")).data??[]).toEqual([]);
  expect((await u.sb.rpc("aprobar_registro_alumno",{p_solicitud:solicitud.id})).error).toBeTruthy();
  expect((await u.sb.rpc("completar_registro_alumno",{p_usuario:u.id,p_coach:otro})).error).toBeTruthy();
  expect((await B.get("/api/auth/solicitudes-alta")).body).toEqual([]);
  expect((await B.post(`/api/auth/solicitudes-alta/${solicitud.id}/aprobar`,{})).status).toBe(403);
  expect((await u.sb.from("profiles").insert({id:u.id,rol:"coach",nombre:"No",email:u.email})).error).toBeTruthy();
  expect((await A.post(`/api/auth/solicitudes-alta/${solicitud.id}/aprobar`,{})).status).toBe(201);
  expect((await A.post(`/api/auth/solicitudes-alta/${solicitud.id}/aprobar`,{})).status).toBe(201);
  expect((await c.login(u.email,u.dni)).body.session.role).toBe("alumno");
  const datos=await c.get("/api/datos");expect(datos.status).toBe(200);expect(datos.body.alumnos).toHaveLength(1);expect(datos.body.alumnos[0].planes).toEqual([]);
  expect((await c.get("/api/auth/solicitudes-alta")).status).toBe(403);
 });
 it("vincula una ficha compatible y revierte conflictos sin duplicar ni otorgar perfil",async()=>{
  const u=await crearCuenta("45111224");const ficha=await env.admin.from("alumnos").insert({coach_id:coach,nombre:"Ficha previa",email:u.email,dni:u.dni,notas_profe:"Conservar"}).select("id").single();expect(ficha.error).toBeNull();
  await new Sesion(app).post("/api/auth/confirmar-registro",{token:u.token});const solicitud=(await A.get("/api/auth/solicitudes-alta")).body.find((s:{email:string})=>s.email===u.email);
  expect((await A.post(`/api/auth/solicitudes-alta/${solicitud.id}/aprobar`,{})).body.id).toBe(ficha.data!.id);
  expect((await env.admin.from("alumnos").select("notas_profe,user_id").eq("id",ficha.data!.id).single()).data).toMatchObject({notas_profe:"Conservar",user_id:u.id});
  const conflicto=await crearCuenta("45111225");await env.admin.from("alumnos").insert({coach_id:coach,nombre:"Otro",email:"otro@example.test",dni:conflicto.dni});
  await new Sesion(app).post("/api/auth/confirmar-registro",{token:conflicto.token});const pendiente=(await A.get("/api/auth/solicitudes-alta")).body.find((s:{email:string})=>s.email===conflicto.email);
  expect((await A.post(`/api/auth/solicitudes-alta/${pendiente.id}/aprobar`,{})).status).toBe(422);
  expect((await env.admin.from("profiles").select("id").eq("id",conflicto.id)).data).toEqual([]);
  expect((await A.get("/api/auth/solicitudes-alta")).body.some((s:{id:string})=>s.id===pendiente.id)).toBe(true);
 });
});
