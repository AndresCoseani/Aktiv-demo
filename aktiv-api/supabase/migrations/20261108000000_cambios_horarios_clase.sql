-- 39: horario habitual versionado y excepciones por fecha. No reescribe el pasado.
begin;
alter table public.horarios_clase add column desde date;
alter table public.horarios_clase alter column desde set default ((now() at time zone 'America/Argentina/Buenos_Aires')::date);
create table public.cambios_horario_clase (
  horario_id uuid not null references public.horarios_clase(id) on delete cascade,
  fecha date not null,
  alcance text not null check (alcance in ('habitual','solo_fecha')),
  titulo text not null check (length(trim(titulo)) between 1 and 80),
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  fin text not null check (fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and fin > hora),
  lugar text not null check (length(trim(lugar)) between 1 and 120),
  primary key(horario_id,fecha,alcance)
);
alter table public.cambios_horario_clase enable row level security;
revoke all on public.cambios_horario_clase from public, anon, authenticated;
grant select on public.cambios_horario_clase to authenticated;
create policy cambios_horario_leer on public.cambios_horario_clase for select to authenticated
using (exists(select 1 from public.horarios_clase h where h.id = horario_id));

-- La escritura acotada y el retiro de confirmaciones ocurren en una transacción.
-- RLS deja a alumnos leer solo horarios de su profesor; este RPC es solo del dueño.
create function public.guardar_cambio_horario(
  p_horario_id uuid, p_fecha date, p_alcance text,
  p_titulo text, p_hora text, p_fin text, p_lugar text
) returns void language plpgsql security definer set search_path = '' as $$
declare h public.horarios_clase;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select * into h from public.horarios_clase where id = p_horario_id for update;
  if h.id is null or h.coach_id <> auth.uid() or auth.uid() is null or
     not exists(select 1 from public.profiles where id=auth.uid() and rol='coach') then
    raise exception 'El horario no está disponible' using errcode='42501';
  end if;
  if not h.activo or p_fecha is null or p_fecha < hoy or p_fecha > hoy+60 or
     extract(isodow from p_fecha) <> h.dia then
    raise exception 'Elegí una fecha futura del horario dentro de los próximos 60 días' using errcode='P0001';
  end if;
  insert into public.cambios_horario_clase(horario_id,fecha,alcance,titulo,hora,fin,lugar)
  values(p_horario_id,p_fecha,p_alcance,trim(p_titulo),p_hora,p_fin,trim(p_lugar))
  on conflict(horario_id,fecha,alcance) do update set
    titulo=excluded.titulo,hora=excluded.hora,fin=excluded.fin,lugar=excluded.lugar;
  -- «Esta y las próximas» reemplaza también la excepción de la fecha editada;
  -- las excepciones de otras fechas siguen siendo independientes.
  if p_alcance='habitual' then
    delete from public.cambios_horario_clase where horario_id=h.id and fecha=p_fecha and alcance='solo_fecha';
  end if;
  -- Cambiar una fecha no afecta otras; cambiar el habitual respeta excepciones
  -- y versiones posteriores ya programadas. Las fechas pasadas no se tocan.
  delete from public.confirmaciones_clase c where c.horario_id=h.id and c.fecha>=p_fecha
    and ((p_alcance='solo_fecha' and c.fecha=p_fecha) or
      (p_alcance='habitual' and not exists(
        select 1 from public.cambios_horario_clase x where x.horario_id=h.id and
        ((x.alcance='solo_fecha' and x.fecha=c.fecha) or
         (x.alcance='habitual' and x.fecha>p_fecha and x.fecha<=c.fecha))
      )));
end;
$$;
revoke all on function public.guardar_cambio_horario(uuid,date,text,text,text,text,text) from public, anon;
grant execute on function public.guardar_cambio_horario(uuid,date,text,text,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
