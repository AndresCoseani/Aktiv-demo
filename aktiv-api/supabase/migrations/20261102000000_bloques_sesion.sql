-- Migración 33: guardar bloques vacíos y el orden de las tarjetas.
-- Los ejercicios mantienen su grupo actual; no se borran ni se reasignan.
begin;
alter table public.sesiones add column bloques smallint[] not null default '{}'
  constraint sesiones_bloques_validos check (
    cardinality(bloques) <= 20
    and array_position(bloques, null) is null
    and bloques <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]::smallint[]
  );
update public.sesiones s set bloques = coalesce((
  select array_agg(grupo order by primer_orden, grupo) from (
    select e.grupo, min(e.orden) as primer_orden
    from public.sesion_ejercicios e where e.sesion_id = s.id group by e.grupo
  ) grupos
), '{}'::smallint[]);
commit;
