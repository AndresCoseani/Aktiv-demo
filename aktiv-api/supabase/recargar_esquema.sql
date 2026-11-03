-- Ejecutar en SQL Editor del mismo proyecto Supabase que usa la API desplegada.
-- Usar cuando verificar_planes.sql da todo true pero la API no reconoce columnas.
-- Solo solicita refrescar la caché de PostgREST; no modifica tablas ni datos.
-- Es normal que SQL Editor indique éxito sin devolver filas.
-- Después, esperar unos segundos y usar «Reintentar guardado» en la app.
-- Si persiste: comparar el proyecto de SUPABASE_URL en Render con este proyecto.
-- No volver a ejecutar la migración 34: reemplaza el catálogo de ejercicios.
NOTIFY pgrst, 'reload schema';
