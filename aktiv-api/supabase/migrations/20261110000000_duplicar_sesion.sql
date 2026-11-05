-- 41: copia atómica de un día dentro de su plan. Solo el coach propietario.
begin;
create function public.duplicar_sesion(p_origen uuid, p_id uuid, p_nombre text, p_dia smallint)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  original public.sesiones%rowtype;
  ejercicios jsonb;
  ejercicio jsonb;
  nueva_activacion jsonb;
  nuevo_ejercicio uuid;
  siguiente integer;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and rol='coach') then
    raise exception 'No tenés permiso para duplicar entrenamientos.' using errcode='42501';
  end if;
  if p_id is null or p_nombre is null or length(trim(p_nombre)) not between 1 and 60
     or (p_dia is not null and p_dia not between 1 and 7) then
    raise exception 'Revisá el nombre y el día de la copia.' using errcode='P0001';
  end if;
  select s.* into original from public.sesiones s
    join public.planes_mensuales p on p.id=s.plan_id
    join public.alumnos a on a.id=p.alumno_id
    where s.id=p_origen and a.coach_id=auth.uid();
  if not found then raise exception 'El entrenamiento no existe o no tenés acceso.' using errcode='P0002'; end if;
  -- Serializa duplicaciones y cambios de duración del mismo plan.
  perform 1 from public.planes_mensuales where id=original.plan_id for update;
  select * into original from public.sesiones where id=p_origen for update;
  if not found then raise exception 'El entrenamiento ya no existe.' using errcode='P0002'; end if;
  if (select count(*) from public.sesiones where plan_id=original.plan_id) >= 28 then
    raise exception 'Se alcanzó el máximo de 28 días por plan.' using errcode='P0001';
  end if;
  select coalesce(max(orden),-1)+1 into siguiente from public.sesiones where plan_id=original.plan_id;
  -- Una sola lectura para obtener un snapshot coherente de ejercicios/semanas.
  select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('semanas',
    (select coalesce(jsonb_agg(to_jsonb(c) order by c.semana),'[]'::jsonb)
      from public.ejercicio_semanas c where c.ejercicio_id=e.id)) order by e.orden,e.id),'[]'::jsonb)
    into ejercicios from public.sesion_ejercicios e where e.sesion_id=p_origen;
  select coalesce(jsonb_agg(item || jsonb_build_object('id',gen_random_uuid()) order by posicion),'[]'::jsonb)
    into nueva_activacion from jsonb_array_elements(original.activacion) with ordinality as x(item,posicion);
  insert into public.sesiones(id,plan_id,nombre,dia,tipo,franja,calentamiento,enfriamiento,orden,bloques,activacion)
    values(p_id,original.plan_id,trim(p_nombre),p_dia,original.tipo,original.franja,
      original.calentamiento,original.enfriamiento,siguiente,original.bloques,nueva_activacion);
  for ejercicio in select value from jsonb_array_elements(ejercicios) loop
    nuevo_ejercicio := gen_random_uuid();
    insert into public.sesion_ejercicios(id,sesion_id,nombre,grupo,orden,descanso)
      values(nuevo_ejercicio,p_id,ejercicio->>'nombre',(ejercicio->>'grupo')::smallint,
        (ejercicio->>'orden')::integer,ejercicio->>'descanso');
    -- El trigger crea todas las celdas del plan sin pesos. Solo copiar indicaciones,
    -- conservando vacíos: no materializar la herencia de semanas anteriores.
    update public.ejercicio_semanas c set prescripcion=s->>'prescripcion'
      from jsonb_array_elements(ejercicio->'semanas') s
      where c.ejercicio_id=nuevo_ejercicio and c.semana=(s->>'semana')::smallint;
  end loop;
  return p_id;
end;
$$;
revoke all on function public.duplicar_sesion(uuid,uuid,text,smallint) from public,anon;
grant execute on function public.duplicar_sesion(uuid,uuid,text,smallint) to authenticated;
notify pgrst,'reload schema';
commit;
