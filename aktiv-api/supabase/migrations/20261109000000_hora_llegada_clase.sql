-- 40: aviso de llegada dentro del bloque. No crea turnos ni cupos.
begin;
alter table public.confirmaciones_clase add column hora_llegada text
  check (hora_llegada ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
-- Las confirmaciones existentes conservan NULL: «Hora sin indicar».
grant update(hora_llegada) on public.confirmaciones_clase to authenticated;
create policy confirmaciones_cambiar_hora on public.confirmaciones_clase
  for update to authenticated using (
    exists(select 1 from public.profiles where id=auth.uid() and rol='alumno') and
    exists(select 1 from public.alumnos a where a.id=alumno_id and a.user_id=auth.uid() and a.activo)
  ) with check (
    exists(select 1 from public.alumnos a join public.horarios_clase h on h.coach_id=a.coach_id
      where a.id=alumno_id and a.user_id=auth.uid() and a.activo and h.id=horario_id)
  );
-- También al cambiar la hora se comprueban fecha, cancelación y horario activo.
create trigger validar_actualizacion_confirmacion before update on public.confirmaciones_clase
  for each row execute function public.validar_fecha_clase();
create function public.validar_hora_llegada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inicio text; final text;
begin
  -- Mismo bloqueo que la edición del profesor: no validar contra un horario viejo.
  select h.hora,h.fin into inicio,final from public.horarios_clase h where h.id=new.horario_id for update;
  select c.hora,c.fin into inicio,final from public.cambios_horario_clase c
    where c.horario_id=new.horario_id and
      ((c.alcance='solo_fecha' and c.fecha=new.fecha) or (c.alcance='habitual' and c.fecha<=new.fecha))
    order by (c.alcance='solo_fecha') desc,c.fecha desc limit 1;
  if not found then
    select h.hora,h.fin into inicio,final from public.horarios_clase h where h.id=new.horario_id;
  end if;
  if new.hora_llegada is null or new.hora_llegada < inicio or (final<>'' and new.hora_llegada > final) then
    raise exception 'Elegí una hora de llegada dentro del horario de la clase' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger z_validar_hora_llegada before insert or update on public.confirmaciones_clase
  for each row execute function public.validar_hora_llegada();
revoke all on function public.validar_hora_llegada() from public,anon,authenticated;
-- Invoker conserva RLS y actualiza únicamente la hora, sin habilitar otros campos.
create function public.confirmar_llegada_clase(p_horario_id uuid,p_fecha date,p_alumno_id uuid,p_hora_llegada text)
returns void language sql security invoker set search_path = '' as $$
  insert into public.confirmaciones_clase(horario_id,fecha,alumno_id,hora_llegada)
  values(p_horario_id,p_fecha,p_alumno_id,p_hora_llegada)
  on conflict(horario_id,fecha,alumno_id) do update set hora_llegada=excluded.hora_llegada;
$$;
revoke all on function public.confirmar_llegada_clase(uuid,date,uuid,text) from public,anon;
grant execute on function public.confirmar_llegada_clase(uuid,date,uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
