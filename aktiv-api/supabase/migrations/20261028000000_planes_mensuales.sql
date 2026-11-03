-- Aktiv · plan mensual: sesiones por día de la semana y 4 semanas de prescripción
--
-- Así trabaja el profe (su planilla): un MES con 4 semanas; cada día de la semana tiene una
-- sesión de Fuerza o de Running (lunes = Fuerza día 1, martes = Running día 1…). Cada sesión tiene
-- un calentamiento y una vuelta a la calma (texto libre) y ejercicios agrupados; cada ejercicio
-- tiene una celda por semana ("4x8", "5 series") donde el alumno también anota su peso.
--
--   planes_mensuales   el plan del mes de un alumno (con fecha de inicio); uno activo por alumno
--   sesiones           un día de la semana de ese plan (tipo, nombre, calentamiento, enfriamiento)
--   sesion_ejercicios  los ejercicios de la sesión, agrupados (grupo = superserie / circuito)
--   ejercicio_semanas  la prescripción y el peso de cada ejercicio en la semana 1, 2, 3 y 4
--
-- Los planes anteriores (tablas planes y plan_ejercicios) eran de prueba y NO se migran: quedan
-- sin uso y se borran en una migración posterior. Esta migración solo agrega tablas, así que el
-- código anterior de la API sigue funcionando mientras se despliega el nuevo.

------------------------------------------------------------------------------
-- Tablas
------------------------------------------------------------------------------

create table public.planes_mensuales (
  id        uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  nombre    text not null default '' check (length(nombre) <= 120),
  -- primer día del plan: de acá se cuenta la semana en curso (semana 1 = los primeros 7 días)
  inicio    date not null check (inicio between date '2000-01-01' and date '2100-01-01'),
  activo    boolean not null default false,
  orden     int not null default 0
);
create index planes_mensuales_alumno_idx on public.planes_mensuales (alumno_id);
create unique index planes_mensuales_un_activo on public.planes_mensuales (alumno_id) where activo;

create table public.sesiones (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.planes_mensuales (id) on delete cascade,
  dia          smallint not null check (dia between 1 and 7), -- 1 = lunes … 7 = domingo
  tipo         text not null check (tipo in ('Fuerza', 'Running')),
  nombre       text not null default '' check (length(nombre) <= 60),
  calentamiento text not null default '' check (length(calentamiento) <= 4000),
  enfriamiento  text not null default '' check (length(enfriamiento) <= 4000),
  orden        int not null default 0
);
create index sesiones_plan_idx on public.sesiones (plan_id);

create table public.sesion_ejercicios (
  id        uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.sesiones (id) on delete cascade,
  -- ejercicios del mismo grupo van juntos (superserie / circuito); el profe los separa con una fila en blanco
  grupo     smallint not null default 1 check (grupo between 1 and 20),
  orden     int not null default 0,
  nombre    text not null default '' check (length(nombre) <= 120),
  descanso  text not null default '' check (length(descanso) <= 30)
);
create index sesion_ejercicios_sesion_idx on public.sesion_ejercicios (sesion_id);

create table public.ejercicio_semanas (
  ejercicio_id uuid not null references public.sesion_ejercicios (id) on delete cascade,
  semana       smallint not null check (semana between 1 and 4),
  prescripcion text not null default '' check (length(prescripcion) <= 60),
  peso         text check (peso is null or (length(peso) <= 10 and peso ~ '^[0-9]*[.,]?[0-9]*$')),
  peso_fecha   date check (peso_fecha is null or peso_fecha between date '2000-01-01' and current_date + 1),
  primary key (ejercicio_id, semana)
);

------------------------------------------------------------------------------
-- Funciones de ayuda (a qué alumno pertenece cada cosa)
------------------------------------------------------------------------------

