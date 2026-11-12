-- 53: días de Running, GYM o Descanso; conserva el texto al cambiar de tipo.
begin;
create or replace function public.validar_running() returns trigger language plpgsql set search_path='' as $$
declare semana record; campo record;
begin
 if jsonb_typeof(new.running)<>'object' or octet_length(new.running::text)>4194304 then raise exception 'Grilla de Running inválida' using errcode='23514'; end if;
 for semana in select * from jsonb_each(new.running) loop
   if semana.key !~ '^([1-9]|[1-9][0-9]|10[0-4])$' or jsonb_typeof(semana.value)<>'object' then raise exception 'Semana de Running inválida' using errcode='23514'; end if;
   for campo in select * from jsonb_each(semana.value) loop
    if campo.key not in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','volumen','sugerencias','lunes_tipo','martes_tipo','miercoles_tipo','jueves_tipo','viernes_tipo','sabado_tipo','domingo_tipo') or jsonb_typeof(campo.value)<>'string' or char_length(campo.value #>> '{}')>4000 then raise exception 'Celda de Running inválida' using errcode='23514'; end if;
    if campo.key like '%\_tipo' escape '\' and (campo.value #>> '{}') not in ('Running','GYM','Descanso') then raise exception 'Tipo de día inválido' using errcode='23514'; end if;
    if campo.key='volumen' and (campo.value #>> '{}') !~ '^([0-9]{1,4}([.,][0-9]{1,2})?)?$' then raise exception 'Volumen de Running inválido' using errcode='23514'; end if;
    if semana.key::integer>new.semanas and btrim(campo.value #>> '{}')<>'' and not (campo.key like '%\_tipo' escape '\' and (campo.value #>> '{}')='Running') then raise exception 'Las semanas de Running que querés quitar tienen contenido. Vacialas primero.' using errcode='23514'; end if;
   end loop;
 end loop;
 return new;
end $$;
create or replace function public.guardar_running(p_plan uuid,p_cambio jsonb,p_copiar boolean default false) returns uuid
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
  if campo is null or campo not in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','volumen','sugerencias','lunes_tipo','martes_tipo','miercoles_tipo','jueves_tipo','viernes_tipo','sabado_tipo','domingo_tipo') or jsonb_typeof(p_cambio->'texto') is distinct from 'string' then raise exception 'Celda inválida' using errcode='23514'; end if;
  siguiente:=coalesce(plan.running->semana::text,'{}'::jsonb) || jsonb_build_object(campo,texto);
 end if;
 if semana is null or semana not between 1 and plan.semanas then raise exception 'La semana no existe en el plan' using errcode='23514'; end if;
 update public.planes_mensuales set running=jsonb_set(running,array[semana::text],siguiente,true) where id=p_plan;
 return p_plan;
end $$;
revoke all on function public.guardar_running(uuid,jsonb,boolean) from public,anon;
grant execute on function public.guardar_running(uuid,jsonb,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
