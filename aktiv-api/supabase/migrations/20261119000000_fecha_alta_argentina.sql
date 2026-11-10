-- 50: la fecha civil de alta se calcula en Argentina, no en UTC.
begin;
alter table public.alumnos alter column alta_en
 set default ((now() at time zone 'America/Argentina/Buenos_Aires')::date);

-- Reparar únicamente fichas creadas en la misma transacción que su aprobación.
-- No modificar fichas previas vinculadas, fechas distintas de la UTC original,
-- ni las altas cuyo día argentino y UTC coinciden.
update public.alumnos a
 set alta_en = (a.creado_en at time zone 'America/Argentina/Buenos_Aires')::date
 from public.solicitudes_alta s
 where s.user_id=a.user_id and s.coach_id=a.coach_id
 and s.aprobada_en=a.creado_en
 and a.alta_en=(a.creado_en at time zone 'UTC')::date
 and a.alta_en<>(a.creado_en at time zone 'America/Argentina/Buenos_Aires')::date;

notify pgrst,'reload schema';
commit;
