-- 49: solicitudes verificadas, sin vencimiento. Solo el profesor aprueba.
begin;
create table public.solicitudes_alta (
 id uuid primary key default gen_random_uuid(),
 coach_id uuid not null references public.profiles(id) on delete restrict,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 nombre text not null check(char_length(btrim(nombre)) between 1 and 120),
 email text not null,
 dni text not null check(dni ~ '^[0-9]{7,8}$'),
 telefono text not null default '' check(char_length(telefono)<=30),
 creada_en timestamptz not null default now(),
 aprobada_en timestamptz
);
alter table public.solicitudes_alta enable row level security;
revoke all on public.solicitudes_alta from public,anon,authenticated;
grant select on public.solicitudes_alta to authenticated;
create policy solicitudes_del_profesor on public.solicitudes_alta for select to authenticated
 using(coach_id=(select auth.uid()) and public.es_coach());

create function public.completar_registro_alumno(p_usuario uuid,p_coach uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; solicitud uuid; nombre text; dni text; telefono text;
begin
 select * into u from auth.users where id=p_usuario for update;
 if not found or u.email_confirmed_at is null or u.raw_user_meta_data->>'origen' is distinct from 'registro_aktiv' then
  raise exception 'Confirmá tu email antes de completar el registro' using errcode='P0001'; end if;
 select id into solicitud from public.solicitudes_alta where user_id=p_usuario;
 if found then return solicitud; end if;
 if exists(select 1 from public.profiles where id=p_usuario) then
  raise exception 'Tu cuenta ya existe. Ingresá con tu contraseña o hablá con Lucas' using errcode='P0001'; end if;
 if not exists(select 1 from public.profiles where id=p_coach and rol='coach') then
  raise exception 'El registro no está disponible' using errcode='P0001'; end if;
 nombre:=btrim(u.raw_user_meta_data->>'nombre'); dni:=u.raw_user_meta_data->>'dni'; telefono:=coalesce(u.raw_user_meta_data->>'telefono','');
 if u.email is null or nombre is null or char_length(nombre) not between 1 and 120 or dni is null or dni !~ '^[0-9]{7,8}$' or char_length(telefono)>30 then
  raise exception 'Revisá los datos del registro' using errcode='P0001'; end if;
 insert into public.solicitudes_alta(coach_id,user_id,nombre,email,dni,telefono)
 values(p_coach,p_usuario,nombre,lower(btrim(u.email)),dni,telefono) returning id into solicitud;
 return solicitud;
end $$;
revoke all on function public.completar_registro_alumno(uuid,uuid) from public,anon,authenticated;
grant execute on function public.completar_registro_alumno(uuid,uuid) to service_role;

create function public.aprobar_registro_alumno(p_solicitud uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare solicitud public.solicitudes_alta%rowtype; ficha public.alumnos%rowtype; nuevo uuid;
begin
 select * into solicitud from public.solicitudes_alta where id=p_solicitud and coach_id=auth.uid() for update;
 if not found or not public.es_coach() then raise exception 'Solicitud no disponible' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=solicitud.user_id and email_confirmed_at is not null and lower(btrim(email))=solicitud.email) then
  raise exception 'El alumno debe confirmar su email' using errcode='P0001'; end if;
 select id into nuevo from public.alumnos where user_id=solicitud.user_id and coach_id=solicitud.coach_id;
 if found then return nuevo; end if;
 if exists(select 1 from public.profiles where id=solicitud.user_id) then
  raise exception 'La cuenta ya está vinculada. Revisá la ficha con el alumno' using errcode='P0001'; end if;
 perform pg_advisory_xact_lock(hashtextextended(solicitud.coach_id::text,49));
 if (select count(*) from public.alumnos where coach_id=solicitud.coach_id and lower(btrim(email))=solicitud.email)>1 then
  raise exception 'Hay varias fichas con ese email. Revisalas antes de aprobar' using errcode='P0001'; end if;
 select * into ficha from public.alumnos where coach_id=solicitud.coach_id and lower(btrim(email))=solicitud.email for update;
 if found and (ficha.user_id is not null or not ficha.activo or (ficha.dni<>'' and ficha.dni<>solicitud.dni)) then
  raise exception 'Revisá el email, DNI y estado de la ficha existente antes de aprobar' using errcode='P0001'; end if;
 if exists(select 1 from public.alumnos where coach_id=solicitud.coach_id and dni=solicitud.dni and id is distinct from ficha.id) then
  raise exception 'Ya hay una ficha con ese DNI. Revisala antes de aprobar' using errcode='P0001'; end if;
 insert into public.profiles(id,rol,nombre,email) values(solicitud.user_id,'alumno',solicitud.nombre,solicitud.email);
 if ficha.id is not null then
  update public.alumnos set user_id=solicitud.user_id,dni=solicitud.dni where id=ficha.id;
  nuevo:=ficha.id;
 else
  insert into public.alumnos(coach_id,user_id,nombre,email,dni,telefono)
   values(solicitud.coach_id,solicitud.user_id,solicitud.nombre,solicitud.email,solicitud.dni,solicitud.telefono) returning id into nuevo;
 end if;
 update public.solicitudes_alta set aprobada_en=now() where id=p_solicitud;
 return nuevo;
end $$;
revoke all on function public.aprobar_registro_alumno(uuid) from public,anon;
grant execute on function public.aprobar_registro_alumno(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
