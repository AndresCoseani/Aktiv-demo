-- 54: calendario único por plan, con rutinas vinculadas y excepciones semanales.
begin;
alter table public.planes_mensuales add column distribucion jsonb not null default '{}';
alter table public.planes_modelo add column distribucion jsonb not null default '{}';

create function public.comprobar_distribucion(d jsonb,semanas integer,sesiones jsonb) returns void
language plpgsql set search_path='' as $$
declare grupo record; dia record; a jsonb; grupos jsonb;
begin
 if jsonb_typeof(d)<>'object' or octet_length(d::text)>1048576 or exists(select 1 from jsonb_object_keys(d) k where k not in ('base','semanas')) then raise exception 'Planificación inválida' using errcode='23514'; end if;
 if d ? 'base' and jsonb_typeof(d->'base')<>'object' or d ? 'semanas' and jsonb_typeof(d->'semanas')<>'object' then raise exception 'Distribución inválida' using errcode='23514'; end if;
 grupos:=jsonb_build_object('0',coalesce(d->'base','{}'))||coalesce(d->'semanas','{}');
 for grupo in select * from jsonb_each(grupos) loop
  if grupo.key!~'^(0|[1-9]|[1-9][0-9]|10[0-4])$' or (grupo.key='0' and coalesce(d->'semanas','{}') ? '0') or jsonb_typeof(grupo.value)<>'object' then raise exception 'Semana inválida' using errcode='23514'; end if;
  for dia in select * from jsonb_each(grupo.value) loop
   if dia.key!~'^[1-7]$' or jsonb_typeof(dia.value)<>'array' or jsonb_array_length(dia.value)>8 then raise exception 'Día inválido' using errcode='23514'; end if;
   if grupo.key::int>semanas and jsonb_array_length(dia.value)>0 then raise exception 'Las semanas que querés quitar tienen actividades asignadas' using errcode='23514'; end if;
   if exists(select 1 from jsonb_array_elements(dia.value) x group by coalesce(x->>'sesionId',x->>'tipo') having count(*)>1) then raise exception 'Actividad repetida' using errcode='23514'; end if;
   for a in select value from jsonb_array_elements(dia.value) loop
    if jsonb_typeof(a)<>'object' or jsonb_typeof(a->'tipo') is distinct from 'string' or char_length(btrim(a->>'tipo')) not between 1 and 80 or exists(select 1 from jsonb_object_keys(a) k where k not in ('tipo','sesionId')) then raise exception 'Actividad inválida' using errcode='23514'; end if;
    if a ? 'sesionId' and not exists(select 1 from jsonb_array_elements(sesiones) s where s->>'id'=a->>'sesionId' and s->>'tipo'=a->>'tipo') then raise exception 'La rutina no pertenece a este plan o actividad' using errcode='23514'; end if;
   end loop;
  end loop;
 end loop;
end $$;
create function public.validar_distribucion() returns trigger language plpgsql set search_path='' as $$
declare sesiones jsonb;
begin
 if TG_TABLE_NAME='planes_modelo' then sesiones:=new.sesiones;
 else select coalesce(jsonb_agg(jsonb_build_object('id',id,'tipo',tipo)),'[]') into sesiones from public.sesiones where plan_id=new.id; end if;
 perform public.comprobar_distribucion(new.distribucion,new.semanas,sesiones); return new;
end $$;
create trigger validar_distribucion_plan before insert or update on public.planes_mensuales for each row execute function public.validar_distribucion();
create trigger validar_distribucion_modelo before insert or update on public.planes_modelo for each row execute function public.validar_distribucion();

