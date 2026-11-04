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
  exists(select 1 from pg_trigger where tgname='horarios_datos_obligatorios' and tgrelid=to_regclass('public.horarios_clase') and not tgisinternal and tgenabled in ('O','A')) as fin_y_lugar_obligatorios_38,
  to_regclass('public.cambios_horario_clase') is not null as cambios_por_fecha_39,
  to_regprocedure('public.guardar_cambio_horario(uuid,date,text,text,text,text,text)') is not null as edicion_atomica_horario_39,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='horarios_clase' and column_name='desde') as inicio_horarios_39,
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='cambios_horario_clase' and c.relrowsecurity) as rls_cambios_39;
-- Todo true confirma estas piezas, no el flujo completo ni la caché PostgREST.
-- Si la API no reconoce columnas/tablas y todo da true: recargar_esquema.sql.


-- Segundo resultado: permisos y pol?ticas. Todas las filas deben dar true.
-- No ejecuta funciones de escritura: consulta ?nicamente los cat?logos de PostgreSQL.
select comprobacion, coalesce(ok, false) as ok
from (values
  ('36: importaci?n disponible para usuarios autenticados',
    has_function_privilege('authenticated', to_regprocedure('public.importar_alumnos(jsonb)'), 'EXECUTE')),
  ('36: importaci?n bloqueada para an?nimos',
    not has_function_privilege('anon', to_regprocedure('public.importar_alumnos(jsonb)'), 'EXECUTE')),
  ('37: nueve pol?ticas de acceso de la agenda presentes',
    (select count(*)=9 from pg_policies where schemaname='public' and
      (tablename,policyname) in (
        ('horarios_clase','horarios_leer'),('horarios_clase','horarios_crear'),('horarios_clase','horarios_archivar'),
        ('clases_canceladas','canceladas_leer'),('clases_canceladas','canceladas_crear'),('clases_canceladas','canceladas_borrar'),
        ('confirmaciones_clase','confirmaciones_leer'),('confirmaciones_clase','confirmaciones_crear'),('confirmaciones_clase','confirmaciones_borrar')))),
  ('37: validaci?n activa en confirmaciones y cancelaciones',
    (select count(*)=2 from pg_trigger where not tgisinternal and tgenabled in ('O','A') and
      ((tgrelid=to_regclass('public.confirmaciones_clase') and tgname='validar_confirmacion') or
       (tgrelid=to_regclass('public.clases_canceladas') and tgname='validar_cancelacion')))),
  ('39: pol?tica de lectura de cambios presente',
    exists(select 1 from pg_policies where schemaname='public' and tablename='cambios_horario_clase' and policyname='cambios_horario_leer' and cmd='SELECT')),
  ('39: lectura de cambios habilitada para autenticados',
    has_table_privilege('authenticated', to_regclass('public.cambios_horario_clase'), 'SELECT')),
  ('39: cambios directos bloqueados (se usa funci?n at?mica)',
    not has_table_privilege('authenticated', to_regclass('public.cambios_horario_clase'), 'INSERT,UPDATE,DELETE,TRUNCATE')),
  ('39: edici?n disponible para autenticados',
    has_function_privilege('authenticated', to_regprocedure('public.guardar_cambio_horario(uuid,date,text,text,text,text,text)'), 'EXECUTE')),
  ('39: edici?n bloqueada para an?nimos',
    not has_function_privilege('anon', to_regprocedure('public.guardar_cambio_horario(uuid,date,text,text,text,text,text)'), 'EXECUTE')),
  ('39: funci?n at?mica con privilegios controlados y search_path fijo',
    exists(select 1 from pg_proc where oid=to_regprocedure('public.guardar_cambio_horario(uuid,date,text,text,text,text,text)')
      and prosecdef and array_to_string(proconfig, ',') like '%search_path=%'))
) as verificaciones(comprobacion,ok)
order by comprobacion;
-- Si aparece false, compartir el nombre de la comprobaci?n; no reaplicar migraciones a ciegas.
-- Todo true confirma estructura/permisos, no el deploy ni un recorrido real de la app.


-- Migraci?n 40: las confirmaciones anteriores pueden tener hora_llegada NULL.
select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='confirmaciones_clase' and column_name='hora_llegada') as hora_llegada_40,
  to_regprocedure('public.confirmar_llegada_clase(uuid,date,uuid,text)') is not null as confirmar_llegada_40,
  exists(select 1 from pg_trigger where tgrelid=to_regclass('public.confirmaciones_clase') and tgname='z_validar_hora_llegada' and tgenabled in ('O','A') and not tgisinternal) as validacion_llegada_40,
  exists(select 1 from pg_trigger where tgrelid=to_regclass('public.confirmaciones_clase') and tgname='validar_actualizacion_confirmacion' and tgenabled in ('O','A') and not tgisinternal) as validacion_cambio_hora_40,
  exists(select 1 from pg_policies where schemaname='public' and tablename='confirmaciones_clase' and policyname='confirmaciones_cambiar_hora' and cmd='UPDATE') as permiso_cambiar_hora_40;
