-- Aktiv · invitaciones de alumnos
--
-- El profe da de alta un alumno con su email y el sistema le manda un mail con
-- un enlace de un solo uso para crear su contraseña. Este archivo guarda esos
-- enlaces.
--
-- Seguridad:
--  * Nunca se guarda el enlace/token: solo su hash SHA-256. Un volcado de la
--    base no sirve para entrar a ninguna cuenta.
--  * El token se genera, se busca y se consume SOLO desde la API con la clave
--    de servidor (service_role). Ningún usuario puede leer el hash, ni siquiera
--    el profe: tiene permiso de lectura únicamente sobre las columnas de estado.
--  * Vence y es de un solo uso.

create table public.invitaciones (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null references public.alumnos (id) on delete cascade,
  -- SHA-256 en hexadecimal (64 caracteres) del token que viaja en el mail
  token_hash text not null unique check (length(token_hash) = 64),
  creada_en  timestamptz not null default now(),
  expira_en  timestamptz not null,
  usada_en   timestamptz,
  check (expira_en > creada_en)
);
create index invitaciones_alumno_idx on public.invitaciones (alumno_id);

alter table public.invitaciones enable row level security;

-- nadie (ni anon ni usuarios con sesión) toca la tabla directamente...
revoke all on public.invitaciones from anon, authenticated;
-- ...salvo el profe, que puede ver el ESTADO de las invitaciones de sus alumnos (sin el hash)
grant select (id, alumno_id, creada_en, expira_en, usada_en) on public.invitaciones to authenticated;

create policy invitaciones_select on public.invitaciones for select to authenticated
  using (public.es_coach_de(alumno_id));
