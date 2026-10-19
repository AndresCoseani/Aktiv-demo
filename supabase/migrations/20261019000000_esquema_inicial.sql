-- Aktiv · esquema inicial
--
-- Seguridad (leer antes de tocar):
--  * Todas las tablas tienen RLS activado. Sin política = sin acceso.
--  * `anon` (visitante sin sesión) no tiene permisos sobre nada.
--  * Un profe ve y edita solo a SUS alumnos (alumnos.coach_id = auth.uid()).
--  * Un alumno ve solo lo suyo y puede escribir únicamente: sus notas, el peso
--    de sus ejercicios, su ficha médica, sus marcas y sus carreras.
--  * Los datos médicos y los certificados son sensibles: el bucket es privado
--    y se accede solo con URLs firmadas de corta duración.
--  * Los usuarios se crean con la clave service_role (scripts/crear-usuarios.mjs);
--    el registro público está desactivado.

------------------------------------------------------------------------------
-- Tablas
------------------------------------------------------------------------------

create table public.profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  rol       text not null check (rol in ('coach', 'alumno')),
  nombre    text not null,
  email     text not null,
  creado_en timestamptz not null default now()
);

create table public.alumnos (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null references public.profiles (id) on delete restrict,
  user_id        uuid unique references public.profiles (id) on delete set null,
  nombre         text not null check (length(trim(nombre)) > 0),
  email          text not null default '',
  telefono       text not null default '',
  objetivo       text not null default '',
  nivel          text not null default 'Principiante'
                 check (nivel in ('Principiante', 'Intermedio', 'Avanzado')),
  activo         boolean not null default true,
  proximo_pago   date,
  alta_en        date not null default current_date,
  -- sin FK a propósito: evita la referencia circular con planes
  plan_activo_id uuid,
  -- 7 días, de lunes a domingo: [{"correr": bool, "fuerza": bool}, ...]
  semana         jsonb not null default
    '[{"correr":false,"fuerza":false},{"correr":false,"fuerza":false},{"correr":false,"fuerza":false},{"correr":false,"fuerza":false},{"correr":false,"fuerza":false},{"correr":false,"fuerza":false},{"correr":false,"fuerza":false}]'::jsonb
    check (jsonb_typeof(semana) = 'array' and jsonb_array_length(semana) = 7),
  notas_profe    text not null default '',
  notas_alumno   text not null default '',
  creado_en      timestamptz not null default now()
);
create index alumnos_coach_idx on public.alumnos (coach_id);

create table public.planes (
  id        uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  nombre    text not null default '',
  orden     int  not null default 0
);
create index planes_alumno_idx on public.planes (alumno_id);

create table public.plan_ejercicios (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.planes (id) on delete cascade,
  orden        int  not null default 0,
  nombre       text not null default '',
  series       int  not null default 0 check (series >= 0),
  repeticiones text not null default '',
  peso         text,
  peso_fecha   date
);
create index plan_ejercicios_plan_idx on public.plan_ejercicios (plan_id);

-- Ficha médica: una por alumno (la crea un trigger al crear el alumno)
create table public.fichas_medicas (
  alumno_id         uuid primary key references public.alumnos (id) on delete cascade,
  fecha_nacimiento  date,
  lugar_nacimiento  text not null default '',
  enfermedades      text not null default '',
  cert_ruta         text,
  cert_nombre       text,
  cert_tipo         text,
  cert_tamano       int,
  cert_subido_en    date,
  cert_vencimiento  date
);

create table public.lesiones (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references public.alumnos (id) on delete cascade,
  descripcion text not null default '',
  fecha       date,
  estado      text not null default 'activa' check (estado in ('activa', 'recuperada'))
);
create index lesiones_alumno_idx on public.lesiones (alumno_id);

create table public.marcas (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references public.alumnos (id) on delete cascade,
  distancia_km numeric(6, 3) not null check (distancia_km > 0),
  tiempo_seg  int not null check (tiempo_seg > 0),
  fecha       date not null,
  carrera     text not null default ''
);
create index marcas_alumno_idx on public.marcas (alumno_id);

