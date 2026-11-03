-- Migración 34 · Reemplazo solicitado del catálogo para la demostración.
-- ATENCIÓN: borra TODO ejercicios_custom, para todos los profesores existentes.
-- Crea los 11 ejercicios de la imagen para cada profesor.
-- No modifica planes, sesiones, ejercicios de planes, prescripciones ni pesos.
-- Ejecutar una sola vez desde SQL Editor, después de revisar este archivo.
-- En una base nueva sin profesores no inserta filas; permite iniciar el esquema.
begin;

lock table public.ejercicios_custom in share row exclusive mode;
delete from public.ejercicios_custom;

insert into public.ejercicios_custom (coach_id, nombre, categoria)
select p.id, e.nombre, e.categoria
from public.profiles p
cross join (values
  ('Rolo: isquios, cuádriceps, glúteos y gemelos', 'Movilidad'),
  ('Traslado lateral', 'Movilidad'),
  ('Estocadas con press', 'Movilidad'),
  ('Puente frontal con bandas', 'Movilidad'),
  ('Zumo', 'Fuerza'),
  ('Peso muerto unilateral', 'Fuerza'),
  ('Hip thrust', 'Fuerza'),
  ('Subidas al cajón', 'Fuerza'),
  ('Gemelos', 'Fuerza'),
  ('Flexión dorsal', 'Fuerza'),
  ('Eversión', 'Fuerza')
) as e(nombre, categoria)
where p.rol = 'coach';

commit;

-- Verificación del resultado, sin leer alumnos ni datos médicos.
select coach_id, count(*) as ejercicios_en_catalogo
from public.ejercicios_custom group by coach_id;
