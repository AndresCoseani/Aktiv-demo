-- Evita que una copia vacía muestre una indicación heredada distinta.
begin;

create or replace function public.copiar_semana_plan(p_plan uuid,p_origen integer,p_destino integer) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p public.planes_mensuales%rowtype;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede copiar semanas' using errcode='42501'; end if;
 select x.* into p from public.planes_mensuales x join public.alumnos a on a.id=x.alumno_id
  where x.id=p_plan and a.coach_id=auth.uid() for update of x;
 if not found then raise exception 'El plan no existe o no tenés acceso' using errcode='P0002'; end if;
 if p_origen is null or p_destino is null or p_origen=p_destino or p_origen not between 1 and p.semanas or p_destino not between 1 and p.semanas then
  raise exception 'Semanas inválidas' using errcode='23514';
 end if;
 if exists (
  select 1 from public.sesion_ejercicios e
  join public.sesiones s on s.id=e.sesion_id
  where s.plan_id=p_plan
    and not exists (select 1 from public.ejercicio_semanas c where c.ejercicio_id=e.id and c.semana<=p_origen and btrim(c.prescripcion)<>'')
    and exists (select 1 from public.ejercicio_semanas c where c.ejercicio_id=e.id and c.semana<p_destino and btrim(c.prescripcion)<>'')
 ) then
  raise exception 'No se puede copiar una indicación vacía: la semana de destino heredaría una indicación anterior. Completá la semana de origen antes de duplicar.' using errcode='P0001';
 end if;
 update public.planes_mensuales set
  running=jsonb_set(running,array[p_destino::text],coalesce(running->p_origen::text,'{}'::jsonb),true),
  distribucion=distribucion||jsonb_build_object('semanas',coalesce(distribucion->'semanas','{}'::jsonb)||jsonb_build_object(p_destino::text,coalesce(distribucion#>array['semanas',p_origen::text],'{}'::jsonb)))
 where id=p_plan;
 update public.ejercicio_semanas destino set prescripcion=coalesce((
   select anterior.prescripcion from public.ejercicio_semanas anterior
   where anterior.ejercicio_id=destino.ejercicio_id and anterior.semana<=p_origen and btrim(anterior.prescripcion)<>''
   order by anterior.semana desc limit 1
  ),'')
 from public.sesion_ejercicios e join public.sesiones s on s.id=e.sesion_id
 where s.plan_id=p_plan and destino.ejercicio_id=e.id and destino.semana=p_destino;
 return p_plan;
end $$;

commit;
