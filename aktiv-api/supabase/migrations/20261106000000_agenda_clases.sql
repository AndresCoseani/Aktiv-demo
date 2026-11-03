-- 37: horarios semanales y confirmaciones por fecha, sin cupos.
begin;
create table public.horarios_clase (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 1 and 80),
  dia smallint not null check (dia between 1 and 7),
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  fin text not null default '' check (fin = '' or (fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and fin > hora)),
  lugar text not null default '' check (length(lugar) <= 120),
  activo boolean not null default true
);
create index horarios_coach_idx on public.horarios_clase(coach_id);
create table public.clases_canceladas (
  horario_id uuid not null references public.horarios_clase(id) on delete cascade,
  fecha date not null,
  primary key(horario_id, fecha)
);
create table public.confirmaciones_clase (
  horario_id uuid not null references public.horarios_clase(id) on delete cascade,
  fecha date not null,
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  creada_en timestamptz not null default now(),
  primary key(horario_id, fecha, alumno_id)
);
create index confirmaciones_alumno_idx on public.confirmaciones_clase(alumno_id, fecha);
alter table public.horarios_clase enable row level security;
alter table public.clases_canceladas enable row level security;
alter table public.confirmaciones_clase enable row level security;
revoke all on public.horarios_clase, public.clases_canceladas, public.confirmaciones_clase from anon, authenticated;
grant select, insert on public.horarios_clase to authenticated;
-- Los horarios con reservas no cambian de fecha silenciosamente: se archivan y se crea otro.
grant update(activo) on public.horarios_clase to authenticated;
grant select, insert, delete on public.clases_canceladas, public.confirmaciones_clase to authenticated;
create policy horarios_leer on public.horarios_clase for select to authenticated using (
  coach_id = auth.uid() or exists(select 1 from public.alumnos a where a.coach_id = horarios_clase.coach_id and a.user_id = auth.uid())
);
create policy horarios_crear on public.horarios_clase for insert to authenticated with check (
  coach_id = auth.uid() and exists(select 1 from public.profiles where id = auth.uid() and rol = 'coach')
);
create policy horarios_archivar on public.horarios_clase for update to authenticated using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy canceladas_leer on public.clases_canceladas for select to authenticated using (exists(select 1 from public.horarios_clase h where h.id = horario_id));
create policy canceladas_crear on public.clases_canceladas for insert to authenticated with check (exists(select 1 from public.horarios_clase h where h.id = horario_id and h.coach_id = auth.uid()));
create policy canceladas_borrar on public.clases_canceladas for delete to authenticated using (exists(select 1 from public.horarios_clase h where h.id = horario_id and h.coach_id = auth.uid()));
create policy confirmaciones_leer on public.confirmaciones_clase for select to authenticated using (
  exists(select 1 from public.horarios_clase h where h.id = horario_id and h.coach_id = auth.uid()) or
  exists(select 1 from public.alumnos a where a.id = alumno_id and a.user_id = auth.uid())
);
create policy confirmaciones_crear on public.confirmaciones_clase for insert to authenticated with check (
  exists(select 1 from public.profiles where id = auth.uid() and rol = 'alumno') and
  exists(select 1 from public.alumnos a join public.horarios_clase h on h.coach_id = a.coach_id
    where a.id = alumno_id and a.user_id = auth.uid() and a.activo and h.id = horario_id)
);
create policy confirmaciones_borrar on public.confirmaciones_clase for delete to authenticated using (
  exists(select 1 from public.profiles where id = auth.uid() and rol = 'alumno') and
  exists(select 1 from public.alumnos a where a.id = alumno_id and a.user_id = auth.uid())
);

-- La validación se aplica también a escrituras directas. Bloqueo por horario evita
-- que una confirmación atraviese una cancelación concurrente de la clase.
create function public.validar_fecha_clase() returns trigger
language plpgsql security definer set search_path = '' as $$
declare horario public.horarios_clase; hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select * into horario from public.horarios_clase where id = new.horario_id for update;
  if horario.id is null or not horario.activo then raise exception 'El horario no está disponible' using errcode = 'P0001'; end if;
  if new.fecha < hoy or new.fecha > hoy + 60 or extract(isodow from new.fecha) <> horario.dia then
    raise exception 'Elegí una fecha del horario dentro de los próximos 60 días' using errcode = 'P0001';
  end if;
  if tg_table_name = 'confirmaciones_clase' and exists(select 1 from public.clases_canceladas c where c.horario_id = new.horario_id and c.fecha = new.fecha) then
    raise exception 'La clase está cancelada' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger validar_confirmacion before insert on public.confirmaciones_clase for each row execute function public.validar_fecha_clase();
create trigger validar_cancelacion before insert on public.clases_canceladas for each row execute function public.validar_fecha_clase();
revoke all on function public.validar_fecha_clase() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
