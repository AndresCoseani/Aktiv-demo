-- Diagnóstico de solo lectura. Ejecutar en SQL Editor del proyecto usado por la API.
-- No crea ni altera tablas, y no lee datos de alumnos.
-- Resultado 1: detalle de planes. Resultado 2: resumen de TODAS las migraciones 19-43.
-- La 34 reemplaza datos del catálogo, no agrega estructura.
-- Todo true = estas piezas están presentes; no equivale a probar el flujo completo.
-- Si algo da false, revisar la migración indicada; no reejecutar todas a ciegas.
-- Este diagnóstico no revisa la caché de PostgREST ni la configuración de Render.
-- Si todo da true pero la API no reconoce columnas, ejecutar recargar_esquema.sql
-- y comprobar que SUPABASE_URL en Render corresponde a este mismo proyecto.
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
  ) as ejercicios_entrada_calor_migracion_35,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sesiones' and column_name = 'franja'
  ) as momento_del_dia_migracion_36,
  to_regprocedure('public.duplicar_sesion(uuid,uuid,text,smallint)') is not null
    as duplicar_dia_migracion_41,
  case when to_regprocedure('public.duplicar_sesion(uuid,uuid,text,smallint)') is null then false
    else has_function_privilege('authenticated','public.duplicar_sesion(uuid,uuid,text,smallint)','EXECUTE')
      and not has_function_privilege('anon','public.duplicar_sesion(uuid,uuid,text,smallint)','EXECUTE')
  end as permisos_duplicar_dia_migracion_41,
  to_regprocedure('public.duplicar_plan(uuid,uuid,uuid,text,date)') is not null
    as duplicar_plan_migracion_42,
  case when to_regprocedure('public.duplicar_plan(uuid,uuid,uuid,text,date)') is null then false
    else has_function_privilege('authenticated','public.duplicar_plan(uuid,uuid,uuid,text,date)','EXECUTE')
      and not has_function_privilege('anon','public.duplicar_plan(uuid,uuid,uuid,text,date)','EXECUTE')
  end as permisos_duplicar_plan_migracion_42,
  to_regclass('public.seguimientos_sesion') is not null as seguimiento_migracion_43,
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='seguimientos_sesion' and c.relrowsecurity)
    as seguimiento_rls_migracion_43,
  exists(select 1 from pg_trigger where tgname='validar_seguimiento_sesion_trg'
    and tgrelid=to_regclass('public.seguimientos_sesion') and not tgisinternal and tgenabled in ('O','A'))
    as seguimiento_validacion_migracion_43;

