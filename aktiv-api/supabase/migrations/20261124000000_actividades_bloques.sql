-- 55: actividad de cada bloque. No convierte ni elimina ejercicios existentes.
begin;
create function public.actividades_bloques_validas(datos jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare clave text; valor jsonb;
begin
 if jsonb_typeof(datos) is distinct from 'object' then return false; end if;
 for clave,valor in select * from jsonb_each(datos) loop
  if clave !~ '^(?:[1-9]|1[0-9]|20)$' or jsonb_typeof(valor) is distinct from 'string'
    or valor #>> '{}' not in ('Movilidad','Activación','Fuerza') then return false; end if;
 end loop;
 return true;
end $$;
alter table public.sesiones add column "actividadesBloques" jsonb not null default '{}'::jsonb
 check(public.actividades_bloques_validas("actividadesBloques"));
grant select("actividadesBloques"),insert("actividadesBloques"),update("actividadesBloques") on public.sesiones to authenticated;

create or replace function public.duplicar_sesion(p_origen uuid, p_id uuid, p_nombre text, p_dia smallint)
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
  insert into public.sesiones(id,plan_id,nombre,dia,tipo,franja,calentamiento,enfriamiento,orden,bloques,activacion,"actividadesBloques")
    values(p_id,original.plan_id,trim(p_nombre),p_dia,original.tipo,original.franja,
      original.calentamiento,original.enfriamiento,siguiente,original.bloques,nueva_activacion,original."actividadesBloques");
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
  insert into public.planes_mensuales(id,alumno_id,nombre,inicio,semanas,activo,orden,running)
    values(p_id,p_alumno,trim(p_nombre),p_inicio,original.semanas,false,siguiente,original.running);
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

create or replace function public.asignar_plan_modelo(p_modelo uuid,p_id uuid,p_alumno uuid,p_nombre text,p_inicio date)
returns uuid language plpgsql security invoker set search_path='' as $$
declare modelo public.planes_modelo%rowtype; mapa jsonb:='{}'; sesion jsonb; ejercicio jsonb;
  activacion jsonb; nueva_sesion uuid; nuevo_ejercicio uuid; siguiente integer;
begin
  if not public.es_coach() then raise exception 'Solo el profesor puede asignar modelos' using errcode='42501'; end if;
  if p_id is null or p_nombre is null or length(btrim(p_nombre)) not between 1 and 120 or p_inicio is null
    or p_inicio not between date '2000-01-01' and date '2100-01-01' then raise exception 'Revisá los datos del plan' using errcode='P0001'; end if;
  perform 1 from public.alumnos where id=p_alumno and coach_id=auth.uid() for update;
  if not found then raise exception 'El alumno no existe o no tenés acceso' using errcode='P0002'; end if;
  select * into modelo from public.planes_modelo where id=p_modelo and coach_id=auth.uid() for share;
  if not found then raise exception 'El modelo no existe o no tenés acceso' using errcode='P0002'; end if;
  -- El cliente conserva el ID al reintentar una respuesta perdida.
  if exists(select 1 from public.planes_mensuales where id=p_id and alumno_id=p_alumno) then return p_id; end if;
  if (select count(*) from public.planes_mensuales where alumno_id=p_alumno)>=50 then
    raise exception 'Se alcanzó el máximo de 50 planes por alumno' using errcode='P0001'; end if;
  select coalesce(max(orden),-1)+1 into siguiente from public.planes_mensuales where alumno_id=p_alumno;
  insert into public.planes_mensuales(id,alumno_id,nombre,inicio,semanas,activo,orden,running)
    values(p_id,p_alumno,btrim(p_nombre),p_inicio,modelo.semanas,false,siguiente,modelo.running);
  for sesion in select value from jsonb_array_elements(modelo.sesiones) loop
    nueva_sesion:=gen_random_uuid(); mapa:=mapa||jsonb_build_object(sesion->>'id',nueva_sesion);
    select coalesce(jsonb_agg(item || jsonb_build_object('id',gen_random_uuid()) order by posicion),'[]'::jsonb)
      into activacion from jsonb_array_elements(coalesce(sesion->'activacion','[]'::jsonb)) with ordinality x(item,posicion);
    insert into public.sesiones(id,plan_id,nombre,dia,tipo,franja,calentamiento,enfriamiento,orden,bloques,activacion,dias,"actividadesBloques")
      values(nueva_sesion,p_id,sesion->>'nombre',(sesion->>'dia')::smallint,sesion->>'tipo',coalesce(sesion->>'franja','Sin definir'),
        sesion->>'calentamiento',sesion->>'enfriamiento',(sesion->>'orden')::int,
        array(select value::smallint from jsonb_array_elements_text(coalesce(sesion->'bloques','[]'::jsonb))),activacion,case when sesion ? 'dias' then array(select value::smallint from jsonb_array_elements_text(sesion->'dias')) else null end,coalesce(sesion->'actividadesBloques','{}'::jsonb));
    for ejercicio in select value from jsonb_array_elements(sesion->'ejercicios') loop
      nuevo_ejercicio:=gen_random_uuid();
      insert into public.sesion_ejercicios(id,sesion_id,nombre,grupo,orden,descanso)
        values(nuevo_ejercicio,nueva_sesion,ejercicio->>'nombre',(ejercicio->>'grupo')::smallint,(ejercicio->>'orden')::int,ejercicio->>'descanso');
      update public.ejercicio_semanas c set prescripcion=celda.datos->>'prescripcion'
        from jsonb_array_elements(ejercicio->'semanas') celda(datos)
        where c.ejercicio_id=nuevo_ejercicio and c.semana=(celda.datos->>'semana')::smallint;
    end loop;
  end loop;
  update public.planes_mensuales set distribucion=public.remapear_distribucion_plan(modelo.distribucion,mapa) where id=p_id;
  return p_id;
end $$;
notify pgrst, 'reload schema';
commit;
