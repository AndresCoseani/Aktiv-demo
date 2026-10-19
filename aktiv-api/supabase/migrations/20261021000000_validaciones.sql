-- Aktiv · validaciones de datos en la base
--
-- El navegador habla directo con Supabase, así que validar solo en el frontend
-- no alcanza: cualquiera puede saltearse la app y escribir a la API. Estas
-- restricciones son la defensa real y repiten los límites del contrato de datos
-- (src/lib/schemas/comunes.ts → LIMITES). Si cambiás un límite, cambialo en los
-- dos lados.
--
-- Las fechas "hasta hoy" toleran un día de más (current_date + 1) por las
-- diferencias de zona horaria entre el navegador y el servidor.

------------------------------------------------------------------------------
-- profiles
------------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_nombre_valido check (length(nombre) between 1 and 120),
  add constraint profiles_email_largo check (length(email) <= 254);

------------------------------------------------------------------------------
-- alumnos
------------------------------------------------------------------------------
alter table public.alumnos
  add constraint alumnos_nombre_valido
    check (length(trim(nombre)) > 0 and length(nombre) <= 120),
  add constraint alumnos_email_valido
    check (length(email) <= 254 and (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add constraint alumnos_telefono_valido
    check (length(telefono) <= 30 and telefono ~ '^[0-9+()\s.-]*$'),
  add constraint alumnos_objetivo_largo check (length(objetivo) <= 120),
  add constraint alumnos_notas_largo
    check (length(notas_profe) <= 10000 and length(notas_alumno) <= 10000),
  add constraint alumnos_fechas_validas
    check (alta_en between date '2000-01-01' and current_date + 1
           and (proximo_pago is null or proximo_pago between date '2000-01-01' and date '2100-01-01'));

------------------------------------------------------------------------------
-- planes y ejercicios
------------------------------------------------------------------------------
alter table public.planes
  add constraint planes_nombre_largo check (length(nombre) <= 120);

alter table public.plan_ejercicios
  add constraint plan_ejercicios_nombre_largo check (length(nombre) <= 120),
  add constraint plan_ejercicios_series_validas check (series between 0 and 99),
  add constraint plan_ejercicios_repeticiones_largo check (length(repeticiones) <= 30),
  add constraint plan_ejercicios_peso_valido
    check (peso is null or (length(peso) <= 10 and peso ~ '^[0-9]*[.,]?[0-9]*$')),
  add constraint plan_ejercicios_peso_fecha_valida
    check (peso_fecha is null or peso_fecha between date '2000-01-01' and current_date + 1);

------------------------------------------------------------------------------
-- ficha médica
------------------------------------------------------------------------------
alter table public.fichas_medicas
  add constraint fichas_nacimiento_valido
    check (fecha_nacimiento is null
           or fecha_nacimiento between date '1900-01-01' and current_date + 1),
  add constraint fichas_lugar_largo check (length(lugar_nacimiento) <= 160),
  add constraint fichas_enfermedades_largo check (length(enfermedades) <= 2000),
  add constraint fichas_certificado_valido
    check (
      (cert_ruta is null) = (cert_tipo is null)
      and (cert_ruta is null) = (cert_tamano is null)
      and (cert_ruta is null) = (cert_nombre is null)
      and (cert_ruta is null or length(cert_ruta) <= 500)
      and (cert_nombre is null or length(cert_nombre) <= 200)
      and (cert_tipo is null or cert_tipo in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'))
      and (cert_tamano is null or cert_tamano between 1 and 5242880)
    ),
  add constraint fichas_contacto_valido
    check (length(contacto_nombre) <= 120
           and length(contacto_parentesco) <= 60
           and length(contacto_telefono) <= 30
           and contacto_telefono ~ '^[0-9+()\s.-]*$');

alter table public.lesiones
  add constraint lesiones_descripcion_valida
    check (length(trim(descripcion)) > 0 and length(descripcion) <= 1000),
  add constraint lesiones_fecha_valida
    check (fecha is null or fecha between date '1900-01-01' and current_date + 1);

------------------------------------------------------------------------------
-- marcas y carreras
------------------------------------------------------------------------------
alter table public.marcas
  add constraint marcas_tiempo_valido check (tiempo_seg <= 86400),
  add constraint marcas_distancia_valida check (distancia_km <= 1000),
  add constraint marcas_fecha_valida check (fecha between date '2000-01-01' and current_date + 1),
  add constraint marcas_carrera_larga check (length(carrera) <= 160);

alter table public.carreras
  add constraint carreras_nombre_largo check (length(nombre) <= 160),
  add constraint carreras_lugar_largo check (length(lugar) <= 160),
  add constraint carreras_notas_largas check (length(notas) <= 2000),
  add constraint carreras_fecha_valida check (fecha between date '2000-01-01' and date '2100-01-01'),
  add constraint carreras_distancias_validas
    check (0 < all (distancias_km) and 1000 >= all (distancias_km));

alter table public.inscripciones
  add constraint inscripciones_distancia_valida check (distancia_km <= 1000),
  add constraint inscripciones_objetivo_valido check (objetivo_seg is null or objetivo_seg <= 86400),
  add constraint inscripciones_resultado_valido check (resultado_seg is null or resultado_seg <= 86400);

alter table public.ejercicios_custom
  add constraint ejercicios_custom_nombre_largo check (length(nombre) <= 120);
