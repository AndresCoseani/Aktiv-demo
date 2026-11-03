# Qué sigue en Aktiv

Comparación del código actual con páginas oficiales de SaaS de entrenamiento, consultadas el 2 de noviembre de 2026. Las prestaciones externas son las publicadas por los proveedores; no se verificaron cuentas privadas. Las prioridades son propuestas para Aktiv, sujetas al uso real de Lucas.

## Primero, cerrar el recorrido actual

El código ya permite alumnos, planes de duración variable, sesiones por día, progresión semanal, peso semanal, marcas, carreras, ficha médica y certificados. El control de pagos actual modifica el próximo vencimiento; no es un historial de cobros.

Antes de sumar funciones: confirmar migraciones con `aktiv-api/supabase/verificar_planes.sql`, crear un plan en el ambiente de uso, agregar ejercicios, recargar, entrar como alumno, registrar peso y verificarlo nuevamente como profe. Las pruebas de navegador con API controlada y PostgreSQL embebido no reemplazan ese recorrido con Supabase. No se confirmó en esta conversación que las migraciones 29/30 ya estén aplicadas.

## Brechas que importan

| Capacidad | Estado de Aktiv | Próximo paso propuesto | Prioridad |
|---|---|---|---|
| Reutilizar entrenamiento | Catálogo de ejercicios; sesiones y planes se cargan manualmente | Duplicar sesión y plan; elegir destino e inicio | Alta |
| Seguimiento de sesiones | Peso por semana y notas generales | Completada/parcial/no realizada, fecha, esfuerzo y comentario | Alta |
| Planificación puntual | Misma estructura de días y ejercicios con distinta prescripción semanal | Excepciones por semana/fecha; reprogramar una sesión sin mover todas | Alta, confirmar metodología |
| Running estructurado | Prescripción libre permite escribir la indicación | Campos opcionales de distancia, duración, ritmo/zona y recuperación | Alta, definir campos con Lucas |
| Explicación del ejercicio | Catálogo con nombre/categoría | Enlace de video y breve descripción técnica | Media |
| Progreso | Mejores marcas y último peso por celda semanal | Historial de sesiones y evolución del peso/esfuerzo | Media, depende del registro |
| Pagos | Próximo vencimiento y acción de registrar pago | Cobros con fecha, importe, período y medio; luego recordatorios | Según necesidad administrativa |
| Comunicación | Notas generales del alumno/profe | Comentarios vinculados a una sesión; avisos de plan actualizado | Media |
| Integraciones | Sin sincronización deportiva | Strava/relojes si Lucas y los alumnos los usan | Posterior |

TrainerPlan publica reutilización de sesiones/planes y manejo de calendario, además de distinguir lo prescrito de lo realizado. Esa es la referencia principal para las primeras tres brechas. [Calendario de TrainerPlan](https://trainerplan.co/es/features/calendario/).

TrainerPlan también publica edición por pasos con objetivos de zona/potencia; es una referencia de estructura para running, no una definición de los campos que necesita Lucas. [Sesiones estructuradas](https://trainerplan.co/es/features/calendario/).

ABC Trainerize publica funciones de comunicación, gestión de clientes, hábitos y nutrición. Su integración de pagos incluye seguimiento y recordatorios: sirve para comparar administración, no para elegir automáticamente un proveedor de cobro para Aktiv. [Funciones de Trainerize](https://www.trainerize.com/features/), [gestión de pagos](https://www.trainerize.com/features/stripe-payments/).

TrainingPeaks publica planificación de resistencia y fuerza y sincronización con dispositivos. Es una referencia para una etapa de integración y análisis posterior. [Funciones para entrenadores](https://www.trainingpeaks.com/coach-features/).

## Orden propuesto de implementación

### 1. Duplicar sesión y plan

Es la mejora inmediata más clara: cargar “Fuerza A” una vez y reutilizarla. Primero duplicación; biblioteca de plantillas después.

- Duplicar una sesión dentro del mismo plan y elegir día/nombre.
- Duplicar un plan para el mismo alumno o asignar una copia a otro alumno propio, eligiendo inicio.
- Copiar calentamiento, ejercicios, grupos, descansos y prescripciones.
- Generar identificadores nuevos y conservar la independencia entre copia y original.
- No copiar pesos ni fechas registrados por el alumno.
- Crear el plan copiado como borrador, sin desactivar el plan actual.
- Ejecutar la copia de manera atómica, evitando dejar medio plan si falla.

Criterio de aceptación: duplicar un plan de seis semanas, comprobar todos sus ejercicios, modificar la copia sin alterar el original y verificar que no heredó pesos del alumno fuente.

### 2. Registrar la sesión realizada

Para cada alumno y ocurrencia de sesión: estado, fecha y comentario; opcionalmente esfuerzo percibido si Lucas lo usa. El profe puede ver qué se hizo y qué necesita revisar. Confirmar si “no realizada” se marca explícitamente o si simplemente queda sin registro; no inferir ausencias.

Los registros deben distinguirse de la plantilla para que editar un plan no reescriba el entrenamiento histórico. Antes de estadísticas, resolver esa identidad y la fecha de ejecución. No equiparar completar una sesión con asistir al entrenamiento presencial del club.

### 3. Ajustes puntuales y running

Preguntar si necesita cambiar un ejercicio, calentamiento o descanso solo en una semana. Actualmente cambiar el día o la lista de ejercicios afecta la estructura común del ciclo. Para reprogramar “el martes de semana 3” se necesita una excepción, no mover todos los martes.

Definir con Lucas cómo representa rodajes, intervalos, ritmo, zona y distancia. Mantener texto libre durante la transición y agregar solo campos que realmente use. Después se podrán calcular totales semanales de tiempo/distancia con datos consistentes.

## Para la reunión

Mostrar el recorrido principal e invitar a Lucas a cargar una sesión. Preguntar:

1. ¿Qué repetís más: ejercicios, sesiones, semanas o planes entre alumnos?
2. ¿Qué necesitás saber después de que alguien entrena?
3. ¿Qué modificás con mayor frecuencia a mitad de un ciclo?
4. ¿Cuáles son los datos indispensables de una sesión de running?
5. ¿El seguimiento de cobros te consume más tiempo que la planificación?
6. ¿Qué resolvería el sistema para que puedas dejar de usar la planilla como herramienta principal?

IA generativa, nutrición, chat completo, aplicaciones nativas y sincronización deportiva se evaluarán después de validar estas necesidades. Esta hoja de ruta no autoriza ni inicia automáticamente esas implementaciones.
