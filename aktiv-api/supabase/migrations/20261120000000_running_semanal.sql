-- 51: grilla exclusiva de Running. No convierte ni borra sesiones anteriores.
begin;
alter table public.planes_mensuales add column running jsonb not null default '{}'::jsonb;
alter table public.planes_modelo add column running jsonb not null default '{}'::jsonb;
create function public.validar_running() returns trigger language plpgsql set search_path='' as $$
declare semana record; campo record;
begin
 if jsonb_typeof(new.running)<>'object' or octet_length(new.running::text)>4194304 then raise exception 'Grilla de Running inválida' using errcode='23514'; end if;
 for semana in select * from jsonb_each(new.running) loop
   if semana.key !~ '^([1-9]|[1-9][0-9]|10[0-4])$' or jsonb_typeof(semana.value)<>'object' then raise exception 'Semana de Running inválida' using errcode='23514'; end if;
   for campo in select * from jsonb_each(semana.value) loop
    if campo.key not in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','volumen','sugerencias') or jsonb_typeof(campo.value)<>'string' or char_length(campo.value #>> '{}')>4000 then raise exception 'Celda de Running inválida' using errcode='23514'; end if;
    if campo.key='volumen' and (campo.value #>> '{}') !~ '^([0-9]{1,4}([.,][0-9]{1,2})?)?$' then raise exception 'Volumen de Running inválido' using errcode='23514'; end if;
    if semana.key::integer>new.semanas and btrim(campo.value #>> '{}')<>'' then raise exception 'Las semanas de Running que querés quitar tienen contenido. Vacialas primero.' using errcode='23514'; end if;
   end loop;
 end loop;
 return new;
end $$;
create trigger validar_running_plan before insert or update on public.planes_mensuales for each row execute function public.validar_running();
create trigger validar_running_modelo before insert or update on public.planes_modelo for each row execute function public.validar_running();
create function public.guardar_running(p_plan uuid,p_cambio jsonb,p_copiar boolean default false) returns uuid
language plpgsql security invoker set search_path='' as $$
declare plan public.planes_mensuales%rowtype; semana integer; origen integer; campo text; texto text; siguiente jsonb;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede editar Running' using errcode='42501'; end if;
 select p.* into plan from public.planes_mensuales p join public.alumnos a on a.id=p.alumno_id where p.id=p_plan and a.coach_id=auth.uid() for update of p;
 if not found then raise exception 'El plan no existe o no tenés acceso' using errcode='P0002'; end if;
 if p_copiar then
  semana:=(p_cambio->>'destino')::integer; origen:=(p_cambio->>'origen')::integer;
  if origen is null or origen not between 1 and plan.semanas or origen=semana then raise exception 'Semana de origen inválida' using errcode='23514'; end if;
  siguiente:=coalesce(plan.running->origen::text,'{}'::jsonb);
 else
  semana:=(p_cambio->>'semana')::integer; campo:=p_cambio->>'campo'; texto:=p_cambio->>'texto';
  if campo is null or campo not in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','volumen','sugerencias') or jsonb_typeof(p_cambio->'texto') is distinct from 'string' then raise exception 'Celda inválida' using errcode='23514'; end if;
  siguiente:=coalesce(plan.running->semana::text,'{}'::jsonb) || jsonb_build_object(campo,texto);
 end if;
 if semana is null or semana not between 1 and plan.semanas then raise exception 'La semana no existe en el plan' using errcode='23514'; end if;
 update public.planes_mensuales set running=jsonb_set(running,array[semana::text],siguiente,true) where id=p_plan;
 return p_plan;
end $$;
revoke all on function public.guardar_running(uuid,jsonb,boolean) from public,anon;
grant execute on function public.guardar_running(uuid,jsonb,boolean) to authenticated;

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
    insert into public.sesiones(id,plan_id,nombre,dia,tipo,franja,calentamiento,enfriamiento,orden,bloques,activacion)
      values(nueva_sesion,p_id,sesion->>'nombre',(sesion->>'dia')::smallint,sesion->>'tipo',coalesce(sesion->>'franja','Sin definir'),
        sesion->>'calentamiento',sesion->>'enfriamiento',(sesion->>'orden')::int,
        array(select value::smallint from jsonb_array_elements_text(coalesce(sesion->'bloques','[]'::jsonb))),activacion);
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
