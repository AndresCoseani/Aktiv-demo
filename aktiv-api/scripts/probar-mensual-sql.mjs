// Prueba aislada de las migraciones mensuales con PostgreSQL embebido.
// No usa credenciales ni conexiones remotas. PGLITE_MODULE apunta a su módulo externo.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const alumno = "a0000000-0000-4000-8000-000000000001";
const coach = "a0000000-0000-4000-8000-000000000002";
const estudiante = "a0000000-0000-4000-8000-000000000003";
const otro = "a0000000-0000-4000-8000-000000000004";
const plan = "a0000000-0000-4000-8000-000000000005";
const sesion = "a0000000-0000-4000-8000-000000000006";
const ejercicio = "a0000000-0000-4000-8000-000000000007";
let total = 0;
async function como(usuario, sql) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${usuario}'`);
  try { return await db.query(sql); } finally { await db.exec("reset role"); }
}
async function falla(usuario, sql, codigo) {
  await assert.rejects(como(usuario, sql), (e) => e.code === codigo); total++;
}
try {
  // Equivalentes mínimos de Auth y las funciones previas; el SQL mensual se ejecuta sin modificar.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create table public.alumnos (id uuid primary key, coach_id uuid, user_id uuid);
    insert into public.alumnos values ('${alumno}', '${coach}', '${estudiante}');
    create function public.es_coach_de(alumno uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.alumnos where id=alumno and coach_id=auth.uid()) $$;
    create function public.puede_ver_alumno(alumno uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.alumnos where id=alumno and (coach_id=auth.uid() or user_id=auth.uid())) $$;
  `);
  for (const archivo of ["20261028000000_planes_mensuales.sql", "20261029000000_celdas_semanales.sql", "20261030000000_planes_duracion_variable.sql", "20261031000000_sesiones_dia_opcional.sql", "20261101000000_crear_plan_con_dias.sql", "20261102000000_bloques_sesion.sql", "20261104000000_activacion_sesion.sql"]) {
    if (archivo === "20261102000000_bloques_sesion.sql") {
      await db.exec(`insert into public.planes_mensuales(id,alumno_id,inicio) values('${plan}','${alumno}','2026-11-02'); insert into public.sesiones(id,plan_id,dia,tipo) values('${sesion}','${plan}',null,'Fuerza'); insert into public.sesion_ejercicios(sesion_id,grupo,orden) values('${sesion}',7,0),('${sesion}',1,1);`);
    }
    await db.exec(await readFile(new URL(`../supabase/migrations/${archivo}`, import.meta.url), "utf8"));
    if (archivo === "20261102000000_bloques_sesion.sql") {
      assert.deepEqual((await db.query(`select bloques from public.sesiones where id='${sesion}'`)).rows[0].bloques, [7, 1]); total++;
      await db.exec(`delete from public.planes_mensuales where id='${plan}'`);
    }
    if (archivo === "20261029000000_celdas_semanales.sql") {
      await assert.rejects(db.query(`insert into public.planes_mensuales(alumno_id,inicio,semanas) values('${alumno}','2026-11-02',6)`), (e) => e.code === "42703");
      total++;
    }
  }
  total += 3;
  const planConDias = "a0000000-0000-4000-8000-000000000099";
  const datosPlan = JSON.stringify({ id: planConDias, alumno_id: alumno, nombre: "Base", inicio: "2026-11-02", semanas: 6, activo: false, orden: 0 });
  await falla(estudiante, `select public.crear_plan_con_dias('${datosPlan}', 3, 3)`, "42501");
  await falla(coach, `select public.crear_plan_con_dias('${datosPlan}', 0, 0)`, "P0001");
  await db.exec(`create function public.fallo_dia_prueba() returns trigger language plpgsql as $$ begin if new.nombre = 'Running · Día 2' then raise exception 'Fallo controlado'; end if; return new; end; $$; create trigger fallo_dia before insert on public.sesiones for each row execute function public.fallo_dia_prueba();`);
  await falla(coach, `select public.crear_plan_con_dias('${datosPlan}', 3, 3)`, "P0001");
  assert.equal((await db.query(`select * from public.planes_mensuales where id='${planConDias}'`)).rows.length, 0); total++;
  assert.equal((await db.query(`select * from public.sesiones where plan_id='${planConDias}'`)).rows.length, 0); total++;
  await db.exec("drop trigger fallo_dia on public.sesiones; drop function public.fallo_dia_prueba()");
  for (const [fuerza, running] of [[3, 3], [0, 2], [2, 0]]) {
    await como(coach, `select public.crear_plan_con_dias('${datosPlan}', ${fuerza}, ${running})`);
    const dias = (await como(coach, `select * from public.sesiones where plan_id='${planConDias}' order by orden`)).rows;
    assert.equal(dias.filter((s) => s.tipo === "Fuerza").length, fuerza);
    assert.equal(dias.filter((s) => s.tipo === "Running").length, running);
    assert(dias.every((s) => s.dia === null)); total += 3;
    await como(coach, `delete from public.planes_mensuales where id='${planConDias}'`);
  }
  await como(coach, `insert into public.planes_mensuales (id,alumno_id,inicio,activo) values ('${plan}','${alumno}','2026-11-02',true)`);
  await como(coach, `insert into public.sesiones (id,plan_id,dia,tipo) values ('${sesion}','${plan}',1,'Fuerza')`);
  const activacion = JSON.stringify([{ id: ejercicio, nombre: "Rolo", indicacion: "1 min por grupo muscular" }]);
  await como(coach, `update public.sesiones set calentamiento='Una sola serie',activacion='${activacion}'::jsonb where id='${sesion}'`);
  const entrada = (await como(estudiante, `select calentamiento,activacion from public.sesiones where id='${sesion}'`)).rows[0];
  assert.equal(entrada.calentamiento, "Una sola serie"); total++;
  assert.deepEqual(entrada.activacion, JSON.parse(activacion)); total++;
  assert.equal((await como(estudiante, `update public.sesiones set activacion='[]'::jsonb where id='${sesion}' returning id`)).rows.length, 0); total++;
  await falla(coach, `update public.sesiones set activacion='{}'::jsonb where id='${sesion}'`, "23514");
  await falla(coach, `update public.sesiones set activacion='[${activacion.slice(1, -1)},${activacion.slice(1, -1)}]'::jsonb where id='${sesion}'`, "23514");
  await falla(coach, `update public.sesiones set activacion='[{"id":"${ejercicio}","nombre":"Rolo","indicacion":"","extra":"no"}]'::jsonb where id='${sesion}'`, "23514");
  await como(coach, `update public.sesiones set bloques=array[7,1]::smallint[] where id='${sesion}'`);
  assert.deepEqual((await como(estudiante, `select bloques from public.sesiones where id='${sesion}'`)).rows[0].bloques, [7, 1]); total++;
  await falla(coach, `update public.sesiones set bloques=array[21]::smallint[] where id='${sesion}'`, "23514");
  await falla(coach, `update public.sesiones set bloques=array[null]::smallint[] where id='${sesion}'`, "23514");
  await como(coach, `update public.sesiones set dia=null where id='${sesion}'`);
  assert.equal((await como(coach, `select dia from public.sesiones where id='${sesion}'`)).rows[0].dia, null); total++;
  await como(coach, `update public.sesiones set dia=1 where id='${sesion}'`);
  await como(coach, `insert into public.sesion_ejercicios (id,sesion_id,nombre) values ('${ejercicio}','${sesion}','Zumo')`);
  assert.equal((await como(estudiante, `select * from public.ejercicio_semanas`)).rows.length, 4); total++;
  await como(coach, `update public.ejercicio_semanas set prescripcion='4x8' where ejercicio_id='${ejercicio}' and semana=1`);
  await como(estudiante, `update public.ejercicio_semanas set peso='12,5', peso_fecha=current_date where ejercicio_id='${ejercicio}' and semana=2`);
  const celdas = (await como(estudiante, `select * from public.ejercicio_semanas order by semana`)).rows;
  assert.equal(celdas[0].prescripcion, "4x8"); assert.equal(celdas[1].prescripcion, "");
  assert.equal(celdas[0].peso, null); assert.equal(celdas[1].peso, "12,5"); total += 4;
  await falla(estudiante, `update public.ejercicio_semanas set prescripcion='9x9' where ejercicio_id='${ejercicio}' and semana=1`, "42501");
  await falla(estudiante, `insert into public.sesiones(plan_id,dia,tipo) values('${plan}',2,'Fuerza')`, "42501");
  assert.equal((await como(otro, "select * from public.planes_mensuales")).rows.length, 0); total++;
  assert.equal((await como(otro, "select * from public.sesion_ejercicios")).rows.length, 0); total++;
  assert.equal((await como(otro, "select * from public.ejercicio_semanas")).rows.length, 0); total++;
  await falla(coach, `update public.ejercicio_semanas set semana=5 where ejercicio_id='${ejercicio}' and semana=1`, "23514");
  await falla(coach, `update public.sesiones set dia=0 where id='${sesion}'`, "23514");
  await falla(coach, `update public.ejercicio_semanas set peso='abc' where ejercicio_id='${ejercicio}' and semana=1`, "23514");
  await como(coach, `update public.planes_mensuales set semanas=6 where id='${plan}'`);
  assert.equal((await como(estudiante, "select * from public.ejercicio_semanas")).rows.length, 6); total++;
  assert.equal((await como(estudiante, "select peso from public.ejercicio_semanas where semana=5")).rows[0].peso, null); total++;
  await como(estudiante, `update public.ejercicio_semanas set peso='20' where ejercicio_id='${ejercicio}' and semana=6`);
  await falla(coach, `update public.planes_mensuales set semanas=4 where id='${plan}'`, "P0001");
  await como(estudiante, `update public.ejercicio_semanas set peso=null where ejercicio_id='${ejercicio}' and semana=6`);
  await como(coach, `update public.ejercicio_semanas set prescripcion='3x12' where ejercicio_id='${ejercicio}' and semana=5`);
  await falla(coach, `update public.planes_mensuales set semanas=4 where id='${plan}'`, "P0001");
  await como(coach, `update public.ejercicio_semanas set prescripcion='' where ejercicio_id='${ejercicio}' and semana=5`);
  await como(coach, `update public.planes_mensuales set semanas=4 where id='${plan}'`);
  assert.equal((await como(estudiante, "select * from public.ejercicio_semanas")).rows.length, 4); total++;
  assert.equal((await como(estudiante, "select peso from public.ejercicio_semanas where semana=2")).rows[0].peso, "12,5"); total++;
  await falla(coach, `insert into public.ejercicio_semanas(ejercicio_id, semana) values('${ejercicio}',5)`, "23514");
  await como(coach, `insert into public.planes_mensuales(alumno_id,inicio,activo) values('${alumno}','2026-12-01',true)`);
  assert.equal((await como(coach, "select * from public.planes_mensuales where activo")).rows.length, 1); total++;
  assert.equal((await como(coach, `select activo from public.planes_mensuales where id='${plan}'`)).rows[0].activo, false); total++;
  // Probar el reemplazo del catálogo con dos profesores, conservando el plan real de prueba.
  await db.exec(`create table public.profiles(id uuid primary key, rol text not null);
    create table public.ejercicios_custom(id uuid primary key default gen_random_uuid(), coach_id uuid references public.profiles(id), nombre text not null, categoria text not null check(categoria in ('Fuerza','Movilidad','Series y ritmo','Técnica de carrera')));
    create unique index ejercicios_custom_unico on public.ejercicios_custom(coach_id,lower(nombre));`);
  await db.exec(await readFile(new URL("../supabase/migrations/20261103000000_catalogo_lucas_demo.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select * from public.ejercicios_custom")).rows.length, 0); total++;
  await db.exec(`insert into public.profiles values('${coach}','coach'),('${otro}','coach'),('${estudiante}','alumno');
    insert into public.ejercicios_custom(coach_id,nombre,categoria) values('${coach}','Hiptrust','Fuerza'),('${coach}','Hip Trust','Fuerza'),('${otro}','Ejercicio anterior','Fuerza');`);
  const ejerciciosAntes = (await db.query("select * from public.sesion_ejercicios order by id")).rows;
  const semanasAntes = (await db.query("select * from public.ejercicio_semanas order by ejercicio_id,semana")).rows;
  await db.exec(await readFile(new URL("../supabase/migrations/20261103000000_catalogo_lucas_demo.sql", import.meta.url), "utf8"));
  const catalogo = (await db.query("select * from public.ejercicios_custom")).rows;
  assert.equal(catalogo.length, 22); total++;
  assert.equal(catalogo.filter((e) => e.coach_id === coach).length, 11); total++;
  assert.equal(catalogo.filter((e) => e.coach_id === otro).length, 11); total++;
  assert(!catalogo.some((e) => ["Hiptrust", "Hip Trust", "Ejercicio anterior"].includes(e.nombre))); total++;
  assert.deepEqual((await db.query("select * from public.sesion_ejercicios order by id")).rows, ejerciciosAntes); total++;
  assert.deepEqual((await db.query("select * from public.ejercicio_semanas order by ejercicio_id,semana")).rows, semanasAntes); total++;
  await como(coach, `delete from public.sesiones where id='${sesion}'`);
  assert.equal((await db.query("select * from public.ejercicio_semanas")).rows.length, 0); total++;
  console.log(`OK: ${total} verificaciones SQL (migraciones, RLS, triggers, CHECK, pesos y cascada). Auth/base previa simulados; no sustituye Supabase local.`);
} finally { await db.close(); }
