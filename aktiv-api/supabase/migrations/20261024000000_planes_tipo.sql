-- Aktiv · planes por tipo (Running / Fuerza), uno activo por tipo
--
-- Antes un alumno tenía varios planes y UNO activo (alumnos.plan_activo_id). Ahora
-- cada plan es de running o de fuerza, y el alumno ve el plan ACTIVO de cada tipo.
-- La marca de "activo" pasa a vivir en el propio plan.
--
-- Los planes que ya existían quedan como "Running" (el tipo por defecto), y el plan
-- que estaba activo sigue activo.

alter table public.planes
  add column tipo text not null default 'Running',
  add column activo boolean not null default false;

alter table public.planes
  add constraint planes_tipo_valido check (tipo in ('Running', 'Fuerza'));

-- el plan que cada alumno tenía activo conserva su marca
update public.planes p
set activo = true
from public.alumnos a
where a.plan_activo_id = p.id;

-- como mucho un plan activo por alumno y tipo
create unique index planes_un_activo_por_tipo
  on public.planes (alumno_id, tipo) where activo;

-- Al activar un plan, se desactiva el que estaba activo de su mismo tipo (en la misma
-- operación). Así el cliente solo dice "este es el activo" y la base mantiene la regla.
create function public.planes_un_solo_activo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.activo then
    update public.planes
    set activo = false
    where alumno_id = new.alumno_id and tipo = new.tipo and id <> new.id and activo;
  end if;
  return new;
end;
$$;
create trigger planes_un_activo before insert or update of activo, tipo on public.planes
  for each row execute function public.planes_un_solo_activo();

-- el tipo no se cambia una vez creado el plan (evita choques con el plan activo del otro tipo)
create function public.planes_tipo_fijo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tipo is distinct from old.tipo then
    raise exception 'El tipo de un plan no se puede cambiar' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger planes_tipo_inmutable before update on public.planes
  for each row execute function public.planes_tipo_fijo();

-- OJO: alumnos.plan_activo_id queda sin usar PERO NO SE BORRA acá. La versión anterior de la API
-- todavía lo lee: así esta migración se puede aplicar ANTES de desplegar el código nuevo sin
-- cortar nada. Se elimina en una migración posterior, cuando el código nuevo ya esté en producción.
