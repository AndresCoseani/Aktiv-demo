-- Diagnóstico de solo lectura. Ejecutar en SQL Editor del proyecto usado por la API.
-- No crea ni altera tablas, y no lee datos de alumnos.
-- Revisa las piezas del esquema de planes (migraciones 28 a 33 y 35).
-- La 34 reemplaza datos del catálogo, no agrega estructura.
-- Todo true = estas piezas están presentes; no equivale a probar el flujo completo.
-- Si algo da false, revisar la migración indicada; no reejecutar todas a ciegas.
select
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'planes_mensuales'
  ) as tabla_planes_creada,
  (
    to_regclass('public.planes_mensuales') is not null
    and to_regclass('public.sesiones') is not null
    and to_regclass('public.sesion_ejercicios') is not null
    and to_regclass('public.ejercicio_semanas') is not null
  ) as tablas_planes_migracion_28,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planes_mensuales' and column_name = 'semanas'
  ) as duracion_variable_migracion_30,
  exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'sesion_ejercicios'
      and t.tgname = 'crear_semanas_del_ejercicio_trg' and not t.tgisinternal
  ) as creacion_celdas_migracion_29,
  exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'planes_mensuales'
      and t.tgname = 'ajustar_semanas_del_plan_trg' and not t.tgisinternal
  ) as ajuste_duracion_migracion_30,
  exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'planes_mensuales'
      and t.tgname = 'validar_reduccion_del_plan_trg' and not t.tgisinternal
  ) as proteccion_reduccion_migracion_30,
  exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'ejercicio_semanas'
      and t.tgname = 'semana_dentro_del_plan_trg' and not t.tgisinternal
  ) as validacion_semanas_migracion_30,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sesiones'
      and column_name = 'dia' and is_nullable = 'YES'
  ) as dia_opcional_migracion_31,
  to_regprocedure('public.crear_plan_con_dias(jsonb,integer,integer)') is not null
    as crear_plan_con_dias_migracion_32,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sesiones'
      and column_name = 'bloques' and is_nullable = 'NO'
  ) as bloques_vacios_migracion_33,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sesiones' and column_name = 'activacion'
  ) as ejercicios_entrada_calor_migracion_35;
