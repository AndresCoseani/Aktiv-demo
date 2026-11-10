-- 46: objetivo libre; conserva los tiempos anteriores y todos los resultados.
begin;
alter table public.inscripciones add column objetivo text not null default '' check (char_length(objetivo) <= 500);
create or replace function public.inscripciones_limitar_alumno()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not exists (
    select 1 from public.alumnos a
    where a.id = old.alumno_id and a.coach_id = (select auth.uid())
  ) then
    if (to_jsonb(new) - 'distancia_km' - 'objetivo' - 'objetivo_seg' - 'resultado_seg')
       is distinct from (to_jsonb(old) - 'distancia_km' - 'objetivo' - 'objetivo_seg' - 'resultado_seg') then
      raise exception 'Un alumno solo puede cambiar su distancia, su objetivo y su resultado'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
