-- 36: datos de alta y franja de entrenamiento. No cambia contraseñas existentes.
begin;
alter table public.alumnos add column dni text not null default ''
  check (dni = '' or dni ~ '^[0-9]{7,8}$');
create unique index alumnos_dni_coach_unico on public.alumnos(coach_id, dni) where dni <> '';
alter table public.sesiones add column franja text not null default 'Sin definir'
  check (franja in ('Mañana', 'Tarde', 'Noche', 'Sin definir'));

-- Importación atómica como el usuario: nunca crea cuentas ni cambia claves.
create function public.importar_alumnos(p_alumnos jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare fila jsonb;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and rol = 'coach') then
    raise exception 'Solo el profesor puede importar alumnos' using errcode = '42501';
  end if;
  if jsonb_typeof(p_alumnos) is distinct from 'array' then
    raise exception 'La importación debe ser una lista' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_alumnos) not between 1 and 200 then
    raise exception 'Importá entre 1 y 200 alumnos por vez' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 36));
  for fila in select value from jsonb_array_elements(p_alumnos) loop
    if coalesce(trim(fila->>'dni'),'') = '' and coalesce(trim(fila->>'email'),'') = '' then
      raise exception 'Cada alumno importado necesita DNI o email' using errcode = 'P0001';
    end if;
    if exists(select 1 from public.alumnos a where a.coach_id = auth.uid() and (
      (coalesce(fila->>'dni','') <> '' and a.dni = fila->>'dni') or
      (coalesce(fila->>'email','') <> '' and lower(trim(a.email)) = lower(trim(fila->>'email')))
    )) then
      raise exception 'Hay un DNI o email ya registrado. Revisá la importación.' using errcode = 'P0001';
    end if;
    insert into public.alumnos(id, coach_id, nombre, email, dni, telefono, objetivo, nivel)
    values((fila->>'id')::uuid, auth.uid(), fila->>'nombre', coalesce(fila->>'email',''),
      coalesce(fila->>'dni',''), coalesce(fila->>'telefono',''), coalesce(fila->>'objetivo',''), fila->>'nivel');
  end loop;
end;
$$;
revoke all on function public.importar_alumnos(jsonb) from public, anon;
grant execute on function public.importar_alumnos(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
