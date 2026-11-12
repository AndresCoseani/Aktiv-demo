// PostgreSQL embebido. Las funciones Auth/base se simulan; las migraciones se ejecutan sin editar.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
try {
 await db.exec(`create role authenticated; create role anon;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to authenticated,anon;
 create table profiles(id uuid primary key,rol text not null);
 create table alumnos(id uuid primary key,coach_id uuid references profiles(id),user_id uuid,activo boolean default true);
 grant select on profiles,alumnos to authenticated;grant update on alumnos to authenticated;
 create function public.es_coach() returns boolean language sql stable security definer as $$ select exists(select 1 from public.profiles where id=auth.uid() and rol='coach') $$;
 create function public.es_coach_de(alumno uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from public.alumnos where id=alumno and coach_id=auth.uid()) $$;
 create function public.puede_ver_alumno(alumno uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from public.alumnos where id=alumno and (coach_id=auth.uid() or user_id=auth.uid())) $$;
 insert into profiles values('${id(1)}','coach'),('${id(2)}','alumno');insert into alumnos values('${id(3)}','${id(1)}','${id(2)}',true);
 `);
 const archivos=["20261028000000_planes_mensuales.sql","20261029000000_celdas_semanales.sql","20261030000000_planes_duracion_variable.sql","20261031000000_sesiones_dia_opcional.sql","20261101000000_crear_plan_con_dias.sql","20261102000000_bloques_sesion.sql","20261104000000_activacion_sesion.sql","20261110000000_duplicar_sesion.sql","20261111000000_duplicar_plan.sql","20261114000000_movilidad_activacion.sql","20261116000000_planes_modelo.sql","20261117000000_actividades_planes_simultaneos.sql","20261120000000_running_semanal.sql","20261121000000_sesion_varios_dias.sql","20261122000000_running_tipo_dia.sql","20261123000000_planificacion_unificada.sql","20261124000000_actividades_bloques.sql"];
 for(const archivo of archivos){if(archivo==="20261110000000_duplicar_sesion.sql")await db.exec(`alter table sesiones add column franja text not null default 'Sin definir';`);await db.exec(await readFile(new URL("../supabase/migrations/"+archivo,import.meta.url),"utf8"));}
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${id(1)}';
 insert into planes_mensuales(id,alumno_id,nombre,inicio,activo) values('${id(4)}','${id(3)}','Ejemplo','2026-11-02',true);
 insert into sesiones(id,plan_id,tipo,dia,bloques,"actividadesBloques") values('${id(5)}','${id(4)}','Fuerza',null,array[1,2,3]::smallint[],'{"1":"Movilidad","2":"Activación","3":"Fuerza"}');
 insert into sesion_ejercicios(id,sesion_id,grupo,nombre) values('${id(6)}','${id(5)}',1,'Ejemplo');
 update ejercicio_semanas set prescripcion='3×8' where ejercicio_id='${id(6)}' and semana=1;
 select public.duplicar_sesion('${id(5)}','${id(7)}','Copia',null);
 select public.duplicar_plan('${id(4)}','${id(8)}','${id(3)}','Copia plan','2026-12-01');`);
 const mapa={1:"Movilidad",2:"Activación",3:"Fuerza"};
 for(const consulta of [`select "actividadesBloques" as tipos from sesiones where id='${id(7)}'`,`select "actividadesBloques" as tipos from sesiones where plan_id='${id(8)}'`]){const r=await db.query(consulta);for(const fila of r.rows)assert.deepEqual(fila.tipos,mapa);}
 for(const invalido of ['[]','{"0":"Fuerza"}','{"21":"Fuerza"}','{"1":"Otra"}','{"1":null}'])await assert.rejects(db.exec(`update sesiones set "actividadesBloques"='${invalido}' where id='${id(5)}'`),e=>e.code==='23514');
 const contenido=[{id:id(20),dia:null,dias:[],tipo:"Fuerza",nombre:"Modelo",orden:0,bloques:[1],activacion:[],ejercicios:[],calentamiento:"",enfriamiento:"",actividadesBloques:{1:"Movilidad"}}];
 await db.exec(`insert into planes_modelo(id,coach_id,nombre,semanas,sesiones) values('${id(21)}','${id(1)}','Modelo',4,'${JSON.stringify(contenido)}');select asignar_plan_modelo('${id(21)}','${id(22)}','${id(3)}','Modelo asignado','2026-12-01');`);
 assert.deepEqual((await db.query(`select "actividadesBloques" as tipos from sesiones where plan_id='${id(22)}'`)).rows[0].tipos,{1:"Movilidad"});
 await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id(2)}';`);
 const r=await db.query(`update sesiones set "actividadesBloques"='{}' where id='${id(5)}' returning id`);assert.equal(r.rows.length,0);
 await db.exec('reset role');
 const diagnostico=await db.exec(await readFile(new URL('../supabase/verificar_planes.sql',import.meta.url),'utf8'));
 assert.equal(diagnostico.at(-1).rows.find(f=>f.migracion===55)?.estado,'OK');
 console.log("OK: migración 55, bloques anteriores, metadatos válidos/inválidos, copia de día/plan/modelo y alumno sin edición.");
}catch(e){console.error(e.message,e.code,e.where??"");process.exitCode=1;}finally{await db.close();}
