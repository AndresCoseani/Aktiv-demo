-- Running es una actividad que se asigna en la semana y se completa como texto.
-- Conserva los planes/modelos Running existentes; solo cambia las reglas futuras.
begin;

drop trigger if exists planes_mensuales_tipo_running on public.planes_mensuales;
drop function if exists public.inferir_tipo_plan_running();

create or replace function public.validar_tipo_modelo() returns trigger
language plpgsql set search_path='' as $$
begin
 if exists(select 1 from jsonb_array_elements(new.sesiones) s where s->>'tipo'<>new.tipo) then
  raise exception 'Todas las sesiones deben ser del mismo tipo que el modelo' using errcode='23514';
 end if;
 return new;
end $$;

create or replace function public.validar_distribucion_tipo_unico() returns trigger
language plpgsql set search_path='' as $$
declare actividad jsonb;
begin
 for actividad in
  select a.value from jsonb_each(coalesce(new.distribucion->'base','{}')) d cross join lateral jsonb_array_elements(d.value) a
  union all
  select a.value from jsonb_each(coalesce(new.distribucion->'semanas','{}')) w cross join lateral jsonb_each(w.value) d cross join lateral jsonb_array_elements(d.value) a
 loop
  -- Running y Descanso no son sesiones del plan, sino actividades de su calendario.
  if actividad->>'tipo' not in (new.tipo,'Running','Descanso') then
   raise exception 'La distribución debe usar la actividad del plan, Running o Descanso' using errcode='23514';
  end if;
 end loop;
 return new;
end $$;

-- Copiar semanas también copia los textos semanales de Running en planes de Fuerza.
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
 update public.planes_mensuales set
  running=jsonb_set(running,array[p_destino::text],coalesce(running->p_origen::text,'{}'),true),
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

