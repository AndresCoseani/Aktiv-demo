-- Solo lectura. Ejecutar en el mismo proyecto que SUPABASE_URL de la API.
-- No lee alumnos ni contraseñas y no modifica datos.
select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='alumnos' and column_name='dni') as dni_migracion_36,
  to_regclass('public.alumnos_dni_coach_unico') is not null as dni_unico_por_profesor_36,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='sesiones' and column_name='franja') as momento_entrenamiento_36,
  to_regprocedure('public.importar_alumnos(jsonb)') is not null as importacion_atomica_36,
  to_regclass('public.horarios_clase') is not null as horarios_migracion_37,
  to_regclass('public.confirmaciones_clase') is not null as confirmaciones_migracion_37,
  to_regclass('public.clases_canceladas') is not null as cancelaciones_migracion_37,
  (select count(*) = 3 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('horarios_clase','confirmaciones_clase','clases_canceladas') and c.relrowsecurity) as rls_agenda_37,
  exists(select 1 from pg_trigger where tgname='validar_confirmacion' and tgrelid=to_regclass('public.confirmaciones_clase')) as validacion_confirmacion_37,
  exists(select 1 from pg_trigger where tgname='horarios_datos_obligatorios' and tgrelid=to_regclass('public.horarios_clase') and not tgisinternal) as fin_y_lugar_obligatorios_38,
  to_regclass('public.cambios_horario_clase') is not null as cambios_por_fecha_39,
  to_regprocedure('public.guardar_cambio_horario(uuid,date,text,text,text,text,text)') is not null as edicion_atomica_horario_39,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='horarios_clase' and column_name='desde') as inicio_horarios_39,
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='cambios_horario_clase' and c.relrowsecurity) as rls_cambios_39;
-- Todo true confirma estas piezas, no el flujo completo ni la caché PostgREST.
-- Si la API no reconoce columnas/tablas y todo da true: recargar_esquema.sql.
