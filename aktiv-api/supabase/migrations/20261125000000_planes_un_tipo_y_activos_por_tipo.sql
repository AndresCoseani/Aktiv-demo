-- Cada plan del alumno y cada modelo representan una sola actividad.
begin;

alter table public.planes_mensuales add column tipo text;
alter table public.planes_modelo add column tipo text;

create or replace function public.distribucion_de_tipo(d jsonb, p_tipo text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare grupo text; semana record; dia record; actividades jsonb; resultado jsonb:='{}'; base jsonb:='{}'; semanas jsonb:='{}';
begin
 for grupo in select 'base' union all select 'semanas' loop
  for semana in select * from jsonb_each(case when grupo='base' then jsonb_build_object('0',coalesce(d->'base','{}')) else coalesce(d->'semanas','{}') end) loop
   for dia in select * from jsonb_each(semana.value) loop
    select coalesce(jsonb_agg(a),'[]') into actividades from jsonb_array_elements(dia.value) a where a->>'tipo' in (p_tipo,'Descanso');
    if grupo='base' then base:=base||jsonb_build_object(dia.key,actividades);
    else semanas:=semanas||jsonb_build_object(semana.key,coalesce(semanas->semana.key,'{}')||jsonb_build_object(dia.key,actividades)); end if;
   end loop;
  end loop;
 end loop;
 return jsonb_build_object('base',base,'semanas',semanas);
end $$;

-- Separa planes mensuales históricos mixtos, moviendo sus sesiones y vínculos sin duplicar contenido.
do $$
declare p record; t text; principal text; nuevo uuid; tipos text[];
begin
 for p in select * from public.planes_mensuales order by id loop
  select array_agg(distinct tipo order by tipo) into tipos from public.sesiones where plan_id=p.id;
  if coalesce(jsonb_typeof(p.running),'null')='object' and p.running<>'{}'::jsonb and not ('Running'=any(coalesce(tipos,'{}'))) then tipos:=array_append(coalesce(tipos,'{}'),'Running'); end if;
  if coalesce(cardinality(tipos),0)=0 then tipos:=array[case when coalesce(p.running,'{}')<>'{}'::jsonb then 'Running' else 'Fuerza' end]; end if;
  principal:=tipos[1];
  update public.planes_mensuales set tipo=principal,
    running=case when principal='Running' then coalesce(p.running,'{}') else '{}'::jsonb end,
    distribucion=public.distribucion_de_tipo(coalesce(p.distribucion,'{}'),principal)
    where id=p.id;
  foreach t in array tipos[2:cardinality(tipos)] loop
   nuevo:=gen_random_uuid();
   insert into public.planes_mensuales(id,alumno_id,nombre,inicio,semanas,activo,orden,running,distribucion,tipo)
    values(nuevo,p.alumno_id,left(p.nombre||' · '||t,120),p.inicio,p.semanas,p.activo,p.orden,
      case when t='Running' then coalesce(p.running,'{}') else '{}'::jsonb end,
      '{}'::jsonb,t);
   update public.sesiones set plan_id=nuevo where plan_id=p.id and tipo=t;
   update public.planes_mensuales set distribucion=public.distribucion_de_tipo(coalesce(p.distribucion,'{}'),t) where id=nuevo;
  end loop;
 end loop;
end $$;

-- Separa modelos mixtos manteniendo sesiones y asignaciones semanales de cada actividad.
do $$
declare m record; t text; principal text; tipos text[]; copia uuid; sesiones_tipo jsonb;
begin
 for m in select * from public.planes_modelo order by id loop
  select array_agg(distinct s->>'tipo' order by s->>'tipo') into tipos from jsonb_array_elements(m.sesiones) s;
  if coalesce(m.running,'{}')<>'{}'::jsonb and not ('Running'=any(coalesce(tipos,'{}'))) then tipos:=array_append(coalesce(tipos,'{}'),'Running'); end if;
  if coalesce(cardinality(tipos),0)=0 then tipos:=array['Fuerza']; end if;
  principal:=tipos[1];
  select coalesce(jsonb_agg(s order by (s->>'orden')::int),'[]') into sesiones_tipo from jsonb_array_elements(m.sesiones) s where s->>'tipo'=principal;
  update public.planes_modelo set tipo=principal,sesiones=sesiones_tipo,
    running=case when principal='Running' then coalesce(m.running,'{}') else '{}'::jsonb end,
    distribucion=public.distribucion_de_tipo(coalesce(m.distribucion,'{}'),principal) where id=m.id;
  foreach t in array tipos[2:cardinality(tipos)] loop
   select coalesce(jsonb_agg(s order by (s->>'orden')::int),'[]') into sesiones_tipo from jsonb_array_elements(m.sesiones) s where s->>'tipo'=t;
   copia:=gen_random_uuid();
   insert into public.planes_modelo(id,coach_id,nombre,semanas,sesiones,revision,running,distribucion,tipo)
    values(copia,m.coach_id,left(m.nombre||' · '||t,120),m.semanas,sesiones_tipo,m.revision,
      case when t='Running' then coalesce(m.running,'{}') else '{}'::jsonb end,
      public.distribucion_de_tipo(coalesce(m.distribucion,'{}'),t),t);
  end loop;
 end loop;
end $$;

update public.planes_mensuales p set tipo=coalesce(p.tipo,'Fuerza');
update public.planes_modelo m set tipo=coalesce(m.tipo,'Fuerza');
-- Si había activos duplicados del mismo tipo, conserva activo el de orden más reciente.
with duplicados as (
 select id,row_number() over(partition by alumno_id,tipo order by orden desc,inicio desc,id desc) n
 from public.planes_mensuales where activo
) update public.planes_mensuales p set activo=false from duplicados d where p.id=d.id and d.n>1;
alter table public.planes_mensuales alter column tipo set not null;
alter table public.planes_mensuales alter column tipo set default 'Fuerza';
alter table public.planes_modelo alter column tipo set not null;
alter table public.planes_modelo alter column tipo set default 'Fuerza';
create unique index planes_mensuales_un_activo_por_tipo on public.planes_mensuales(alumno_id,tipo) where activo;

create function public.inferir_tipo_plan_running() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce(new.running,'{}')<>'{}'::jsonb then
  if tg_op='INSERT' then new.tipo:='Running';
  elsif new.tipo<>'Running' then raise exception 'Los datos de running requieren un plan Running' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger planes_mensuales_tipo_running before insert or update of running on public.planes_mensuales for each row execute function public.inferir_tipo_plan_running();

create or replace function public.validar_tipo_sesion_plan() returns trigger language plpgsql set search_path='' as $$
declare t text; hay_sesiones boolean;
begin
 select tipo into t from public.planes_mensuales where id=new.plan_id for update;
 if not found then raise exception 'Plan inexistente' using errcode='23503'; end if;
 select exists(select 1 from public.sesiones where plan_id=new.plan_id and id<>new.id) into hay_sesiones;
 if not hay_sesiones and t='Fuerza' and new.tipo<>'Fuerza' then
  update public.planes_mensuales set tipo=new.tipo where id=new.plan_id;
 elsif t<>new.tipo then raise exception 'Todas las sesiones deben ser del mismo tipo que el plan' using errcode='23514'; end if;
 return new;
end $$;
create trigger sesiones_tipo_plan before insert or update of plan_id,tipo on public.sesiones for each row execute function public.validar_tipo_sesion_plan();

create or replace function public.validar_tipo_modelo() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from jsonb_array_elements(new.sesiones) s where s->>'tipo'<>new.tipo) then
  raise exception 'Todas las sesiones deben ser del mismo tipo que el modelo' using errcode='23514';
 end if;
 if new.tipo<>'Running' and coalesce(new.running,'{}')<>'{}'::jsonb then raise exception 'Los datos de running requieren un modelo Running' using errcode='23514'; end if;
 return new;
