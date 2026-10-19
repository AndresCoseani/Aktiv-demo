-- Aktiv · carreras como calendario del profe + inscripciones de alumnos
--
-- Antes: cada fila de `carreras` era "un alumno en una carrera".
-- Ahora:
--   * `carreras`       → el profe carga la carrera una vez (nombre, fecha, lugar,
--                        distancias disponibles y notas).
--   * `inscripciones`  → desde el perfil de cada alumno se lo asigna a una carrera
--                        ya creada, eligiendo la distancia que va a correr.
-- Además: contacto familiar opcional en la ficha médica.

------------------------------------------------------------------------------
-- Guarda: no pisar datos del modelo anterior
------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.carreras) then
    raise exception
      'La tabla carreras tiene datos del modelo anterior. No se migra solo: avisá antes de seguir.';
  end if;
end $$;

drop table public.carreras;

------------------------------------------------------------------------------
-- Tablas
------------------------------------------------------------------------------
create table public.carreras (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles (id) on delete cascade,
  nombre        text not null check (length(trim(nombre)) > 0),
  fecha         date not null,
  lugar         text not null default '',
  -- distancias que se pueden correr en esta carrera, por ejemplo {5, 10, 21.097}
  distancias_km numeric(6, 3)[] not null
                check (cardinality(distancias_km) between 1 and 10),
  notas         text not null default '',
  creado_en     timestamptz not null default now()
);
create index carreras_coach_idx on public.carreras (coach_id);
create index carreras_fecha_idx on public.carreras (fecha);

create table public.inscripciones (
  id            uuid primary key default gen_random_uuid(),
  alumno_id     uuid not null references public.alumnos (id) on delete cascade,
  carrera_id    uuid not null references public.carreras (id) on delete cascade,
  distancia_km  numeric(6, 3) not null check (distancia_km > 0),
  objetivo_seg  int check (objetivo_seg > 0),
  resultado_seg int check (resultado_seg > 0),
  unique (alumno_id, carrera_id)
);
create index inscripciones_alumno_idx on public.inscripciones (alumno_id);
create index inscripciones_carrera_idx on public.inscripciones (carrera_id);

-- Contacto familiar o de emergencia (opcional)
alter table public.fichas_medicas
  add column contacto_nombre     text not null default '',
  add column contacto_parentesco text not null default '',
  add column contacto_telefono   text not null default '';

------------------------------------------------------------------------------
-- Funciones y triggers
------------------------------------------------------------------------------

-- ¿El usuario actual es alumno de este profe? (para que vea su calendario)
create function public.es_alumno_de_coach(coach uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.alumnos a
    where a.user_id = (select auth.uid()) and a.coach_id = coach
  );
$$;

-- Una inscripción solo vale si alumno y carrera son del mismo profe y la
-- distancia elegida existe en esa carrera.
create function public.inscripciones_validar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c record;
begin
  select ca.coach_id, ca.distancias_km into c
  from public.carreras ca where ca.id = new.carrera_id;
  if not found then
    raise exception 'La carrera no existe';
  end if;
  if not exists (
    select 1 from public.alumnos a
    where a.id = new.alumno_id and a.coach_id = c.coach_id
  ) then
    raise exception 'El alumno y la carrera tienen que ser del mismo profe'
      using errcode = '42501';
  end if;
  if tg_op = 'INSERT' or new.distancia_km is distinct from old.distancia_km then
    if not (new.distancia_km = any (c.distancias_km)) then
      raise exception 'Esa distancia no está disponible en la carrera';
    end if;
  end if;
  return new;
end;
$$;
create trigger inscripciones_validar before insert or update on public.inscripciones
  for each row execute function public.inscripciones_validar();

-- Un alumno solo puede cambiar su tiempo objetivo y su resultado
create function public.inscripciones_limitar_alumno()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not exists (
    select 1 from public.alumnos a
    where a.id = old.alumno_id and a.coach_id = (select auth.uid())
  ) then
    if (to_jsonb(new) - 'objetivo_seg' - 'resultado_seg')
       is distinct from (to_jsonb(old) - 'objetivo_seg' - 'resultado_seg') then
      raise exception 'Un alumno solo puede cargar su objetivo y su resultado'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger inscripciones_limitar before update on public.inscripciones
  for each row execute function public.inscripciones_limitar_alumno();

revoke execute on function public.es_alumno_de_coach(uuid),
  public.inscripciones_validar(), public.inscripciones_limitar_alumno()
  from public, anon;
grant execute on function public.es_alumno_de_coach(uuid) to authenticated;

------------------------------------------------------------------------------
-- Permisos y RLS
------------------------------------------------------------------------------
revoke all on public.carreras, public.inscripciones from anon;
grant select, insert, update, delete on public.carreras, public.inscripciones to authenticated;

alter table public.carreras      enable row level security;
alter table public.inscripciones enable row level security;

-- carreras: las crea y edita el profe dueño; sus alumnos ven el calendario
create policy carreras_select on public.carreras for select to authenticated
  using (coach_id = (select auth.uid()) or public.es_alumno_de_coach(coach_id));
create policy carreras_insert on public.carreras for insert to authenticated
  with check (coach_id = (select auth.uid()) and public.es_coach());
create policy carreras_update on public.carreras for update to authenticated
  using (coach_id = (select auth.uid()) and public.es_coach())
  with check (coach_id = (select auth.uid()) and public.es_coach());
create policy carreras_delete on public.carreras for delete to authenticated
  using (coach_id = (select auth.uid()) and public.es_coach());

-- inscripciones: asigna y quita el profe; el alumno ve las suyas y carga objetivo/resultado
create policy inscripciones_select on public.inscripciones for select to authenticated
  using (public.puede_ver_alumno(alumno_id));
create policy inscripciones_insert on public.inscripciones for insert to authenticated
  with check (public.es_coach_de(alumno_id));
create policy inscripciones_update on public.inscripciones for update to authenticated
  using (public.puede_ver_alumno(alumno_id))
  with check (public.puede_ver_alumno(alumno_id));
create policy inscripciones_delete on public.inscripciones for delete to authenticated
  using (public.es_coach_de(alumno_id));
