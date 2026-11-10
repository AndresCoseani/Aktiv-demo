-- 48: actividades propias y planes simultáneos. No elimina ni reactiva planes previos.
begin;
drop trigger planes_mensuales_un_activo_trg on public.planes_mensuales;
drop function public.planes_mensuales_un_solo_activo();
drop index public.planes_mensuales_un_activo;
alter table public.sesiones drop constraint sesiones_tipo_check;
alter table public.sesiones add constraint sesiones_tipo_check check(char_length(btrim(tipo)) between 1 and 80);

create table public.actividades_plan (
 coach_id uuid not null references public.profiles(id) on delete cascade,
 nombre text not null check(char_length(btrim(nombre)) between 1 and 80),
 clave text generated always as (lower(btrim(nombre))) stored,
 primary key(coach_id,clave)
);
alter table public.actividades_plan enable row level security;
revoke all on public.actividades_plan from public,anon,authenticated;
grant select,insert on public.actividades_plan to authenticated;
create policy actividades_propias on public.actividades_plan for all to authenticated
 using(coach_id=(select auth.uid()) and public.es_coach())
 with check(coach_id=(select auth.uid()) and public.es_coach());
insert into public.actividades_plan(coach_id,nombre)
 select p.id,t.nombre from public.profiles p cross join (values ('Fuerza'),('Running')) t(nombre) where p.rol='coach';

create function public.crear_plan_con_actividades(p_plan jsonb,p_actividades jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid := (p_plan->>'id')::uuid; actividad jsonb; cantidad integer; tipo text; orden_dia integer:=0;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede crear planes' using errcode='42501'; end if;
 if jsonb_typeof(p_actividades) is distinct from 'array' or jsonb_array_length(p_actividades) not between 1 and 28 then
  raise exception 'Elegí al menos una actividad' using errcode='23514'; end if;
 -- Se valida todo antes de insertar. Un fallo revierte también el plan.
 for actividad in select value from jsonb_array_elements(p_actividades) loop
  tipo:=btrim(actividad->>'tipo'); cantidad:=(actividad->>'dias')::integer;
  if tipo is null or char_length(tipo) not between 1 and 80 or cantidad is null or cantidad not between 1 and 7 then
   raise exception 'Actividad o cantidad de días inválida' using errcode='23514'; end if;
  orden_dia:=orden_dia+cantidad;
 end loop;
 if orden_dia>28 or (select count(distinct lower(btrim(value->>'tipo'))) from jsonb_array_elements(p_actividades))<>jsonb_array_length(p_actividades) then
  raise exception 'Actividades repetidas o más de 28 entrenamientos' using errcode='23514'; end if;
 perform 1 from public.alumnos where id=(p_plan->>'alumno_id')::uuid and coach_id=auth.uid() for update;
 if not found then raise exception 'Alumno no disponible' using errcode='42501'; end if;
 if (select count(*) from public.planes_mensuales where alumno_id=(p_plan->>'alumno_id')::uuid)>=50 then
  raise exception 'Máximo 50 planes por alumno' using errcode='23514'; end if;
 insert into public.planes_mensuales(id,alumno_id,nombre,inicio,activo,semanas,orden)
 values(v_id,(p_plan->>'alumno_id')::uuid,p_plan->>'nombre',(p_plan->>'inicio')::date,(p_plan->>'activo')::boolean,(p_plan->>'semanas')::integer,(p_plan->>'orden')::integer);
 orden_dia:=0;
 for actividad in select value from jsonb_array_elements(p_actividades) loop
  tipo:=btrim(actividad->>'tipo'); cantidad:=(actividad->>'dias')::integer;
  insert into public.sesiones(plan_id,dia,tipo,nombre,orden)
   select v_id,null,tipo,left(tipo,48)||' · Día '||n,orden_dia+n-1 from generate_series(1,cantidad) n;
  insert into public.actividades_plan(coach_id,nombre) values(auth.uid(),tipo) on conflict do nothing;
  orden_dia:=orden_dia+cantidad;
 end loop;
 return v_id;
end $$;
revoke all on function public.crear_plan_con_actividades(jsonb,jsonb) from public,anon;
grant execute on function public.crear_plan_con_actividades(jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
