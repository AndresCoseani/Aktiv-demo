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


-- Running es una actividad que se asigna en la semana y se completa como texto.
-- Conserva los planes/modelos Running existentes; solo cambia las reglas futuras.
begin;

drop trigger if exists planes_mensuales_tipo_running on public.planes_mensuales;
drop function if exists public.inferir_tipo_plan_running();

-- Las sesiones de rutina son del tipo del plan; Running se carga en el calendario semanal.
create or replace function public.validar_tipo_sesion_plan() returns trigger
language plpgsql set search_path='' as $$
declare t text;
begin
 select tipo into t from public.planes_mensuales where id=new.plan_id for update;
 if not found then raise exception 'Plan inexistente' using errcode='23503'; end if;
 if new.tipo<>t then raise exception 'La sesión debe ser del mismo tipo que el plan' using errcode='23514'; end if;
 return new;
end $$;

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

-- Al asignar un modelo, las sesiones de rutina se eligen manualmente; las
-- actividades Running y sus textos semanales sí acompañan la copia.
create or replace function public.distribucion_running_modelo(d jsonb,p_semanas integer) returns jsonb
language plpgsql immutable set search_path='' as $$
declare dia record; semana record; running_dia jsonb; base jsonb:='{}'; semanas jsonb:='{}'; tiene_base boolean;
begin
 for dia in select * from jsonb_each(coalesce(d->'base','{}')) loop
  select coalesce(jsonb_agg(a),'[]'::jsonb) into running_dia
   from jsonb_array_elements(dia.value) a
   where a->>'tipo'='Running' and not (a ? 'sesionId');
  if jsonb_array_length(running_dia)>0 then base:=base||jsonb_build_object(dia.key,running_dia); end if;
 end loop;
 for semana in select * from jsonb_each(coalesce(d->'semanas','{}')) w
   where w.key~'^[1-9][0-9]*$' and w.key::integer<=p_semanas loop
  for dia in select * from jsonb_each(semana.value) loop
   select coalesce(jsonb_agg(a),'[]'::jsonb) into running_dia
    from jsonb_array_elements(dia.value) a
    where a->>'tipo'='Running' and not (a ? 'sesionId');
   tiene_base:=coalesce(jsonb_array_length(base->dia.key),0)>0;
   -- Una excepción explícita reemplaza la actividad base; mantener [] permite
   -- que un modelo quite Running solo durante esa semana.
   if tiene_base or jsonb_array_length(running_dia)>0 then
    semanas:=jsonb_set(semanas,array[semana.key,dia.key],running_dia,true);
   end if;
  end loop;
 end loop;
 return jsonb_build_object('base',base,'semanas',semanas);
end $$;
revoke all on function public.distribucion_running_modelo(jsonb,integer) from public,anon;
grant execute on function public.distribucion_running_modelo(jsonb,integer) to authenticated;

create or replace function public.asignar_plan_modelo_duracion(p_modelo uuid,p_id uuid,p_alumno uuid,p_nombre text,p_inicio date,p_semanas integer,p_asignaciones jsonb default '[]'::jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare resultado uuid; t text; m public.planes_modelo%rowtype; asignacion jsonb; fuente jsonb; copia uuid;
  base jsonb:='{}'; distribucion_run jsonb; semanas_run jsonb; semana record; dia record;
  rutina_base jsonb; running_recortado jsonb;
begin
 if p_semanas is null or p_semanas not between 1 and 104 then raise exception 'Duración inválida' using errcode='23514'; end if;
 if jsonb_typeof(p_asignaciones) is distinct from 'array' or jsonb_array_length(p_asignaciones)>7 then raise exception 'Asignaciones inválidas' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(p_asignaciones) a group by a->>'dia' having count(*)>1) then raise exception 'Solo una sesión por día' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(p_asignaciones) a group by a->>'sesionId' having count(*)>1) then raise exception 'Una sesión no se puede asignar a varios días' using errcode='23514'; end if;
 select * into m from public.planes_modelo where id=p_modelo and coach_id=auth.uid();
 if not found then raise exception 'El modelo no existe o no tenés acceso' using errcode='P0002'; end if;
 t:=m.tipo;
 for asignacion in select value from jsonb_array_elements(p_asignaciones) loop
  if coalesce(asignacion->>'dia','')!~'^[1-7]$' or not exists(select 1 from jsonb_array_elements(m.sesiones) s where s->>'id'=asignacion->>'sesionId' and s->>'tipo'=t) then
   raise exception 'La sesión elegida no pertenece al modelo o el día no es válido' using errcode='23514'; end if;
 end loop;
 resultado:=public.asignar_plan_modelo(p_modelo,p_id,p_alumno,p_nombre,p_inicio);
 distribucion_run:=public.distribucion_running_modelo(m.distribucion,p_semanas);
 base:=coalesce(distribucion_run->'base','{}'::jsonb);
 for asignacion in select value from jsonb_array_elements(p_asignaciones) loop
  select value into fuente from jsonb_array_elements(m.sesiones) where value->>'id'=asignacion->>'sesionId';
  select id into copia from public.sesiones where plan_id=resultado and tipo=t and orden=(fuente->>'orden')::integer order by id limit 1;
  if copia is null then raise exception 'No se pudo encontrar la sesión copiada' using errcode='23514'; end if;
  base:=jsonb_set(base,array[asignacion->>'dia'],coalesce(base->(asignacion->>'dia'),'[]'::jsonb)||jsonb_build_array(jsonb_build_object('tipo',t,'sesionId',copia)),true);
 end loop;
 semanas_run:=coalesce(distribucion_run->'semanas','{}'::jsonb);
 for semana in select * from jsonb_each(semanas_run) loop
  for dia in select * from jsonb_each(semana.value) loop
   select coalesce(jsonb_agg(a),'[]'::jsonb) into rutina_base
    from jsonb_array_elements(coalesce(base->dia.key,'[]'::jsonb)) a
    where not (a->>'tipo'='Running' and not (a ? 'sesionId'));
   semanas_run:=jsonb_set(semanas_run,array[semana.key,dia.key],rutina_base||dia.value,true);
  end loop;
 end loop;
 select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) into running_recortado
  from jsonb_each(coalesce(m.running,'{}'::jsonb)) as r(k,v)
  where k~'^[1-9][0-9]*$' and k::integer<=p_semanas;
 update public.planes_mensuales set tipo=t,semanas=p_semanas,running=running_recortado,
  distribucion=jsonb_build_object('base',base,'semanas',semanas_run) where id=resultado;
 delete from public.ejercicio_semanas c using public.sesion_ejercicios e,public.sesiones s
  where c.ejercicio_id=e.id and e.sesion_id=s.id and s.plan_id=resultado and c.semana>p_semanas;
 insert into public.ejercicio_semanas(ejercicio_id,semana,prescripcion,peso,peso_fecha)
  select e.id,n,'',null,null from public.sesiones s join public.sesion_ejercicios e on e.sesion_id=s.id
   cross join lateral generate_series(1,p_semanas) n where s.plan_id=resultado
  on conflict(ejercicio_id,semana) do nothing;
 return resultado;
end $$;
revoke all on function public.asignar_plan_modelo_duracion(uuid,uuid,uuid,text,date,integer,jsonb) from public,anon;
grant execute on function public.asignar_plan_modelo_duracion(uuid,uuid,uuid,text,date,integer,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;

