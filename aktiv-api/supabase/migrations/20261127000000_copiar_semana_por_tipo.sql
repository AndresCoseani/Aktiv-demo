begin;

-- Copiar una semana de un plan de Fuerza no debe crear un objeto Running vacío:
-- el trigger del plan interpreta cualquier dato Running como cambio de tipo.
create or replace function public.copiar_semana_plan(p_plan uuid,p_origen integer,p_destino integer) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p public.planes_mensuales%rowtype;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede copiar semanas' using errcode='42501'; end if;
 select x.* into p from public.planes_mensuales x join public.alumnos a on a.id=x.alumno_id
  where x.id=p_plan and a.coach_id=auth.uid() for update of x;
 if not found then raise exception 'El plan no existe o no tenÃ©s acceso' using errcode='P0002'; end if;
 if p_origen is null or p_destino is null or p_origen=p_destino or p_origen not between 1 and p.semanas or p_destino not between 1 and p.semanas then
  raise exception 'Semanas invÃ¡lidas' using errcode='23514';
 end if;
 update public.planes_mensuales set
  running=case when tipo='Running' then jsonb_set(running,array[p_destino::text],coalesce(running->p_origen::text,'{}'),true) else running end,
  distribucion=distribucion||jsonb_build_object('semanas',coalesce(distribucion->'semanas','{}')||jsonb_build_object(p_destino::text,coalesce(distribucion#>array['semanas',p_origen::text],'{}')))
 where id=p_plan;
 update public.ejercicio_semanas destino set prescripcion=origen.prescripcion
 from public.ejercicio_semanas origen join public.sesion_ejercicios e on e.id=origen.ejercicio_id join public.sesiones s on s.id=e.sesion_id
 where s.plan_id=p_plan and destino.ejercicio_id=origen.ejercicio_id and origen.semana=p_origen and destino.semana=p_destino;
 return p_plan;
end;
$$;
revoke all on function public.copiar_semana_plan(uuid,integer,integer) from public,anon;
grant execute on function public.copiar_semana_plan(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
