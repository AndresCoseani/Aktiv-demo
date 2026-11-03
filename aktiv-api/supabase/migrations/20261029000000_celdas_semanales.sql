-- Cada ejercicio nace con sus cuatro celdas en la misma transacción.
-- No modifica prescripciones ni pesos existentes. Aplicar después de planes_mensuales.
create function public.crear_semanas_del_ejercicio()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ejercicio_semanas (ejercicio_id, semana)
  select new.id, n from generate_series(1, 4) n;
  return new;
end;
$$;
revoke execute on function public.crear_semanas_del_ejercicio() from public, anon, authenticated;
create trigger crear_semanas_del_ejercicio_trg after insert on public.sesion_ejercicios
  for each row execute function public.crear_semanas_del_ejercicio();

insert into public.ejercicio_semanas (ejercicio_id, semana)
select e.id, n from public.sesion_ejercicios e cross join generate_series(1, 4) n
on conflict (ejercicio_id, semana) do nothing;
