begin;

-- La función anterior insertaba el tipo predeterminado (Fuerza) y solo después
-- agregaba las sesiones. Eso chocaba con el índice por tipo al crear Running.
create or replace function public.crear_plan_con_actividades(p_plan jsonb,p_actividades jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 v_id uuid := (p_plan->>'id')::uuid;
 actividad jsonb;
 cantidad integer;
 tipo text;
 tipo_plan text := btrim(p_plan->>'tipo');
 orden_dia integer := 0;
begin
 if not public.es_coach() then raise exception 'Solo el profesor puede crear planes' using errcode='42501'; end if;
 if tipo_plan is null or char_length(tipo_plan) not between 1 and 80 then
  raise exception 'Tipo de plan invÃ¡lido' using errcode='23514';
 end if;
 if jsonb_typeof(p_actividades) is distinct from 'array' or jsonb_array_length(p_actividades) not between 1 and 28 then
  raise exception 'ElegÃ­ al menos una actividad' using errcode='23514';
 end if;
 -- Un plan solo puede crear sesiones de su tipo.
 for actividad in select value from jsonb_array_elements(p_actividades) loop
  tipo := btrim(actividad->>'tipo');
  cantidad := (actividad->>'dias')::integer;
  if tipo is null or tipo <> tipo_plan or cantidad is null or cantidad not between 1 and 7 then
   raise exception 'Actividad o cantidad de dÃ­as invÃ¡lida' using errcode='23514';
  end if;
  orden_dia := orden_dia + cantidad;
 end loop;
 if orden_dia > 28 then raise exception 'MÃ¡ximo 28 entrenamientos' using errcode='23514'; end if;
 perform 1 from public.alumnos where id=(p_plan->>'alumno_id')::uuid and coach_id=auth.uid() for update;
 if not found then raise exception 'Alumno no disponible' using errcode='42501'; end if;
 if (select count(*) from public.planes_mensuales where alumno_id=(p_plan->>'alumno_id')::uuid)>=50 then
  raise exception 'MÃ¡ximo 50 planes por alumno' using errcode='23514';
 end if;
 insert into public.planes_mensuales(id,alumno_id,nombre,tipo,inicio,activo,semanas,orden)
 values(v_id,(p_plan->>'alumno_id')::uuid,p_plan->>'nombre',tipo_plan,(p_plan->>'inicio')::date,
  (p_plan->>'activo')::boolean,(p_plan->>'semanas')::integer,(p_plan->>'orden')::integer);
 orden_dia := 0;
 for actividad in select value from jsonb_array_elements(p_actividades) loop
  tipo := btrim(actividad->>'tipo');
  cantidad := (actividad->>'dias')::integer;
  insert into public.sesiones(plan_id,dia,tipo,nombre,orden)
   select v_id,null,tipo,left(tipo,48)||' · Día '||n,orden_dia+n-1 from generate_series(1,cantidad) n;
  insert into public.actividades_plan(coach_id,nombre) values(auth.uid(),tipo) on conflict do nothing;
  orden_dia := orden_dia + cantidad;
 end loop;
 return v_id;
end;
$$;

revoke all on function public.crear_plan_con_actividades(jsonb,jsonb) from public,anon;
grant execute on function public.crear_plan_con_actividades(jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
