-- Diagnóstico de solo lectura. true = permite entrenamientos sin día fijo.
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'sesiones'
    and column_name = 'dia' and is_nullable = 'YES'
) as dia_calendario_opcional_migracion_31,
to_regprocedure('public.crear_plan_con_dias(jsonb,integer,integer)') is not null as creacion_plan_con_dias_migracion_32;
