-- 43: registro del alumno por sesión y semana. No modifica la planificación.
begin;
create table public.seguimientos_sesion (
  sesion_id uuid not null references public.sesiones(id) on delete cascade,
  semana smallint not null check (semana between 1 and 104),
  completado boolean not null default false,
  sensacion text check (sensacion in ('Bien','Regular','Cansado')),
  nota text not null default '' check (length(nota)<=500),
  fecha timestamptz,
  primary key(sesion_id,semana),
  check ((completado and fecha is not null) or
    (not completado and fecha is null and sensacion is null and nota=''))
);
alter table public.seguimientos_sesion enable row level security;
revoke all on public.seguimientos_sesion from public,anon,authenticated;
grant select,insert,update on public.seguimientos_sesion to authenticated;
create policy seguimiento_leer on public.seguimientos_sesion for select to authenticated
  using (public.puede_ver_alumno(public.alumno_de_la_sesion(sesion_id)));
create policy seguimiento_insertar on public.seguimientos_sesion for insert to authenticated
  with check (exists(select 1 from public.alumnos a join public.sesiones s on s.id=sesion_id
    join public.planes_mensuales p on p.id=s.plan_id
    where a.id=p.alumno_id and a.user_id=auth.uid() and a.activo and p.activo)
    and exists(select 1 from public.profiles where id=auth.uid() and rol='alumno'));
create policy seguimiento_actualizar on public.seguimientos_sesion for update to authenticated
  using (exists(select 1 from public.alumnos a join public.sesiones s on s.id=sesion_id
    join public.planes_mensuales p on p.id=s.plan_id
    where a.id=p.alumno_id and a.user_id=auth.uid() and a.activo and p.activo)
    and exists(select 1 from public.profiles where id=auth.uid() and rol='alumno'))
  with check (exists(select 1 from public.alumnos a join public.sesiones s on s.id=sesion_id
    join public.planes_mensuales p on p.id=s.plan_id
    where a.id=p.alumno_id and a.user_id=auth.uid() and a.activo and p.activo)
    and exists(select 1 from public.profiles where id=auth.uid() and rol='alumno'));

create function public.validar_seguimiento_sesion() returns trigger
language plpgsql security definer set search_path='' as $$
declare plan public.planes_mensuales;
begin
  if auth.role()='authenticated' and not exists(select 1 from public.sesiones s
    join public.planes_mensuales p on p.id=s.plan_id join public.alumnos a on a.id=p.alumno_id
    join public.profiles f on f.id=auth.uid() and f.rol='alumno'
    where s.id=new.sesion_id and a.user_id=auth.uid() and a.activo and p.activo) then
    raise exception 'Solo el alumno puede registrar su entrenamiento activo.' using errcode='42501';
  end if;
  if tg_op='UPDATE' and (new.sesion_id<>old.sesion_id or new.semana<>old.semana) then
    raise exception 'No se puede mover el registro a otro entrenamiento o semana.' using errcode='42501';
  end if;
  select p.* into plan from public.planes_mensuales p join public.sesiones s on s.plan_id=p.id
    where s.id=new.sesion_id for share of p;
  if not found or new.semana>plan.semanas then
    raise exception 'La semana no pertenece a este plan.' using errcode='P0001';
  end if;
  if plan.inicio+(new.semana-1)*7 > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'Todavía no empezó esa semana del plan.' using errcode='P0001';
  end if;
  if new.completado then
    if tg_op='UPDATE' and old.completado then new.fecha:=old.fecha;
    else new.fecha:=now(); end if;
  else
    new.fecha:=null; new.sensacion:=null; new.nota:='';
  end if;
  return new;
end;
$$;
create trigger validar_seguimiento_sesion_trg before insert or update on public.seguimientos_sesion
  for each row execute function public.validar_seguimiento_sesion();

create function public.proteger_semanas_con_seguimiento() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.semanas<old.semanas and exists(select 1 from public.seguimientos_sesion r
    join public.sesiones s on s.id=r.sesion_id where s.plan_id=new.id and r.semana>new.semanas and r.completado) then
    raise exception 'No se puede acortar el plan: hay entrenamientos completados en esas semanas.' using errcode='P0001';
  end if;
  -- Solo se descartan filas desmarcadas, sin feedback ni fecha.
  if new.semanas<old.semanas then
    delete from public.seguimientos_sesion r using public.sesiones s
      where s.id=r.sesion_id and s.plan_id=new.id and r.semana>new.semanas and not r.completado;
  end if;
  return new;
end;
$$;
-- El profesor no tiene DELETE sobre registros: la limpieza acotada corre como dueño.
create trigger proteger_semanas_con_seguimiento_trg before update of semanas on public.planes_mensuales
  for each row execute function public.proteger_semanas_con_seguimiento();
revoke all on function public.validar_seguimiento_sesion(),public.proteger_semanas_con_seguimiento() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
