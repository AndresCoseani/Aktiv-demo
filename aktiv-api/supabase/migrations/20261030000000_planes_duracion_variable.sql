-- Duración configurable por plan. El nombre físico planes_mensuales se conserva
-- para no renombrar tablas ni romper consumidores existentes. Aplicar tras 28 y 29.
begin;

alter table public.planes_mensuales
  add column semanas smallint not null default 4
  constraint planes_duracion_valida check (semanas between 1 and 104);
alter table public.ejercicio_semanas drop constraint ejercicio_semanas_semana_check;
alter table public.ejercicio_semanas add constraint ejercicio_semanas_semana_check check (semana between 1 and 104);

create or replace function public.crear_semanas_del_ejercicio()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cantidad smallint;
begin
  select p.semanas into cantidad from public.sesiones s
  join public.planes_mensuales p on p.id = s.plan_id where s.id = new.sesion_id;
  insert into public.ejercicio_semanas (ejercicio_id, semana)
  select new.id, n from generate_series(1, cantidad) n;
  return new;
end;
$$;

-- Una celda debe pertenecer a una semana existente de su plan (también por SQL directo).
create function public.semana_dentro_del_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cantidad smallint;
begin
  select p.semanas into cantidad from public.sesion_ejercicios e
  join public.sesiones s on s.id = e.sesion_id
  join public.planes_mensuales p on p.id = s.plan_id
  where e.id = new.ejercicio_id for share of p;
  if cantidad is null or new.semana > cantidad then
    raise exception 'La semana no pertenece a la duración del plan' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger semana_dentro_del_plan_trg before insert or update on public.ejercicio_semanas
for each row execute function public.semana_dentro_del_plan();

-- No se acorta un plan si eso descarta indicaciones o registros del alumno.
create function public.validar_reduccion_del_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.semanas < old.semanas and exists (
    select 1 from public.ejercicio_semanas c
    join public.sesion_ejercicios e on e.id = c.ejercicio_id
    join public.sesiones s on s.id = e.sesion_id
    where s.plan_id = old.id and c.semana > new.semanas
      and (length(trim(c.prescripcion)) > 0 or length(trim(coalesce(c.peso, ''))) > 0 or c.peso_fecha is not null)
  ) then
    raise exception 'No se puede acortar el plan: hay indicaciones o pesos registrados en las semanas que querés quitar';
  end if;
  return new;
end;
$$;
create trigger validar_reduccion_del_plan_trg before update of semanas on public.planes_mensuales
for each row execute function public.validar_reduccion_del_plan();

create function public.ajustar_semanas_del_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.semanas > old.semanas then
    insert into public.ejercicio_semanas (ejercicio_id, semana)
    select e.id, n from public.sesion_ejercicios e
    join public.sesiones s on s.id = e.sesion_id
    cross join generate_series(old.semanas + 1, new.semanas) n
    where s.plan_id = new.id on conflict (ejercicio_id, semana) do nothing;
  elsif new.semanas < old.semanas then
    delete from public.ejercicio_semanas c using public.sesion_ejercicios e, public.sesiones s
    where c.ejercicio_id = e.id and e.sesion_id = s.id and s.plan_id = new.id and c.semana > new.semanas;
  end if;
  return new;
end;
$$;
create trigger ajustar_semanas_del_plan_trg after update of semanas on public.planes_mensuales
for each row execute function public.ajustar_semanas_del_plan();

revoke execute on function public.crear_semanas_del_ejercicio(), public.semana_dentro_del_plan(),
  public.validar_reduccion_del_plan(), public.ajustar_semanas_del_plan() from public, anon, authenticated;

commit;
