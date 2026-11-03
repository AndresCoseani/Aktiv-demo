-- Migración 32. Requiere 31. Plan y días se crean juntos o no se crea nada.
begin;
create function public.crear_plan_con_dias(p_plan jsonb, p_fuerza integer, p_running integer)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  plan_id uuid := (p_plan->>'id')::uuid;
begin
  if p_fuerza is null or p_running is null or p_fuerza not between 0 and 7
     or p_running not between 0 and 7 or p_fuerza + p_running = 0 then
    raise exception 'Elegí entre uno y siete días por tipo de entrenamiento.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.planes_mensuales where alumno_id = (p_plan->>'alumno_id')::uuid) >= 50 then
    raise exception 'Se alcanzó el máximo de 50 planes.' using errcode = 'P0001';
  end if;
  insert into public.planes_mensuales(id, alumno_id, nombre, inicio, activo, semanas, orden)
  values(plan_id, (p_plan->>'alumno_id')::uuid, p_plan->>'nombre', (p_plan->>'inicio')::date,
    (p_plan->>'activo')::boolean, (p_plan->>'semanas')::integer, (p_plan->>'orden')::integer);
  insert into public.sesiones(plan_id, dia, tipo, nombre, orden)
    select plan_id, null, 'Fuerza', 'Fuerza · Día ' || n, n - 1 from generate_series(1, p_fuerza) n;
  insert into public.sesiones(plan_id, dia, tipo, nombre, orden)
    select plan_id, null, 'Running', 'Running · Día ' || n, p_fuerza + n - 1 from generate_series(1, p_running) n;
  return plan_id;
end;
$$;
revoke all on function public.crear_plan_con_dias(jsonb, integer, integer) from public, anon;
grant execute on function public.crear_plan_con_dias(jsonb, integer, integer) to authenticated;
commit;