create function public.asignar_dia_plan(p_plan uuid,p_cambio jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p public.planes_mensuales%rowtype; d integer; s integer; siguiente jsonb; w text;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede asignar actividades' using errcode='42501'; end if;
 select x.* into p from public.planes_mensuales x join public.alumnos a on a.id=x.alumno_id where x.id=p_plan and a.coach_id=auth.uid() for update of x;
 if not found then raise exception 'El plan no existe o no tenés acceso' using errcode='P0002'; end if;
 d:=(p_cambio->>'dia')::integer;s:=(p_cambio->>'semana')::integer;
 if d is null or d not between 1 and 7 or s is not null and s not between 1 and p.semanas or jsonb_typeof(p_cambio->'actividades') is distinct from 'array' then raise exception 'Asignación inválida' using errcode='23514'; end if;
 siguiente:=p.distribucion;
 if s is null then
  siguiente:=siguiente||jsonb_build_object('base',coalesce(siguiente->'base','{}')||jsonb_build_object(d::text,p_cambio->'actividades'));
  for w in select jsonb_object_keys(coalesce(siguiente->'semanas','{}')) loop siguiente:=siguiente#-array['semanas',w,d::text]; end loop;
 else
  siguiente:=siguiente||jsonb_build_object('semanas',coalesce(siguiente->'semanas','{}')||jsonb_build_object(s::text,coalesce(siguiente#>array['semanas',s::text],'{}')||jsonb_build_object(d::text,p_cambio->'actividades')));
 end if;
 update public.planes_mensuales set distribucion=siguiente where id=p_plan; return p_plan;
end $$;
revoke all on function public.asignar_dia_plan(uuid,jsonb) from public,anon;
grant execute on function public.asignar_dia_plan(uuid,jsonb) to authenticated;

create function public.copiar_semana_plan(p_plan uuid,p_origen integer,p_destino integer) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p public.planes_mensuales%rowtype;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede copiar semanas' using errcode='42501'; end if;
 select x.* into p from public.planes_mensuales x join public.alumnos a on a.id=x.alumno_id where x.id=p_plan and a.coach_id=auth.uid() for update of x;
 if not found then raise exception 'El plan no existe o no tenés acceso' using errcode='P0002'; end if;
 if p_origen is null or p_destino is null or p_origen=p_destino or p_origen not between 1 and p.semanas or p_destino not between 1 and p.semanas then raise exception 'Semanas inválidas' using errcode='23514'; end if;
 update public.planes_mensuales set
  running=jsonb_set(running,array[p_destino::text],coalesce(running->p_origen::text,'{}'),true),
  distribucion=distribucion||jsonb_build_object('semanas',coalesce(distribucion->'semanas','{}')||jsonb_build_object(p_destino::text,coalesce(distribucion#>array['semanas',p_origen::text],'{}')))
 where id=p_plan;
 update public.ejercicio_semanas destino set prescripcion=origen.prescripcion
 from public.ejercicio_semanas origen join public.sesion_ejercicios e on e.id=origen.ejercicio_id join public.sesiones s on s.id=e.sesion_id
 where s.plan_id=p_plan and destino.ejercicio_id=origen.ejercicio_id and origen.semana=p_origen and destino.semana=p_destino;
 return p_plan;
end $$;
revoke all on function public.copiar_semana_plan(uuid,integer,integer) from public,anon;
grant execute on function public.copiar_semana_plan(uuid,integer,integer) to authenticated;

create function public.remapear_dias_plan(d jsonb,mapa jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare dia record; resultado jsonb:='{}'; lista jsonb; a jsonb;
begin
 for dia in select * from jsonb_each(d) loop
  lista:='[]';
  for a in select value from jsonb_array_elements(dia.value) loop
   if a ? 'sesionId' then
    if not mapa ? (a->>'sesionId') then raise exception 'Falta la rutina de la copia' using errcode='23514'; end if;
    a:=a||jsonb_build_object('sesionId',mapa->>(a->>'sesionId'));
   end if;
   lista:=lista||jsonb_build_array(a);
  end loop;
  resultado:=resultado||jsonb_build_object(dia.key,lista);
 end loop;
 return resultado;
end $$;
create function public.remapear_distribucion_plan(d jsonb,mapa jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare w record; resultado jsonb; semanas jsonb:='{}';
begin
 resultado:=jsonb_build_object('base',public.remapear_dias_plan(coalesce(d->'base','{}'),mapa));
 for w in select * from jsonb_each(coalesce(d->'semanas','{}')) loop semanas:=semanas||jsonb_build_object(w.key,public.remapear_dias_plan(w.value,mapa)); end loop;
 return resultado||jsonb_build_object('semanas',semanas);
end $$;

-- Quitar una rutina elimina sus vínculos, sin alterar otras actividades.
create function public.quitar_rutina_distribucion(d jsonb,p_id text) returns jsonb language plpgsql immutable set search_path='' as $$
declare g text; w record; dia record; resultado jsonb:=d; lista jsonb;
begin
 for g in select 'base' union all select 'semanas' loop
  for w in select * from jsonb_each(case when g='base' then jsonb_build_object('0',coalesce(d->'base','{}')) else coalesce(d->'semanas','{}') end) loop
   for dia in select * from jsonb_each(w.value) loop
    select coalesce(jsonb_agg(a),'[]') into lista from jsonb_array_elements(dia.value) a where coalesce(a->>'sesionId','')<>p_id;
    resultado:=jsonb_set(resultado,case when g='base' then array['base',dia.key] else array['semanas',w.key,dia.key] end,lista,true);
   end loop;
  end loop;
 end loop;
 return resultado;
end $$;
create function public.desvincular_rutina_borrada() returns trigger language plpgsql set search_path='' as $$
begin
 update public.planes_mensuales set distribucion=public.quitar_rutina_distribucion(distribucion,old.id::text) where id=old.plan_id;
 return old;
end $$;
create trigger desvincular_rutina_borrada after delete on public.sesiones for each row execute function public.desvincular_rutina_borrada();

-- Las funciones de copia se completan debajo con remapeo de identificadores.

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
  update public.planes_mensuales set distribucion=public.remapear_distribucion_plan(modelo.distribucion,mapa) where id=p_id;
  return p_id;
end $$;


create function public.proteger_tipo_rutina_vinculada() returns trigger language plpgsql set search_path='' as $$
begin
 if new.tipo<>old.tipo and exists(select 1 from public.planes_mensuales p where p.id=old.plan_id and jsonb_path_exists(p.distribucion,'$.**.sesionId ? (@ == $id)',jsonb_build_object('id',old.id::text))) then
  raise exception 'Desvinculá la rutina del calendario antes de cambiar su actividad' using errcode='23514';
 end if;return new;
end $$;
create trigger proteger_tipo_rutina_vinculada before update of tipo on public.sesiones for each row execute function public.proteger_tipo_rutina_vinculada();
notify pgrst,'reload schema';
commit;