create function public.alumno_del_plan_mensual(plan uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select alumno_id from public.planes_mensuales where id = plan;
$$;

create function public.alumno_de_la_sesion(sesion uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select p.alumno_id from public.sesiones s
  join public.planes_mensuales p on p.id = s.plan_id
  where s.id = sesion;
$$;

create function public.alumno_del_ejercicio(ejercicio uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select p.alumno_id from public.sesion_ejercicios e
  join public.sesiones s on s.id = e.sesion_id
  join public.planes_mensuales p on p.id = s.plan_id
  where e.id = ejercicio;
$$;

revoke execute on function public.alumno_del_plan_mensual(uuid), public.alumno_de_la_sesion(uuid),
  public.alumno_del_ejercicio(uuid) from public, anon;
grant execute on function public.alumno_del_plan_mensual(uuid), public.alumno_de_la_sesion(uuid),
  public.alumno_del_ejercicio(uuid) to authenticated;

------------------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------------------

-- Al activar un plan se desactiva el que estaba activo del mismo alumno (en la misma operación):
-- el cliente solo dice "este es el activo" y la base mantiene la regla.
create function public.planes_mensuales_un_solo_activo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.activo then
    update public.planes_mensuales
    set activo = false
    where alumno_id = new.alumno_id and id <> new.id and activo;
  end if;
  return new;
end;
$$;
create trigger planes_mensuales_un_activo_trg before insert or update of activo on public.planes_mensuales
  for each row execute function public.planes_mensuales_un_solo_activo();

-- Un alumno solo puede registrar su peso: de cada celda semanal no puede cambiar nada más
create function public.ejercicio_semanas_limitar_alumno()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  alumno uuid;
begin
  alumno := public.alumno_del_ejercicio(old.ejercicio_id);
  if (select auth.uid()) is not null and not exists (
    select 1 from public.alumnos a
    where a.id = alumno and a.coach_id = (select auth.uid())
  ) then
    if (to_jsonb(new) - 'peso' - 'peso_fecha') is distinct from (to_jsonb(old) - 'peso' - 'peso_fecha') then
      raise exception 'Un alumno solo puede registrar su peso' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger ejercicio_semanas_limitar before update on public.ejercicio_semanas
  for each row execute function public.ejercicio_semanas_limitar_alumno();

revoke execute on function public.planes_mensuales_un_solo_activo(),
  public.ejercicio_semanas_limitar_alumno() from public, anon, authenticated;

------------------------------------------------------------------------------
-- Permisos y RLS
--   * el profe ve y edita lo de sus alumnos
--   * el alumno LEE su plan y solo puede cambiar el peso de las celdas semanales (lo limita el trigger)
------------------------------------------------------------------------------

revoke all on public.planes_mensuales, public.sesiones, public.sesion_ejercicios, public.ejercicio_semanas from anon;
grant select, insert, update, delete on
  public.planes_mensuales, public.sesiones, public.sesion_ejercicios, public.ejercicio_semanas to authenticated;

alter table public.planes_mensuales  enable row level security;
alter table public.sesiones          enable row level security;
alter table public.sesion_ejercicios enable row level security;
alter table public.ejercicio_semanas enable row level security;

-- planes_mensuales
create policy planes_mensuales_select on public.planes_mensuales for select to authenticated
  using (public.puede_ver_alumno(alumno_id));
create policy planes_mensuales_insert on public.planes_mensuales for insert to authenticated
  with check (public.es_coach_de(alumno_id));
create policy planes_mensuales_update on public.planes_mensuales for update to authenticated
  using (public.es_coach_de(alumno_id)) with check (public.es_coach_de(alumno_id));
create policy planes_mensuales_delete on public.planes_mensuales for delete to authenticated
  using (public.es_coach_de(alumno_id));

-- sesiones
create policy sesiones_select on public.sesiones for select to authenticated
  using (public.puede_ver_alumno(public.alumno_del_plan_mensual(plan_id)));
create policy sesiones_insert on public.sesiones for insert to authenticated
  with check (public.es_coach_de(public.alumno_del_plan_mensual(plan_id)));
create policy sesiones_update on public.sesiones for update to authenticated
  using (public.es_coach_de(public.alumno_del_plan_mensual(plan_id)))
  with check (public.es_coach_de(public.alumno_del_plan_mensual(plan_id)));
create policy sesiones_delete on public.sesiones for delete to authenticated
  using (public.es_coach_de(public.alumno_del_plan_mensual(plan_id)));

-- sesion_ejercicios
create policy sesion_ejercicios_select on public.sesion_ejercicios for select to authenticated
  using (public.puede_ver_alumno(public.alumno_de_la_sesion(sesion_id)));
create policy sesion_ejercicios_insert on public.sesion_ejercicios for insert to authenticated
  with check (public.es_coach_de(public.alumno_de_la_sesion(sesion_id)));
create policy sesion_ejercicios_update on public.sesion_ejercicios for update to authenticated
  using (public.es_coach_de(public.alumno_de_la_sesion(sesion_id)))
  with check (public.es_coach_de(public.alumno_de_la_sesion(sesion_id)));
create policy sesion_ejercicios_delete on public.sesion_ejercicios for delete to authenticated
  using (public.es_coach_de(public.alumno_de_la_sesion(sesion_id)));

-- ejercicio_semanas: el alumno lee y registra su peso (limitado por trigger); crear y borrar es del profe
create policy ejercicio_semanas_select on public.ejercicio_semanas for select to authenticated
  using (public.puede_ver_alumno(public.alumno_del_ejercicio(ejercicio_id)));
create policy ejercicio_semanas_insert on public.ejercicio_semanas for insert to authenticated
  with check (public.es_coach_de(public.alumno_del_ejercicio(ejercicio_id)));
create policy ejercicio_semanas_update on public.ejercicio_semanas for update to authenticated
  using (public.puede_ver_alumno(public.alumno_del_ejercicio(ejercicio_id)))
  with check (public.puede_ver_alumno(public.alumno_del_ejercicio(ejercicio_id)));
create policy ejercicio_semanas_delete on public.ejercicio_semanas for delete to authenticated
  using (public.es_coach_de(public.alumno_del_ejercicio(ejercicio_id)));
