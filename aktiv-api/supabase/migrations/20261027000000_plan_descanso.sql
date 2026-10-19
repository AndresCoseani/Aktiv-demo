-- Aktiv · descanso entre series de cada ejercicio
--
-- Texto libre, igual que las repeticiones: "60 s", "90 seg", "2 min", "3 minutos"…
-- Vacío = sin descanso indicado. Compatible hacia atrás: tiene valor por defecto.

alter table public.plan_ejercicios
  add column descanso text not null default '';

alter table public.plan_ejercicios
  add constraint plan_ejercicios_descanso_largo check (length(descanso) <= 30);