create table public.carreras (
  id            uuid primary key default gen_random_uuid(),
  alumno_id     uuid not null references public.alumnos (id) on delete cascade,
  nombre        text not null check (length(trim(nombre)) > 0),
  fecha         date not null,
  lugar         text not null default '',
  distancia_km  numeric(6, 3) not null check (distancia_km > 0),
  objetivo_seg  int check (objetivo_seg > 0),
  resultado_seg int check (resultado_seg > 0),
  notas         text not null default ''
);
create index carreras_alumno_idx on public.carreras (alumno_id);
create index carreras_fecha_idx on public.carreras (fecha);

-- Ejercicios que un profe agrega a mano al catálogo base (que vive en el código)
create table public.ejercicios_custom (
  id       uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  nombre   text not null check (length(trim(nombre)) > 0)
);
create unique index ejercicios_custom_unico on public.ejercicios_custom (coach_id, lower(nombre));

------------------------------------------------------------------------------
-- Funciones de ayuda para las políticas
-- (security definer + search_path vacío: evitan recursión de RLS y hijacking)
------------------------------------------------------------------------------

create function public.es_coach()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and rol = 'coach'
  );
$$;

create function public.es_coach_de(alumno uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.alumnos a
    where a.id = alumno and a.coach_id = (select auth.uid())
  );
$$;

create function public.puede_ver_alumno(alumno uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.alumnos a
    where a.id = alumno
      and (a.coach_id = (select auth.uid()) or a.user_id = (select auth.uid()))
  );
$$;

create function public.alumno_del_plan(plan uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select alumno_id from public.planes where id = plan;
$$;

-- Solo usuarios con sesión pueden ejecutarlas (anon no)
revoke execute on function public.es_coach(), public.es_coach_de(uuid),
  public.puede_ver_alumno(uuid), public.alumno_del_plan(uuid) from public, anon;
grant execute on function public.es_coach(), public.es_coach_de(uuid),
  public.puede_ver_alumno(uuid), public.alumno_del_plan(uuid) to authenticated;

------------------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------------------

-- Al crear un alumno se crea su ficha médica vacía
create function public.crear_ficha_vacia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.fichas_medicas (alumno_id) values (new.id)
  on conflict do nothing;
  return new;
end;
$$;
create trigger alumnos_crear_ficha after insert on public.alumnos
  for each row execute function public.crear_ficha_vacia();

-- Un alumno solo puede cambiar sus notas dentro de su fila
create function public.alumnos_limitar_alumno()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> old.coach_id then
    if (to_jsonb(new) - 'notas_alumno') is distinct from (to_jsonb(old) - 'notas_alumno') then
      raise exception 'Un alumno solo puede editar sus notas' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger alumnos_limitar before update on public.alumnos
  for each row execute function public.alumnos_limitar_alumno();

-- Un alumno solo puede cambiar el peso de sus ejercicios
create function public.plan_ejercicios_limitar_alumno()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  alumno uuid;
begin
  select alumno_id into alumno from public.planes where id = old.plan_id;
  if (select auth.uid()) is not null and not exists (
    select 1 from public.alumnos a
    where a.id = alumno and a.coach_id = (select auth.uid())
  ) then
    if (to_jsonb(new) - 'peso' - 'peso_fecha') is distinct from (to_jsonb(old) - 'peso' - 'peso_fecha') then
      raise exception 'Un alumno solo puede registrar el peso' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger plan_ejercicios_limitar before update on public.plan_ejercicios
  for each row execute function public.plan_ejercicios_limitar_alumno();

------------------------------------------------------------------------------
-- Permisos y RLS
------------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- los perfiles los gestiona solo el servidor (service_role)
revoke insert, update, delete on public.profiles from authenticated;

alter table public.profiles          enable row level security;
alter table public.alumnos           enable row level security;
alter table public.planes            enable row level security;
alter table public.plan_ejercicios   enable row level security;
alter table public.fichas_medicas    enable row level security;
alter table public.lesiones          enable row level security;
alter table public.marcas            enable row level security;
alter table public.carreras          enable row level security;
alter table public.ejercicios_custom enable row level security;

-- profiles: cada usuario lee solo el suyo
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- alumnos
create policy alumnos_select on public.alumnos for select to authenticated
  using (coach_id = (select auth.uid()) or user_id = (select auth.uid()));
create policy alumnos_insert on public.alumnos for insert to authenticated
  with check (coach_id = (select auth.uid()) and public.es_coach());
create policy alumnos_update on public.alumnos for update to authenticated
  using (coach_id = (select auth.uid()) or user_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) or user_id = (select auth.uid()));
