-- 44: categorías propias del profesor, sin límite de cantidad.
begin;
create table public.categorias_ejercicio (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80 and nombre = btrim(nombre)),
  clave text generated always as (lower(regexp_replace(translate(nombre, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '[[:space:]_-]+', '', 'g'))) stored,
  primary key (coach_id, nombre),
  unique (coach_id, clave)
);
alter table public.categorias_ejercicio enable row level security;
revoke all on public.categorias_ejercicio from anon, authenticated;
grant select, insert on public.categorias_ejercicio to authenticated;
create policy categorias_leer on public.categorias_ejercicio for select to authenticated
  using ((coach_id = (select auth.uid()) and public.es_coach()) or public.es_alumno_de_coach(coach_id));
create policy categorias_crear on public.categorias_ejercicio for insert to authenticated
  with check (coach_id = (select auth.uid()) and public.es_coach());

insert into public.categorias_ejercicio(coach_id,nombre)
select profiles.id, c.nombre from public.profiles cross join
  (values ('Series y ritmo'), ('Técnica de carrera'), ('Fuerza'), ('Movilidad')) c(nombre)
where rol = 'coach';
insert into public.categorias_ejercicio(coach_id,nombre)
select distinct coach_id,categoria from public.ejercicios_custom on conflict do nothing;
alter table public.ejercicios_custom drop constraint ejercicios_custom_categoria_valida;
alter table public.ejercicios_custom add constraint ejercicios_custom_categoria_valida
  check (char_length(categoria) between 1 and 80 and categoria = btrim(categoria));

-- Idempotente y seguro ante altas simultáneas: devuelve el nombre ya guardado.
create function public.crear_categoria_ejercicio(nombre_nuevo text) returns text
language plpgsql security invoker set search_path = '' as $$
declare limpio text; resultado text;
begin
  if not public.es_coach() then raise exception 'Solo el profesor puede crear categorías' using errcode='42501'; end if;
  limpio := btrim(regexp_replace(nombre_nuevo, '[[:space:]]+', ' ', 'g'));
  if limpio is null or char_length(limpio) not between 1 and 80 then
    raise exception 'Categoría inválida' using errcode='23514';
  end if;
  insert into public.categorias_ejercicio(coach_id,nombre) values(auth.uid(),limpio) on conflict do nothing;
  select nombre into resultado from public.categorias_ejercicio where coach_id=auth.uid()
    and clave=lower(regexp_replace(translate(limpio, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '[[:space:]_-]+', '', 'g'));
  return resultado;
end $$;
revoke all on function public.crear_categoria_ejercicio(text) from public, anon;
grant execute on function public.crear_categoria_ejercicio(text) to authenticated;
notify pgrst, 'reload schema';
commit;
