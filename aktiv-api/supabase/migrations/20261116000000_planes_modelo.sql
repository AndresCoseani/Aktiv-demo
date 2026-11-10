-- 47: biblioteca privada del profesor. Copiar a un alumno nunca modifica el modelo.
begin;
create table public.planes_modelo (
  id uuid primary key,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null check(char_length(btrim(nombre)) between 1 and 120),
  semanas smallint not null check(semanas between 1 and 104),
  sesiones jsonb not null default '[]'::jsonb check(jsonb_typeof(sesiones)='array' and jsonb_array_length(sesiones)<=28 and octet_length(sesiones::text)<=2097152),
  revision integer not null default 0 check(revision>=0)
);
create index planes_modelo_coach_idx on public.planes_modelo(coach_id);
alter table public.planes_modelo enable row level security;
revoke all on public.planes_modelo from anon, authenticated;
grant select,insert,update,delete on public.planes_modelo to authenticated;
create policy modelos_propios on public.planes_modelo for all to authenticated
 using(coach_id=(select auth.uid()) and public.es_coach())
 with check(coach_id=(select auth.uid()) and public.es_coach());

create function public.asignar_plan_modelo(p_modelo uuid,p_id uuid,p_alumno uuid,p_nombre text,p_inicio date)
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
  insert into public.planes_mensuales(id,alumno_id,nombre,inicio,semanas,activo,orden)
    values(p_id,p_alumno,btrim(p_nombre),p_inicio,modelo.semanas,false,siguiente);
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
revoke all on function public.asignar_plan_modelo(uuid,uuid,uuid,text,date) from public,anon;
grant execute on function public.asignar_plan_modelo(uuid,uuid,uuid,text,date) to authenticated;
notify pgrst,'reload schema';
commit;
