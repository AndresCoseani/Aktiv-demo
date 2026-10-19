-- Aktiv · categoría de los ejercicios del profe + lectura para sus alumnos
--
-- Los ejercicios que el profe agrega al catálogo base ahora llevan categoría
-- (la misma lista que el catálogo del código). Sirve para ordenar la lista de
-- ejercicios y para saber si en el ejercicio se registra peso (solo "Fuerza").
--
-- Los ejercicios que ya existían eran "personalizados" y registraban peso:
-- quedan como "Fuerza", que es lo que mantiene ese comportamiento.

alter table public.ejercicios_custom
  add column categoria text not null default 'Fuerza';

alter table public.ejercicios_custom
  add constraint ejercicios_custom_categoria_valida
  check (categoria in ('Series y ritmo', 'Técnica de carrera', 'Fuerza', 'Movilidad'));

-- El alumno necesita saber de qué categoría es cada ejercicio de su plan (por ejemplo,
-- para saber en cuáles anota el peso). Puede LEER los ejercicios de su profe; nada más.
-- Crear y borrar sigue siendo solo del profe dueño (política ejercicios_custom_all).
create policy ejercicios_custom_select_alumno on public.ejercicios_custom for select to authenticated
  using (public.es_alumno_de_coach(coach_id));
