-- 38: fin y lugar obligatorios en nuevas altas. Conserva horarios anteriores.
begin;
create function public.exigir_datos_horario() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.fin = '' or length(trim(new.lugar)) = 0 then
    raise exception 'Completá la hora de fin y el lugar de la clase' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger horarios_datos_obligatorios before insert on public.horarios_clase
  for each row execute function public.exigir_datos_horario();
revoke all on function public.exigir_datos_horario() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
