-- 42: copia completa e independiente, siempre como borrador y sin pesos.
begin;
create function public.duplicar_plan(p_origen uuid, p_id uuid, p_alumno uuid, p_nombre text, p_inicio date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  original public.planes_mensuales%rowtype;
  sesiones jsonb;
  sesion jsonb;
  ejercicio jsonb;
  activacion jsonb;
  nueva_sesion uuid;
  nuevo_ejercicio uuid;
  siguiente integer;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and rol='coach') then
    raise exception 'No tenés permiso para copiar planes.' using errcode='42501';
  end if;
  if p_id is null or p_alumno is null or p_nombre is null or length(trim(p_nombre)) not between 1 and 120
     or p_inicio is null or p_inicio not between date '2000-01-01' and date '2100-01-01' then
    raise exception 'Revisá los datos de la copia.' using errcode='P0001';
  end if;
  -- Bloquea el destino para serializar copias concurrentes y calcular su orden.
  perform 1 from public.alumnos where id=p_alumno and coach_id=auth.uid() for update;
  if not found then raise exception 'El alumno no existe o no tenés acceso.' using errcode='P0002'; end if;
  select p.* into original from public.planes_mensuales p
    join public.alumnos a on a.id=p.alumno_id where p.id=p_origen and a.coach_id=auth.uid() for share of p;
  if not found then raise exception 'El plan no existe o no tenés acceso.' using errcode='P0002'; end if;
  if (select count(*) from public.planes_mensuales where alumno_id=p_alumno)>=50 then
    raise exception 'Se alcanzó el máximo de 50 planes por alumno.' using errcode='P0001';
  end if;
  -- Snapshot único de la rutina: no mezclar versiones entre días y semanas.
  select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('ejercicios',
    (select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('semanas',
      (select coalesce(jsonb_agg(to_jsonb(c) order by c.semana),'[]'::jsonb)
        from public.ejercicio_semanas c where c.ejercicio_id=e.id)) order by e.orden,e.id),'[]'::jsonb)
      from public.sesion_ejercicios e where e.sesion_id=s.id)) order by s.orden,s.id),'[]'::jsonb)
    into sesiones from public.sesiones s where s.plan_id=p_origen;
  select coalesce(max(orden),-1)+1 into siguiente from public.planes_mensuales where alumno_id=p_alumno;
  insert into public.planes_mensuales(id,alumno_id,nombre,inicio,semanas,activo,orden)
    values(p_id,p_alumno,trim(p_nombre),p_inicio,original.semanas,false,siguiente);
  for sesion in select value from jsonb_array_elements(sesiones) loop
    nueva_sesion := gen_random_uuid();
    select coalesce(jsonb_agg(item || jsonb_build_object('id',gen_random_uuid()) order by posicion),'[]'::jsonb)
      into activacion from jsonb_array_elements(sesion->'activacion') with ordinality as x(item,posicion);
    insert into public.sesiones(id,plan_id,nombre,dia,tipo,franja,calentamiento,enfriamiento,orden,bloques,activacion)
      values(nueva_sesion,p_id,sesion->>'nombre',(sesion->>'dia')::smallint,sesion->>'tipo',sesion->>'franja',
        sesion->>'calentamiento',sesion->>'enfriamiento',(sesion->>'orden')::integer,
        array(select value::smallint from jsonb_array_elements_text(sesion->'bloques')),activacion);
    for ejercicio in select value from jsonb_array_elements(sesion->'ejercicios') loop
      nuevo_ejercicio := gen_random_uuid();
      insert into public.sesion_ejercicios(id,sesion_id,nombre,grupo,orden,descanso)
        values(nuevo_ejercicio,nueva_sesion,ejercicio->>'nombre',(ejercicio->>'grupo')::smallint,
          (ejercicio->>'orden')::integer,ejercicio->>'descanso');
      -- El trigger crea las semanas con pesos y fechas NULL. Copiar solo indicaciones.
      update public.ejercicio_semanas c set prescripcion=celda.datos->>'prescripcion'
        from jsonb_array_elements(ejercicio->'semanas') as celda(datos)
        where c.ejercicio_id=nuevo_ejercicio and c.semana=(celda.datos->>'semana')::smallint;
    end loop;
  end loop;
  return p_id;
end;
$$;
revoke all on function public.duplicar_plan(uuid,uuid,uuid,text,date) from public,anon;
grant execute on function public.duplicar_plan(uuid,uuid,uuid,text,date) to authenticated;
notify pgrst,'reload schema';
commit;