end $$;
create trigger planes_modelo_un_tipo before insert or update on public.planes_modelo for each row execute function public.validar_tipo_modelo();

create or replace function public.validar_distribucion_tipo_unico() returns trigger language plpgsql set search_path='' as $$
declare actividad jsonb;
begin
 for actividad in
  select a.value from jsonb_each(coalesce(new.distribucion->'base','{}')) d cross join lateral jsonb_array_elements(d.value) a
  union all
  select a.value from jsonb_each(coalesce(new.distribucion->'semanas','{}')) w cross join lateral jsonb_each(w.value) d cross join lateral jsonb_array_elements(d.value) a
 loop
  if actividad->>'tipo' not in (new.tipo,'Descanso') then raise exception 'La distribución debe usar solo la actividad del plan' using errcode='23514'; end if;
 end loop;
 return new;
end $$;
create trigger planes_mensuales_distribucion_tipo before insert or update of distribucion,tipo on public.planes_mensuales for each row execute function public.validar_distribucion_tipo_unico();
create trigger planes_modelo_distribucion_tipo before insert or update of distribucion,tipo on public.planes_modelo for each row execute function public.validar_distribucion_tipo_unico();

-- Activar sin reemplazo da conflicto; el cliente debe pedir confirmación y luego usar p_reemplazar=true.
create function public.activar_plan_mensual(p_plan uuid,p_reemplazar boolean default false) returns uuid
language plpgsql security invoker set search_path='' as $$
declare p public.planes_mensuales%rowtype; existente public.planes_mensuales%rowtype;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede activar planes' using errcode='42501'; end if;
 select x.* into p from public.planes_mensuales x join public.alumnos a on a.id=x.alumno_id
  where x.id=p_plan and a.coach_id=auth.uid() for update of x;
 if not found then raise exception 'El plan no existe o no tenés acceso' using errcode='P0002'; end if;
 perform 1 from public.alumnos where id=p.alumno_id for update;
 select * into existente from public.planes_mensuales where alumno_id=p.alumno_id and tipo=p.tipo and activo and id<>p.id for update;
 if found and not p_reemplazar then raise exception 'Ya existe un plan activo de este tipo' using errcode='23505', detail=existente.nombre; end if;
 if found then update public.planes_mensuales set activo=false where id=existente.id; end if;
 update public.planes_mensuales set activo=true where id=p.id;
 return p.id;