create policy alumnos_delete on public.alumnos for delete to authenticated
  using (coach_id = (select auth.uid()));

-- planes: el alumno solo lee
create policy planes_select on public.planes for select to authenticated
  using (public.puede_ver_alumno(alumno_id));
create policy planes_insert on public.planes for insert to authenticated
  with check (public.es_coach_de(alumno_id));
create policy planes_update on public.planes for update to authenticated
  using (public.es_coach_de(alumno_id)) with check (public.es_coach_de(alumno_id));
create policy planes_delete on public.planes for delete to authenticated
  using (public.es_coach_de(alumno_id));

-- plan_ejercicios: el alumno lee y registra peso (limitado por trigger)
create policy plan_ejercicios_select on public.plan_ejercicios for select to authenticated
  using (public.puede_ver_alumno(public.alumno_del_plan(plan_id)));
create policy plan_ejercicios_insert on public.plan_ejercicios for insert to authenticated
  with check (public.es_coach_de(public.alumno_del_plan(plan_id)));
create policy plan_ejercicios_update on public.plan_ejercicios for update to authenticated
  using (public.puede_ver_alumno(public.alumno_del_plan(plan_id)))
  with check (public.puede_ver_alumno(public.alumno_del_plan(plan_id)));
create policy plan_ejercicios_delete on public.plan_ejercicios for delete to authenticated
  using (public.es_coach_de(public.alumno_del_plan(plan_id)));

-- ficha médica, lesiones, marcas y carreras: el profe y el propio alumno
create policy fichas_all on public.fichas_medicas for all to authenticated
  using (public.puede_ver_alumno(alumno_id)) with check (public.puede_ver_alumno(alumno_id));
create policy lesiones_all on public.lesiones for all to authenticated
  using (public.puede_ver_alumno(alumno_id)) with check (public.puede_ver_alumno(alumno_id));
create policy marcas_all on public.marcas for all to authenticated
  using (public.puede_ver_alumno(alumno_id)) with check (public.puede_ver_alumno(alumno_id));
create policy carreras_all on public.carreras for all to authenticated
  using (public.puede_ver_alumno(alumno_id)) with check (public.puede_ver_alumno(alumno_id));

-- ejercicios_custom: solo el profe dueño
create policy ejercicios_custom_all on public.ejercicios_custom for all to authenticated
  using (coach_id = (select auth.uid()) and public.es_coach())
  with check (coach_id = (select auth.uid()) and public.es_coach());

------------------------------------------------------------------------------
-- Storage: certificados médicos (bucket privado)
-- Las rutas son  <alumno_id>/<archivo>  y se autorizan por el alumno de la carpeta.
------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificados', 'certificados', false, 5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy certificados_select on storage.objects for select to authenticated
  using (bucket_id = 'certificados'
         and public.puede_ver_alumno(((storage.foldername(name))[1])::uuid));
create policy certificados_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'certificados'
              and public.puede_ver_alumno(((storage.foldername(name))[1])::uuid));
create policy certificados_update on storage.objects for update to authenticated
  using (bucket_id = 'certificados'
         and public.puede_ver_alumno(((storage.foldername(name))[1])::uuid));
create policy certificados_delete on storage.objects for delete to authenticated
  using (bucket_id = 'certificados'
         and public.puede_ver_alumno(((storage.foldername(name))[1])::uuid));
