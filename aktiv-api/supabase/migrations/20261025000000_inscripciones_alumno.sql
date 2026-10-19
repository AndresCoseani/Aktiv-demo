-- Aktiv · el alumno también maneja su participación en las carreras
--
-- Antes solo el profe podía anotar a un alumno en una carrera y sacarlo; el alumno solo
-- cargaba su objetivo y su resultado. Ahora el alumno puede anotarse él mismo en una carrera
-- del calendario de su profe, cambiar la distancia y salirse, igual que el profe.
--
-- Lo que NO cambia: el calendario de carreras (crear, editar, borrar una carrera) sigue
-- siendo solo del profe, y una inscripción siempre es del propio alumno (no se puede mover a
-- otro alumno ni a otra carrera). La función inscripciones_validar sigue exigiendo que el
-- alumno y la carrera sean del mismo profe y que la distancia exista en la carrera.

drop policy inscripciones_insert on public.inscripciones;
create policy inscripciones_insert on public.inscripciones for insert to authenticated
  with check (public.puede_ver_alumno(alumno_id));

drop policy inscripciones_delete on public.inscripciones;
create policy inscripciones_delete on public.inscripciones for delete to authenticated
  using (public.puede_ver_alumno(alumno_id));

-- Un alumno puede cambiar distancia, objetivo y resultado; nada más (ni el alumno ni la carrera)
create or replace function public.inscripciones_limitar_alumno()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not exists (
    select 1 from public.alumnos a
    where a.id = old.alumno_id and a.coach_id = (select auth.uid())
  ) then
    if (to_jsonb(new) - 'distancia_km' - 'objetivo_seg' - 'resultado_seg')
       is distinct from (to_jsonb(old) - 'distancia_km' - 'objetivo_seg' - 'resultado_seg') then
      raise exception 'Un alumno solo puede cambiar su distancia, su objetivo y su resultado'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