-- Resumen general. Solo catálogos; no ejecuta funciones de escritura ni lee alumnos.
-- OK = piezas esperadas presentes; no prueba la ejecución histórica exacta del archivo.
-- REVISAR = falta una pieza; la columna detalle dice cuál. No reaplicar a ciegas.
-- MANUAL = migración de datos sin huella estructural comprobable (34).
with comprobaciones(migracion, descripcion, pieza, ok) as (values
  (19, 'Esquema inicial', 'tablas base y RLS',
    (select count(*)=8 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('profiles','alumnos','planes','plan_ejercicios','fichas_medicas','lesiones','marcas','ejercicios_custom') and c.relrowsecurity)),
  (19, 'Esquema inicial', 'control de acceso y ficha automática',
    to_regprocedure('public.es_coach_de(uuid)') is not null and to_regprocedure('public.puede_ver_alumno(uuid)') is not null
    and exists(select 1 from pg_trigger where tgrelid=to_regclass('public.alumnos') and tgname='alumnos_crear_ficha' and not tgisinternal and tgenabled in ('O','A'))),
  (19, 'Esquema inicial', 'políticas de certificados',
    (select count(*)=4 from pg_policies where schemaname='storage' and tablename='objects'
      and policyname in ('certificados_select','certificados_insert','certificados_update','certificados_delete'))),
  (20, 'Carreras e inscripciones', 'tablas y validación',
    to_regclass('public.carreras') is not null and to_regclass('public.inscripciones') is not null
    and exists(select 1 from pg_trigger where tgrelid=to_regclass('public.inscripciones') and tgname='inscripciones_validar' and not tgisinternal and tgenabled in ('O','A'))),
  (20, 'Carreras e inscripciones', 'contacto familiar',
    (select count(*)=3 from information_schema.columns where table_schema='public' and table_name='fichas_medicas' and column_name in ('contacto_nombre','contacto_parentesco','contacto_telefono'))),
  (21, 'Validaciones', 'restricciones de alumnos, marcas y fichas',
    (select count(*)=3 from pg_constraint where
      (conrelid=to_regclass('public.alumnos') and conname='alumnos_nombre_valido') or
      (conrelid=to_regclass('public.marcas') and conname='marcas_tiempo_valido') or
      (conrelid=to_regclass('public.fichas_medicas') and conname='fichas_contacto_valido'))),
  (22, 'Invitaciones existentes', 'tabla, RLS y acceso restringido al token',
    exists(select 1 from pg_class where oid=to_regclass('public.invitaciones') and relrowsecurity)
    and not coalesce(has_column_privilege('authenticated',to_regclass('public.invitaciones'),
      (select attnum from pg_attribute where attrelid=to_regclass('public.invitaciones') and attname='token_hash' and not attisdropped),'SELECT'),true)),
  (23, 'Categorías de ejercicios', 'categoría y lectura del alumno',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='ejercicios_custom' and column_name='categoria')
    and exists(select 1 from pg_policies where schemaname='public' and tablename='ejercicios_custom' and policyname='ejercicios_custom_select_alumno')),
  (24, 'Planes anteriores por tipo', 'tipo y activo',
    (select count(*)=2 from information_schema.columns where table_schema='public' and table_name='planes' and column_name in ('tipo','activo'))),
  (25, 'Inscripción propia del alumno', 'políticas actualizadas',
    (select count(*)=2 from pg_policies where schemaname='public' and tablename='inscripciones'
      and policyname in ('inscripciones_insert','inscripciones_delete') and
      (coalesce(qual,'') || coalesce(with_check,'')) like '%puede_ver_alumno%')),
  (26, 'Bloques de planes anteriores', 'columna y restricción',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='plan_ejercicios' and column_name='bloque')
    and exists(select 1 from pg_constraint where conrelid=to_regclass('public.plan_ejercicios') and conname='plan_ejercicios_bloque_valido')),
  (27, 'Descanso de planes anteriores', 'columna y restricción',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='plan_ejercicios' and column_name='descanso')
    and exists(select 1 from pg_constraint where conrelid=to_regclass('public.plan_ejercicios') and conname='plan_ejercicios_descanso_largo')),
  (28, 'Planes por semanas', 'cuatro tablas con RLS',
    (select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname in ('planes_mensuales','sesiones','sesion_ejercicios','ejercicio_semanas') and c.relrowsecurity)),
  (29, 'Celdas semanales', 'trigger activo',
    exists(select 1 from pg_trigger where tgrelid=to_regclass('public.sesion_ejercicios') and tgname='crear_semanas_del_ejercicio_trg' and not tgisinternal and tgenabled in ('O','A'))),
  (30, 'Duración variable', 'duración y tres protecciones activas',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='planes_mensuales' and column_name='semanas')
    and (select count(*)=3 from pg_trigger where not tgisinternal and tgenabled in ('O','A') and
      ((tgrelid=to_regclass('public.planes_mensuales') and tgname in ('ajustar_semanas_del_plan_trg','validar_reduccion_del_plan_trg')) or
       (tgrelid=to_regclass('public.ejercicio_semanas') and tgname='semana_dentro_del_plan_trg')))),
  (31, 'Día semanal opcional', 'día admite NULL',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='sesiones' and column_name='dia' and is_nullable='YES')),
  (32, 'Crear plan con días', 'función y permisos',
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.crear_plan_con_dias(jsonb,integer,integer)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.crear_plan_con_dias(jsonb,integer,integer)'),'EXECUTE'),true)),
  (33, 'Bloques vacíos y orden', 'columna y restricción',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='sesiones' and column_name='bloques')
    and exists(select 1 from pg_constraint where conrelid=to_regclass('public.sesiones') and conname='sesiones_bloques_validos')),
  (34, 'Catálogo demo de Lucas', 'Reemplaza datos; revisar historial o confirmar ejecución previa. NO repetir: borra el catálogo.', null::boolean),
  (35, 'Entrada en calor', 'activación y función validadora',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='sesiones' and column_name='activacion')
    and to_regprocedure('public.activacion_sesion_valida(jsonb)') is not null),
  (36, 'DNI e importación', 'columnas, índice e importación',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='alumnos' and column_name='dni')
    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='sesiones' and column_name='franja')
    and to_regclass('public.alumnos_dni_coach_unico') is not null and to_regprocedure('public.importar_alumnos(jsonb)') is not null),
  (37, 'Agenda de clases', 'tres tablas con RLS y validación',
    (select count(*)=3 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname in ('horarios_clase','confirmaciones_clase','clases_canceladas') and c.relrowsecurity)
    and (select count(*)=2 from pg_trigger where not tgisinternal and tgenabled in ('O','A') and
      ((tgrelid=to_regclass('public.confirmaciones_clase') and tgname='validar_confirmacion') or
       (tgrelid=to_regclass('public.clases_canceladas') and tgname='validar_cancelacion')))),
  (38, 'Fin y lugar obligatorios', 'trigger activo',
    exists(select 1 from pg_trigger where tgrelid=to_regclass('public.horarios_clase') and tgname='horarios_datos_obligatorios' and not tgisinternal and tgenabled in ('O','A'))),
  (39, 'Cambios de horario', 'tabla con RLS, inicio y función',
    exists(select 1 from pg_class where oid=to_regclass('public.cambios_horario_clase') and relrowsecurity)
    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='horarios_clase' and column_name='desde')
    and to_regprocedure('public.guardar_cambio_horario(uuid,date,text,text,text,text,text)') is not null),
  (40, 'Hora de llegada', 'columna, función, política y validaciones',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='confirmaciones_clase' and column_name='hora_llegada')
    and to_regprocedure('public.confirmar_llegada_clase(uuid,date,uuid,text)') is not null
    and exists(select 1 from pg_policies where schemaname='public' and tablename='confirmaciones_clase' and policyname='confirmaciones_cambiar_hora')
    and (select count(*)=2 from pg_trigger where tgrelid=to_regclass('public.confirmaciones_clase') and not tgisinternal and tgenabled in ('O','A') and tgname in ('z_validar_hora_llegada','validar_actualizacion_confirmacion'))),
  (41, 'Duplicar día', 'función y permisos',
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.duplicar_sesion(uuid,uuid,text,smallint)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.duplicar_sesion(uuid,uuid,text,smallint)'),'EXECUTE'),true)),
  (42, 'Duplicar plan', 'función y permisos',
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.duplicar_plan(uuid,uuid,uuid,text,date)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.duplicar_plan(uuid,uuid,uuid,text,date)'),'EXECUTE'),true)),
  (43, 'Seguimiento opcional', 'tabla con RLS',
    exists(select 1 from pg_class where oid=to_regclass('public.seguimientos_sesion') and relrowsecurity)),
  (43, 'Seguimiento opcional', 'tres políticas de acceso',
    (select count(*)=3 from pg_policies where schemaname='public' and tablename='seguimientos_sesion' and policyname in ('seguimiento_leer','seguimiento_insertar','seguimiento_actualizar'))),
  (43, 'Seguimiento opcional', 'validación y protección al acortar activas',
    (select count(*)=2 from pg_trigger where not tgisinternal and tgenabled in ('O','A') and
      ((tgrelid=to_regclass('public.seguimientos_sesion') and tgname='validar_seguimiento_sesion_trg') or
       (tgrelid=to_regclass('public.planes_mensuales') and tgname='proteger_semanas_con_seguimiento_trg')))),
  (43, 'Seguimiento opcional', 'permisos de lectura/escritura, sin borrado ni acceso anónimo',
    coalesce(has_table_privilege('authenticated',to_regclass('public.seguimientos_sesion'),'SELECT'),false)
    and coalesce(has_table_privilege('authenticated',to_regclass('public.seguimientos_sesion'),'INSERT'),false)
    and coalesce(has_table_privilege('authenticated',to_regclass('public.seguimientos_sesion'),'UPDATE'),false)
    and not coalesce(has_table_privilege('authenticated',to_regclass('public.seguimientos_sesion'),'DELETE'),true)
    and not coalesce(has_table_privilege('anon',to_regclass('public.seguimientos_sesion'),'SELECT,INSERT,UPDATE,DELETE'),true))
  ,(44, 'Categorías de ejercicios', 'tabla y RLS',
    exists(select 1 from pg_class where oid=to_regclass('public.categorias_ejercicio') and relrowsecurity))
  ,(44, 'Categorías de ejercicios', 'políticas de lectura y creación',
    (select count(*)=2 from pg_policies where schemaname='public' and tablename='categorias_ejercicio' and policyname in ('categorias_leer','categorias_crear')))
  ,(44, 'Categorías de ejercicios', 'función de alta y permisos',
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.crear_categoria_ejercicio(text)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.crear_categoria_ejercicio(text)'),'EXECUTE'),true))
  ,(44, 'Categorías de ejercicios', 'categorías abiertas en el catálogo',
    exists(select 1 from pg_constraint where conrelid=to_regclass('public.ejercicios_custom') and conname='ejercicios_custom_categoria_valida' and pg_get_constraintdef(oid) like '%char_length%'))
  ,(45, 'Movilidad y activación', 'validador de fases',
    exists(select 1 from pg_proc where oid=to_regprocedure('public.activacion_sesion_valida(jsonb)') and prosrc like '%fase%'))
  ,(46, 'Objetivo libre de carrera', 'columna de texto y límite',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='inscripciones' and column_name='objetivo' and data_type='text' and is_nullable='NO'))
  ,(46, 'Objetivo libre de carrera', 'edición propia del alumno',
    exists(select 1 from pg_proc where oid=to_regprocedure('public.inscripciones_limitar_alumno()') and prosrc like '%''objetivo''%'))
  ,(47, 'Biblioteca de planes', 'tabla privada con RLS',
    exists(select 1 from pg_class where oid=to_regclass('public.planes_modelo') and relrowsecurity))
  ,(47, 'Biblioteca de planes', 'política de modelos propios',
    exists(select 1 from pg_policies where schemaname='public' and tablename='planes_modelo' and policyname='modelos_propios'))
  ,(47, 'Biblioteca de planes', 'asignación y permisos',
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.asignar_plan_modelo(uuid,uuid,uuid,text,date)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.asignar_plan_modelo(uuid,uuid,uuid,text,date)'),'EXECUTE'),true))
  ,(48, 'Actividades y planes simultáneos', 'catálogo privado y RLS',
    exists(select 1 from pg_class where oid=to_regclass('public.actividades_plan') and relrowsecurity)
    and exists(select 1 from pg_policies where schemaname='public' and tablename='actividades_plan' and policyname='actividades_propias'))
  ,(48, 'Actividades y planes simultáneos', 'sin reemplazo automático ni índice exclusivo',
    to_regclass('public.planes_mensuales_un_activo') is null
    and not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.planes_mensuales') and tgname='planes_mensuales_un_activo_trg' and not tgisinternal))
  ,(48, 'Actividades y planes simultáneos', 'creación atómica y actividades libres',
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.crear_plan_con_actividades(jsonb,jsonb)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.crear_plan_con_actividades(jsonb,jsonb)'),'EXECUTE'),true)
    and exists(select 1 from pg_constraint where conrelid=to_regclass('public.sesiones') and conname='sesiones_tipo_check' and pg_get_constraintdef(oid) like '%char_length%'))
  ,(49, 'Registro con aprobación', 'solicitudes privadas con RLS y sin vencimiento',
    exists(select 1 from pg_class where oid=to_regclass('public.solicitudes_alta') and relrowsecurity)
    and exists(select 1 from pg_policies where schemaname='public' and tablename='solicitudes_alta' and policyname='solicitudes_del_profesor'))
  ,(49, 'Registro con aprobación', 'alta verificada solo desde servidor y aprobación autenticada',
    coalesce(has_function_privilege('service_role',to_regprocedure('public.completar_registro_alumno(uuid,uuid)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('authenticated',to_regprocedure('public.completar_registro_alumno(uuid,uuid)'),'EXECUTE'),true)
    and coalesce(has_function_privilege('authenticated',to_regprocedure('public.aprobar_registro_alumno(uuid)'),'EXECUTE'),false)
    and not coalesce(has_function_privilege('anon',to_regprocedure('public.aprobar_registro_alumno(uuid)'),'EXECUTE'),true))
)
select migracion, descripcion,
  case when bool_and(ok) then 'OK' when bool_or(ok=false) then 'REVISAR' else 'MANUAL' end as estado,
  case when bool_and(ok) then 'Piezas verificadas'
    else string_agg(pieza,'; ' order by pieza) filter(where ok is not true) end as detalle
from comprobaciones group by migracion,descripcion order by migracion;
