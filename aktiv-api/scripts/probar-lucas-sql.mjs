// PostgreSQL embebido, sin red ni credenciales. Ejecuta las migraciones 36/37/38/39 reales.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const id = (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const coach = id(1), otroCoach = id(2), usuario = id(3), otroUsuario = id(4), ajeno = id(5);
const alumno = id(10), vecino = id(11), externo = id(12), inactivo = id(13), usuarioInactivo = id(6);
const horario = id(20), horarioAjeno = id(21);
let total = 0;
async function como(usuarioActual, sql) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${usuarioActual}'`);
  try { return await db.query(sql); } finally { await db.exec("reset role"); }
}
async function falla(usuarioActual, sql, codigo) {
  await assert.rejects(como(usuarioActual, sql), (e) => e.code === codigo); total++;
}
const igual = (actual, esperado) => { assert.deepEqual(actual, esperado); total++; };
try {
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated,anon;
    create table profiles(id uuid primary key, rol text not null);
    insert into profiles values('${coach}','coach'),('${otroCoach}','coach'),('${usuario}','alumno'),('${otroUsuario}','alumno'),('${ajeno}','alumno'),('${usuarioInactivo}','alumno');
    grant select on profiles to authenticated;
    create table alumnos(id uuid primary key, coach_id uuid references profiles(id), user_id uuid references profiles(id),
      nombre text not null check(length(trim(nombre)) between 1 and 120), email text not null default '', telefono text not null default '',
      objetivo text not null default '', nivel text not null check(nivel in ('Principiante','Intermedio','Avanzado')), activo boolean not null default true);
    insert into alumnos(id,coach_id,user_id,nombre,nivel,activo) values
      ('${alumno}','${coach}','${usuario}','Ana','Principiante',true),('${vecino}','${coach}','${otroUsuario}','Sol','Principiante',true),
      ('${externo}','${otroCoach}','${ajeno}','Otra','Principiante',true),('${inactivo}','${coach}','${usuarioInactivo}','Inactivo','Principiante',false);
    grant select,insert,update,delete on alumnos to authenticated;
    alter table alumnos enable row level security;
    create policy alumnos_leer on alumnos for select using(coach_id=auth.uid() or user_id=auth.uid());
    create policy alumnos_crear on alumnos for insert with check(coach_id=auth.uid() and exists(select 1 from profiles where id=auth.uid() and rol='coach'));
    create policy alumnos_cambiar on alumnos for update using(coach_id=auth.uid()) with check(coach_id=auth.uid());
    create table sesiones(id uuid primary key, dia smallint, tipo text);
  `);
  for (const archivo of ["20261105000000_dni_y_calendario.sql", "20261106000000_agenda_clases.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${archivo}`, import.meta.url), "utf8"));
  }
  igual((await db.query(`select dni from alumnos where id='${alumno}'`)).rows[0].dni, "");
  await como(coach, `update alumnos set dni='12345678' where id='${alumno}'`);
  await falla(coach, `update alumnos set dni='12.345.678' where id='${alumno}'`, "23514");
  await falla(coach, `update alumnos set dni='12345678' where id='${vecino}'`, "23505");
  await como(otroCoach, `update alumnos set dni='12345678' where id='${externo}'`); total++;
  const datos = (n, dni, email = `${n}@example.test`) => ({ id: id(n), nombre: `Alumno ${n}`, dni, email, telefono: "", objetivo: "", nivel: "Principiante" });
  const importar = (filas) => `select public.importar_alumnos('${JSON.stringify(filas)}'::jsonb)`;
  await falla(usuario, importar([datos(100,"23456780")]), "42501");
  await falla(coach, importar([datos(100,"23456780"), datos(101,"12345678")]), "P0001");
  igual((await db.query(`select count(*)::int as n from alumnos where id='${id(100)}'`)).rows[0].n, 0);
  await como(coach, importar([datos(100,"23456780"), datos(101,"23456781")]));
  igual((await como(coach, `select id from alumnos where id in ('${id(100)}','${id(101)}')`)).rows.length, 2);
  await falla(coach, importar([datos(102,"23456782","100@EXAMPLE.test")]), "P0001");
  await falla(coach, importar([datos(102,"23456782"), { ...datos(103,"23456783"), nivel:"Falso" }]), "23514");
  igual((await db.query(`select count(*)::int as n from alumnos where id='${id(102)}'`)).rows[0].n, 0);
  await falla(coach, "select public.importar_alumnos('[]')", "P0001");
  await falla(coach, "select public.importar_alumnos('{}')", "P0001");
  await db.exec(`insert into sesiones(id,dia,tipo,franja) values('${id(30)}',1,'Fuerza','Mañana'),('${id(31)}',1,'Running','Tarde'),('${id(32)}',1,'Fuerza','Mañana')`);
  igual((await db.query("select count(*)::int as n from sesiones where dia=1")).rows[0].n, 3);
  await assert.rejects(db.query(`update sesiones set franja='Falsa'`), (e) => e.code === "23514"); total++;
  const fecha = (await db.query(`select ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 7)::text as fecha`)).rows[0].fecha;
  const dia = (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7 + 1;
  const crearHorario = (horarioId, duenio) => `insert into horarios_clase(id,coach_id,titulo,dia,hora) values('${horarioId}','${duenio}','Fuerza',${dia},'18:00')`;
  await como(coach, crearHorario(horario,coach)); await como(otroCoach,crearHorario(horarioAjeno,otroCoach));
  await falla(usuario, crearHorario(id(22),usuario), "42501");
  await falla(coach, crearHorario(id(22),otroCoach), "42501");
  await falla(coach, `insert into horarios_clase(coach_id,titulo,dia,hora,fin) values('${coach}','Prueba',1,'18:00','17:00')`, "23514");
  await db.exec(await readFile(new URL('../supabase/migrations/20261107000000_horarios_datos_obligatorios.sql', import.meta.url), 'utf8'));
  igual((await como(coach, `select fin,lugar from horarios_clase where id='${horario}'`)).rows[0], {fin:'',lugar:''});
  await falla(coach, crearHorario(id(50),coach), '23514');
  await falla(coach, `insert into horarios_clase(coach_id,titulo,dia,hora,fin,lugar) values('${coach}','Prueba',1,'18:00','19:00','  ')`, '23514');
  await como(coach, `insert into horarios_clase(id,coach_id,titulo,dia,hora,fin,lugar) values('${id(50)}','${coach}','Completo',7,'09:00','10:00','Parque')`);
  igual((await como(coach, `select fin,lugar from horarios_clase where id='${id(50)}'`)).rows[0], {fin:'10:00',lugar:'Parque'});
  await db.exec(`delete from horarios_clase where id='${id(50)}'`);
  igual((await como(usuario,"select id from horarios_clase")).rows.map((h) => h.id), [horario]);
  igual((await como(ajeno,"select id from horarios_clase")).rows.map((h) => h.id), [horarioAjeno]);
  const confirmar = (a,h=horario,f=fecha) => `insert into confirmaciones_clase(horario_id,fecha,alumno_id) values('${h}','${f}','${a}')`;
  await como(usuario,confirmar(alumno)); await como(otroUsuario,confirmar(vecino));
  igual((await como(usuario,"select alumno_id from confirmaciones_clase")).rows.map((c) => c.alumno_id), [alumno]);
  igual((await como(coach,"select alumno_id from confirmaciones_clase")).rows.length, 2);
  igual((await como(otroCoach,"select alumno_id from confirmaciones_clase")).rows.length, 0);
  await falla(usuario,confirmar(vecino),"42501");
  await falla(usuario,confirmar(alumno,horarioAjeno),"42501");
  await falla(usuarioInactivo,confirmar(inactivo),"42501");
  await db.exec(`insert into alumnos(id,coach_id,user_id,nombre,nivel) values('${id(14)}','${coach}','${coach}','Vínculo inválido de prueba','Principiante')`);
  await falla(coach,confirmar(id(14)),"42501");
  await falla(usuario,confirmar(alumno),"23505");
  await como(usuario, `delete from confirmaciones_clase where alumno_id='${vecino}'`);
  igual((await como(coach,"select * from confirmaciones_clase")).rows.length,2);
  await como(usuario, `delete from confirmaciones_clase where alumno_id='${alumno}'`);
  igual((await como(coach,"select * from confirmaciones_clase")).rows.length,1);
  const malDia = new Date(`${fecha}T12:00:00Z`); malDia.setUTCDate(malDia.getUTCDate()+1);
  await falla(usuario,confirmar(alumno,horario,malDia.toISOString().slice(0,10)),"P0001");
  await falla(usuario,confirmar(alumno,horario,"2000-01-01"),"P0001");
  await falla(usuario, `insert into clases_canceladas values('${horario}','${fecha}')`,"42501");
  await como(coach, `insert into clases_canceladas values('${horario}','${fecha}')`);
  igual((await como(usuario,"select * from clases_canceladas")).rows.length,1);
  await falla(usuario,confirmar(alumno),"P0001");
  await como(coach, `delete from clases_canceladas where horario_id='${horario}' and fecha='${fecha}'`);
  await como(usuario,confirmar(alumno)); total++;
  igual((await como(usuario, `update horarios_clase set activo=false where id='${horario}' returning id`)).rows.length, 0);
  igual((await como(coach, `select activo from horarios_clase where id='${horario}'`)).rows[0].activo, true);
  await falla(coach, `update horarios_clase set hora='19:00' where id='${horario}'`, "42501");
  await como(coach, `update horarios_clase set activo=false where id='${horario}'`);
  await falla(usuario,confirmar(alumno),"P0001");
  igual((await como(coach,"select * from confirmaciones_clase")).rows.length,2);
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from horarios_clase"), (e) => e.code === "42501"); total++;
  await assert.rejects(db.query("select * from confirmaciones_clase"), (e) => e.code === "42501"); total++;
  await db.exec("reset role");
  await db.exec(await readFile(new URL('../supabase/migrations/20261108000000_cambios_horarios_clase.sql', import.meta.url), 'utf8'));
  await como(coach, `update horarios_clase set activo=true where id='${horario}'`);
  const f2=(await db.query(`select ('${fecha}'::date+7)::text as f`)).rows[0].f;
  const f3=(await db.query(`select ('${fecha}'::date+14)::text as f`)).rows[0].f;
  await como(usuario,confirmar(alumno,horario,f2)); await como(usuario,confirmar(alumno,horario,f3));
  const cambiar=(f,alcance='habitual',h=horario,fin='20:00') => `select public.guardar_cambio_horario('${h}','${f}','${alcance}','Running','19:00','${fin}','Palmar')`;
  await falla(usuario,cambiar(fecha),'42501');
  await falla(otroCoach,cambiar(fecha),'42501');
  await falla(coach,cambiar('2000-01-01'),'P0001');
  await falla(coach,cambiar(fecha,'habitual',horario,'17:00'),'23514');
  igual((await como(coach,"select * from confirmaciones_clase")).rows.length,4);
  await como(coach,cambiar(f2,'solo_fecha'));
  igual((await como(coach,`select * from confirmaciones_clase where fecha='${f2}'`)).rows.length,0);
  igual((await como(coach,`select * from confirmaciones_clase where fecha='${f3}'`)).rows.length,1);
  await como(usuario,confirmar(alumno,horario,f2));
  await como(coach,cambiar(fecha));
  igual((await como(coach,"select fecha::text as f from confirmaciones_clase")).rows.map(c=>c.f),[f2]);
  igual((await como(ajeno,"select * from cambios_horario_clase")).rows.length,0);
  igual((await como(usuario,"select * from cambios_horario_clase")).rows.length,2);
  await falla(usuario,`insert into cambios_horario_clase values('${horario}','${f3}','solo_fecha','Intruso','10:00','11:00','Otro')`,'42501');
  igual((await como(coach,`select hora from horarios_clase where id='${horario}'`)).rows[0].hora,'18:00');
  await como(coach,cambiar(f2));
  igual((await como(coach,`select * from cambios_horario_clase where fecha='${f2}' and alcance='solo_fecha'`)).rows.length,0);
  igual((await como(coach,"select * from confirmaciones_clase")).rows.length,0);
  await como(usuario,confirmar(alumno,horario,fecha));
  await db.exec(await readFile(new URL('../supabase/migrations/20261109000000_hora_llegada_clase.sql', import.meta.url), 'utf8'));
  igual((await como(coach,'select hora_llegada from confirmaciones_clase')).rows[0].hora_llegada,null);
  await como(usuario,`delete from confirmaciones_clase where alumno_id='${alumno}'`);
  const avisar = (a,h,f,hora) => `select confirmar_llegada_clase('${h}','${f}','${a}',${hora === null ? 'null' : "'"+hora+"'"})`;
  await como(usuario,avisar(alumno,horario,fecha,'19:30'));
  igual((await como(coach,'select hora_llegada from confirmaciones_clase')).rows[0].hora_llegada,'19:30');
  await como(usuario,avisar(alumno,horario,fecha,'19:45'));
  igual((await como(coach,'select hora_llegada from confirmaciones_clase')).rows.map(c=>c.hora_llegada),['19:45']);
  await falla(usuario,avisar(alumno,horario,fecha,'05:00'),'23514');
  await falla(usuario,avisar(alumno,horario,fecha,'23:00'),'23514');
  await falla(usuario,avisar(alumno,horario,fecha,null),'23514');
  await falla(usuario,avisar(vecino,horario,fecha,'19:30'),'42501');
  await falla(ajeno,avisar(externo,horario,fecha,'19:30'),'42501');
  await como(usuario,`delete from confirmaciones_clase where alumno_id='${alumno}'`);
  igual((await como(coach,'select * from confirmaciones_clase')).rows.length,0);
  // Excepci?n puntual prevalece sobre el horario habitual.
  await como(coach,`select guardar_cambio_horario('${horario}','${fecha}','solo_fecha','Running','08:00','10:00','Pista')`);
  await falla(usuario,avisar(alumno,horario,fecha,'19:30'),'23514');
  await como(usuario,avisar(alumno,horario,fecha,'08:00'));
  await como(usuario,avisar(alumno,horario,fecha,'10:00'));
  await como(coach,`insert into clases_canceladas values('${horario}','${fecha}')`);
  await falla(usuario,avisar(alumno,horario,fecha,'09:00'),'P0001');
  const diagnosticos = await db.exec(await readFile(new URL('../supabase/verificar_actualizacion_lucas.sql', import.meta.url), 'utf8'));
  for (const resultado of diagnosticos) for (const fila of resultado.rows) {
    if ('ok' in fila) igual(fila.ok, true);
    else for (const valor of Object.values(fila)) igual(valor, true);
  }
  console.log(`OK: ${total} verificaciones SQL de DNI, importación atómica, calendario, agenda y aislamiento entre profesores/alumnos.`);
} finally { await db.close(); }
