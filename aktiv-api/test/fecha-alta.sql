-- Prueba de regresión de migración 50. Ejecutar solo en Supabase LOCAL de pruebas.
-- Todo se revierte: incluye la corrección real dentro de la transacción.
begin;
set local timezone='UTC';
insert into auth.users(id,email) values
 ('f5000000-0000-4000-8000-000000000001','fecha-coach@example.test'),
 ('f5000000-0000-4000-8000-000000000002','fecha-nuevo@example.test'),
 ('f5000000-0000-4000-8000-000000000003','fecha-previo@example.test'),
 ('f5000000-0000-4000-8000-000000000004','fecha-explicita@example.test');
insert into public.profiles(id,rol,nombre,email)
 select id,case when id='f5000000-0000-4000-8000-000000000001' then 'coach' else 'alumno' end,'Prueba fecha',email
 from auth.users where id::text like 'f5000000-%';
insert into public.alumnos(id,user_id,coach_id,nombre,alta_en,creado_en) values
 ('f5000000-0000-4000-8000-000000000012','f5000000-0000-4000-8000-000000000002','f5000000-0000-4000-8000-000000000001','Nueva','2026-11-10','2026-11-10T01:33:00Z'),
 ('f5000000-0000-4000-8000-000000000013','f5000000-0000-4000-8000-000000000003','f5000000-0000-4000-8000-000000000001','Anterior','2026-11-09','2026-11-09T01:33:00Z'),
 ('f5000000-0000-4000-8000-000000000014','f5000000-0000-4000-8000-000000000004','f5000000-0000-4000-8000-000000000001','Fecha explícita','2026-11-01','2026-11-10T01:33:00Z');
insert into public.solicitudes_alta(coach_id,user_id,nombre,email,dni,aprobada_en)
 select 'f5000000-0000-4000-8000-000000000001',id,'Prueba',email,'45111222','2026-11-10T01:33:00Z'
 from auth.users where id::text like 'f5000000-%' and id<>'f5000000-0000-4000-8000-000000000001';

-- El ejecutor inserta aquí la migración 50 sin su begin/commit.
-- MIGRACION_50

do $$ begin
 if (select alta_en from public.alumnos where id='f5000000-0000-4000-8000-000000000012')<>date '2026-11-09' then
  raise exception 'No corrigió el alta UTC del registro nuevo'; end if;
 if (select alta_en from public.alumnos where id='f5000000-0000-4000-8000-000000000013')<>date '2026-11-09' then
  raise exception 'Modificó una ficha anterior vinculada'; end if;
 if (select alta_en from public.alumnos where id='f5000000-0000-4000-8000-000000000014')<>date '2026-11-01' then
  raise exception 'Modificó una fecha distinta de la UTC original'; end if;
 if not exists(select 1 from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
  where d.adrelid='public.alumnos'::regclass and a.attname='alta_en'
  and pg_get_expr(d.adbin,d.adrelid) like '%America/Argentina/Buenos_Aires%') then
  raise exception 'El default no utiliza Argentina'; end if;
end $$;
rollback;
