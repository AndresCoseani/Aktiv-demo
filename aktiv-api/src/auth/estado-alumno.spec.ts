import { AuthService } from "./auth.service";
import type { SupabaseService } from "../supabase/supabase.service";
import type { Env } from "../config/env";

function entorno(rol="alumno") {
  const estado={activo:true,error:null as null|{message:string;code:string}};
  const user={id:"cuenta",email:"ana@example.test"};
  const session={access_token:"token",refresh_token:"refresh",expires_in:3600};
  const getUser=jest.fn(async()=>({data:{user},error:null}));
  const from=jest.fn((tabla:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>tabla==="profiles"?{data:{rol,nombre:"Ana",email:user.email},error:null}:{data:{activo:estado.activo},error:estado.error}})})}));
  const supa={anonimo:()=>({auth:{getUser,signInWithPassword:async()=>({data:{user,session},error:null}),refreshSession:async()=>({data:{user,session},error:null})}}),delUsuario:()=>({from})};
  return {estado,getUser,from,auth:new AuthService(supa as unknown as SupabaseService,{LOGIN_FALLOS_POR_MIN:5} as Env)};
}

describe("Estado del alumno y acceso",()=>{
  it("permite entrar al alumno activo",async()=>{
    const e=entorno();expect((await e.auth.login("ana@example.test","clave","ip")).usuario.rol).toBe("alumno");
  });
  it("rechaza login y renovación de un alumno inactivo",async()=>{
    const e=entorno();e.estado.activo=false;
    await expect(e.auth.login("ana@example.test","clave","ip")).rejects.toMatchObject({codigo:"alumno_inactivo"});
    await expect(e.auth.refrescar("refresh")).rejects.toMatchObject({codigo:"alumno_inactivo"});
  });
  it("bloquea una sesión previamente cacheada sin esperar su vencimiento y permite reactivar",async()=>{
    const e=entorno();await e.auth.usuarioDesdeToken("token");await e.auth.usuarioDesdeToken("token");expect(e.getUser).toHaveBeenCalledTimes(1);
    e.estado.activo=false;await expect(e.auth.usuarioDesdeToken("token")).rejects.toMatchObject({codigo:"alumno_inactivo"});
    e.estado.activo=true;expect((await e.auth.usuarioDesdeToken("token")).id).toBe("cuenta");expect(e.getUser).toHaveBeenCalledTimes(2);
  });
  it("no aplica el estado de alumno a un profesor",async()=>{
    const e=entorno("coach");e.estado.activo=false;await e.auth.login("ana@example.test","clave","ip");expect(e.from).not.toHaveBeenCalledWith("alumnos");
  });
  it("un error de base no se confunde con una desactivación",async()=>{
    const e=entorno();e.estado.error={message:"Fallo temporal",code:"08006"};
    await expect(e.auth.usuarioDesdeToken("token")).rejects.not.toMatchObject({codigo:"alumno_inactivo"});
  });
});