end $$;
revoke all on function public.activar_plan_mensual(uuid,boolean) from public,anon;
grant execute on function public.activar_plan_mensual(uuid,boolean) to authenticated;

create function public.asignar_plan_modelo_duracion(p_modelo uuid,p_id uuid,p_alumno uuid,p_nombre text,p_inicio date,p_semanas integer,p_asignaciones jsonb default '[]'::jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare resultado uuid; t text; m public.planes_modelo%rowtype; asignacion jsonb; fuente jsonb; copia uuid; base jsonb:='{}';
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
 -- La copia conserva todas las sesiones, pero el entrenador decide los días del alumno.
 for asignacion in select value from jsonb_array_elements(p_asignaciones) loop
  select value into fuente from jsonb_array_elements(m.sesiones) where value->>'id'=asignacion->>'sesionId';
  select id into copia from public.sesiones where plan_id=resultado and tipo=t and orden=(fuente->>'orden')::integer order by id limit 1;
  if copia is null then raise exception 'No se pudo encontrar la sesión copiada' using errcode='23514'; end if;
  base:=base||jsonb_build_object(asignacion->>'dia',jsonb_build_array(jsonb_build_object('tipo',t,'sesionId',copia)));
 end loop;
 update public.planes_mensuales set tipo=t,semanas=p_semanas,distribucion=jsonb_build_object('base',base) where id=resultado;
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
