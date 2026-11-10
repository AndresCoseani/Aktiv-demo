-- 52: una sesión compartida en varios días, sin duplicar ejercicios ni semanas.
begin;
alter table public.sesiones add column dias smallint[];
update public.sesiones set dias=case when dia is null then '{}'::smallint[] else array[dia] end;
create function public.sincronizar_dias_sesion() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
   if new.dias is null then new.dias:=case when new.dia is null then '{}'::smallint[] else array[new.dia] end; end if;
 elsif new.dias is not distinct from old.dias and new.dia is distinct from old.dia then
   new.dias:=case when new.dia is null then '{}'::smallint[] else array[new.dia] end;
 end if;
 if new.dias is null or cardinality(new.dias)>7 or array_position(new.dias,null) is not null
   or not(new.dias <@ array[1,2,3,4,5,6,7]::smallint[])
   or cardinality(new.dias)<>(select count(distinct d) from unnest(new.dias) d) then
   raise exception 'Revisá los días de la sesión' using errcode='23514';
 end if;
 select coalesce(array_agg(d order by d),'{}'::smallint[]) into new.dias from unnest(new.dias) d;
 new.dia:=new.dias[1];
 return new;
end $$;
create trigger sincronizar_dias_sesion before insert or update on public.sesiones for each row execute function public.sincronizar_dias_sesion();
alter table public.sesiones alter column dias set not null;
grant select,insert,update(dias) on public.sesiones to authenticated;
create function public.duplicar_sesion_dias(p_origen uuid,p_id uuid,p_nombre text,p_dia smallint,p_dias smallint[])
returns uuid language plpgsql security invoker set search_path='' as $$
begin
 perform public.duplicar_sesion(p_origen,p_id,p_nombre,p_dia);
 update public.sesiones set dias=p_dias where id=p_id;
 return p_id;
end $$;
revoke all on function public.duplicar_sesion_dias(uuid,uuid,text,smallint,smallint[]) from public,anon;
grant execute on function public.duplicar_sesion_dias(uuid,uuid,text,smallint,smallint[]) to authenticated;
create or replace function public.duplicar_plan(p_origen uuid, p_id uuid, p_alumno uuid, p_nombre text, p_inicio date)
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
  insert into public.planes_mensuales(id,alumno_id,nombre,inicio,semanas,activo,orden,running)
    values(p_id,p_alumno,trim(p_nombre),p_inicio,original.semanas,false,siguiente,original.running);
  for sesion in select value from jsonb_array_elements(sesiones) loop
    nueva_sesion := gen_random_uuid();
    select coalesce(jsonb_agg(item || jsonb_build_object('id',gen_random_uuid()) order by posicion),'[]'::jsonb)
      into activacion from jsonb_array_elements(sesion->'activacion') with ordinality as x(item,posicion);
    insert into public.sesiones(id,plan_id,nombre,dia,tipo,franja,calentamiento,enfriamiento,orden,bloques,activacion,dias)
      values(nueva_sesion,p_id,sesion->>'nombre',(sesion->>'dia')::smallint,sesion->>'tipo',sesion->>'franja',
        sesion->>'calentamiento',sesion->>'enfriamiento',(sesion->>'orden')::integer,
        array(select value::smallint from jsonb_array_elements_text(sesion->'bloques')),activacion,case when sesion ? 'dias' then array(select value::smallint from jsonb_array_elements_text(sesion->'dias')) else null end);
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

create or replace function public.asignar_plan_modelo(p_modelo uuid,p_id uuid,p_alumno uuid,p_nombre text,p_inicio date)
returns uuid language plpgsql security invoker set search_path='' as $$
declare modelo public.planes_modelo%rowtype; sesion jsonb; ejercicio jsonb;
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
    nueva_sesion:=gen_random_uuid();
    select coalesce(jsonb_agg(item || jsonb_build_object('id',gen_random_uuid()) order by posicion),'[]'::jsonb)
      into activacion from jsonb_array_elements(coalesce(sesion->'activacion','[]'::jsonb)) with ordinality x(item,posicion);
    insert into public.sesiones(id,plan_id,nombre,dia,tipo,franja,calentamiento,enfriamiento,orden,bloques,activacion,dias)
      values(nueva_sesion,p_id,sesion->>'nombre',(sesion->>'dia')::smallint,sesion->>'tipo',coalesce(sesion->>'franja','Sin definir'),
        sesion->>'calentamiento',sesion->>'enfriamiento',(sesion->>'orden')::int,
        array(select value::smallint from jsonb_array_elements_text(coalesce(sesion->'bloques','[]'::jsonb))),activacion,case when sesion ? 'dias' then array(select value::smallint from jsonb_array_elements_text(sesion->'dias')) else null end);
    for ejercicio in select value from jsonb_array_elements(sesion->'ejercicios') loop
      nuevo_ejercicio:=gen_random_uuid();
      insert into public.sesion_ejercicios(id,sesion_id,nombre,grupo,orden,descanso)
        values(nuevo_ejercicio,nueva_sesion,ejercicio->>'nombre',(ejercicio->>'grupo')::smallint,(ejercicio->>'orden')::int,ejercicio->>'descanso');
      update public.ejercicio_semanas c set prescripcion=celda.datos->>'prescripcion'
        from jsonb_array_elements(ejercicio->'semanas') celda(datos)
        where c.ejercicio_id=nuevo_ejercicio and c.semana=(celda.datos->>'semana')::smallint;
    end loop;
  end loop;
  return p_id;
end $$;

notify pgrst,'reload schema';
commit;
