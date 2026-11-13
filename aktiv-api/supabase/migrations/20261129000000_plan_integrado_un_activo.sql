-- Una sola planificación activa. Si hay conflictos históricos, se revisan antes
-- de continuar; la migración no elige ni desactiva planes automáticamente.
begin;

do $$
begin
 if exists(select 1 from public.planes_mensuales where activo group by alumno_id having count(*) > 1) then
  raise exception 'Hay alumnos con más de un plan activo. Revisá esos planes antes de aplicar esta migración.';
 end if;
end $$;

drop index if exists public.planes_mensuales_un_activo_por_tipo;
create unique index planes_mensuales_un_plan_activo on public.planes_mensuales(alumno_id) where activo;

create or replace function public.activar_plan_mensual(p_plan uuid,p_reemplazar boolean default false) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p public.planes_mensuales%rowtype; existente public.planes_mensuales%rowtype;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede activar planes' using errcode='42501'; end if;
 select x.* into p from public.planes_mensuales x join public.alumnos a on a.id=x.alumno_id
  where x.id=p_plan and a.coach_id=auth.uid() for update of x;
 if not found then raise exception 'El plan no existe o no tenés acceso' using errcode='P0002'; end if;
 perform 1 from public.alumnos where id=p.alumno_id for update;
 select * into existente from public.planes_mensuales where alumno_id=p.alumno_id and activo and id<>p.id for update;
 if found and not p_reemplazar then raise exception 'Ya existe un plan activo' using errcode='23505', detail=existente.nombre; end if;
 if found then update public.planes_mensuales set activo=false where id=existente.id; end if;
 update public.planes_mensuales set activo=true where id=p.id;
 return p.id;
end $$;

-- Copia la indicación efectiva de la semana de origen, incluso cuando esta
-- hereda una indicación anterior; nunca modifica el peso de destino.
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

-- Las copias conservan el tipo de planes anteriores, incluso sin sesiones.
create or replace function public.duplicar_plan(p_origen uuid, p_id uuid, p_alumno uuid, p_nombre text, p_inicio date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  original public.planes_mensuales%rowtype; mapa jsonb:='{}';
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
  insert into public.planes_mensuales(id,alumno_id,nombre,inicio,semanas,activo,orden,running,tipo)
    values(p_id,p_alumno,trim(p_nombre),p_inicio,original.semanas,false,siguiente,original.running,original.tipo);
  for sesion in select value from jsonb_array_elements(sesiones) loop
    nueva_sesion:=gen_random_uuid(); mapa:=mapa||jsonb_build_object(sesion->>'id',nueva_sesion);
    select coalesce(jsonb_agg(item || jsonb_build_object('id',gen_random_uuid()) order by posicion),'[]'::jsonb)
      into activacion from jsonb_array_elements(sesion->'activacion') with ordinality as x(item,posicion);
    insert into public.sesiones(id,plan_id,nombre,dia,tipo,franja,calentamiento,enfriamiento,orden,bloques,activacion,dias,"actividadesBloques")
      values(nueva_sesion,p_id,sesion->>'nombre',(sesion->>'dia')::smallint,sesion->>'tipo',sesion->>'franja',
        sesion->>'calentamiento',sesion->>'enfriamiento',(sesion->>'orden')::integer,
        array(select value::smallint from jsonb_array_elements_text(sesion->'bloques')),activacion,case when sesion ? 'dias' then array(select value::smallint from jsonb_array_elements_text(sesion->'dias')) else null end,coalesce(sesion->'actividadesBloques','{}'::jsonb));
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
  update public.planes_mensuales set distribucion=public.remapear_distribucion_plan(original.distribucion,mapa) where id=p_id;
  return p_id;
end;
$$;

notify pgrst,'reload schema';
commit;
