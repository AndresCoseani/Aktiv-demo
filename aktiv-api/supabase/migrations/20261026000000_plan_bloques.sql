-- Aktiv · bloques dentro de un plan (calentamiento / entrenamiento / enfriamiento)
--
-- Cada ejercicio de un plan pertenece a un bloque, para que la sesión se arme en orden:
--   1. Calentamiento  (movilidad, activación, técnica)
--   2. Entrenamiento  (lo principal)
--   3. Enfriamiento   (vuelta a la calma, estiramiento)
--
-- Los ejercicios que ya existían quedan en "Entrenamiento". Compatible hacia atrás: la
-- columna tiene valor por defecto, así que el código anterior de la API sigue funcionando.

alter table public.plan_ejercicios
  add column bloque text not null default 'Entrenamiento';

alter table public.plan_ejercicios
  add constraint plan_ejercicios_bloque_valido
  check (bloque in ('Calentamiento', 'Entrenamiento', 'Enfriamiento'));
