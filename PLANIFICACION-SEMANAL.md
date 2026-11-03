# Planes por días y semanas

**Corrección de alcance:** los planes tienen duración configurable, no un mes fijo. Cuatro semanas era el límite del SQL original, no una regla de Lucas. Ver [investigación y preguntas para Lucas](INVESTIGACION-PLANIFICADORES.md) y [estado implementado](PLANES-MENSUALES.md). Requiere también la migración 30. El análisis histórico de abajo no prevalece sobre esta aclaración.

**Implementación actual:** ver [PLANES-MENSUALES.md](PLANES-MENSUALES.md). El contrato, endpoints, editor, vista del alumno y resumen mensual ya están implementados. Este documento conserva el análisis previo; los párrafos que describen tareas pendientes de código corresponden al diagnóstico anterior. Sigue pendiente aplicar la migración complementaria 29 y verificar contra Supabase local.

## Estado confirmado tras revisar el SQL adjunto

El usuario informa que ejecutó en Supabase una migración de planes mensuales. Se revisó el SQL adjunto; no se consultó la base remota para verificar su aplicación. Ese SQL no está en `aktiv-api/supabase/migrations`: la carpeta contiene nueve migraciones, del 19 al 27 de octubre, y termina en `20261027000000_plan_descanso.sql`.

La migración adjunta define:

- `planes_mensuales`: nombre, inicio obligatorio, orden y un único activo por alumno. El mes agrupa ambos tipos de entrenamiento; no hay un plan mensual activo independiente por tipo.
- `sesiones`: día 1–7 (lunes–domingo), tipo Running/Fuerza, nombre, orden, calentamiento y enfriamiento como texto libre. Permite varias sesiones por día.
- `sesion_ejercicios`: nombre, orden, descanso y grupo para superseries/circuitos.
- `ejercicio_semanas`: semanas 1–4, prescripción libre, peso y fecha del peso. Clave compuesta ejercicio/semana.
- Índices, borrado en cascada, RLS y un trigger que limita al alumno a modificar peso y fecha del peso.

**La implementación del repositorio todavía no usa estas tablas.** El contrato sigue exponiendo `alumno.planes`, `planSchema` y ejercicios con series/repeticiones; la carga de datos y los endpoints siguen usando `planes`/`plan_ejercicios`. El store, la sincronización, el editor, Mi plan y la previsualización de hoy también usan el modelo anterior. `contrato/src/sesion.ts` corresponde a autenticación/catálogo, no a sesiones de entrenamiento.

El SQL es aditivo: conserva las tablas viejas y no importa sus datos. Por eso la app actual puede continuar funcionando sin mostrar ningún plan mensual, aunque las tablas nuevas existan en Supabase. La presencia y el contenido real de esas tablas no se verificaron en esta revisión.

### Celdas vacías: regla aclarada por el usuario

Una celda vacía significa que se mantiene la prescripción anterior del ejercicio. Para la lectura: buscar hacia atrás la última prescripción no vacía, sin traer valores de semanas futuras. Ejemplo: `4×8 | vacío | 5×8 | vacío` se muestra como `4×8 | 4×8 | 5×8 | 5×8`. Si no hay ninguna indicación previa, mostrar “Sin indicación”; no inventar series. El peso registrado no se hereda entre semanas.

El SQL permite `prescripcion = ''`, pero no calcula esa herencia: falta implementarla en el contrato/dominio y en las vistas. El editor puede mostrar el valor heredado con una indicación “Igual a la anterior”, conservando el vacío original. Editar una semana previa puede cambiar las semanas siguientes que heredan de ella; las celdas con indicación explícita mantienen su valor.

### Trabajo pendiente para conectar el modelo existente

1. Incorporar al historial del repositorio el SQL exacto aplicado, con la versión correspondiente, y reconciliar el historial remoto antes de usar `db push`. No volver a ejecutar a ciegas: contiene `create table/function` sin protección para objetos existentes.
2. Agregar entidades y DTOs mensuales al contrato, filas/mapeo y carga de datos; endpoints de planes, sesiones, ejercicios y celdas semanales. El alumno solo modifica peso/fecha de una celda ya creada.
3. Definir creación de las cuatro filas semanales por ejercicio, ya que el SQL no las genera automáticamente, y resolver la prescripción heredada.
4. Sincronizar el contrato y adaptar store, diferencias REST, editor, vista del alumno y resumen de hoy. El día de la UI es 0–6 (lunes–domingo); el SQL usa 1–7.
5. Cubrir permisos, activación, grupos, herencia y peso independiente con tests; validar en base local y navegador. Mantener las tablas viejas hasta completar la transición.

Pendientes de comportamiento: el SQL define cuatro períodos de siete días desde `inicio`, no meses calendario. Falta decidir qué mostrar antes del inicio y después del día 28; no reiniciar el ciclo automáticamente. También faltan reglas de pausa y reprogramación.

**Las secciones siguientes son la propuesta inicial anterior a conocer este SQL. Quedan como antecedente de interfaz, no como especificación vigente del modelo. Prevalecen las definiciones de esta sección.**

## Lectura de la referencia de Lucas

La foto muestra el lunes/Día 1 de fuerza, una entrada en calor común con pasos de activación y movilidad, y una matriz: ejercicios en filas y semanas 1 a 4 en columnas. Se mantienen ejercicios y se modifican las indicaciones; por ejemplo, la fila ZUMO pasa de 4×8 a 5×8 y luego 3×8. Hay indicaciones con texto y tiempos, no solo repeticiones numéricas. Parte de la imagen no es legible: no se deben inventar valores para las celdas vacías o borrosas.

La foto no permite saber si el running usa exactamente la misma estructura o si toda entrada en calor se mantiene las cuatro semanas. El usuario aclaró que las celdas vacías mantienen la prescripción anterior.

## Cambio visual implementado

Estado y próximo pago pasan al encabezado, junto al nombre en pantallas amplias y debajo en pantallas chicas. El plan tiene una pestaña propia, al mismo nivel que Ficha médica, Marcas y Carreras. Resumen conserva distribución habitual de entrenamiento y apuntes privados. Los controles de estado y pago quedan accesibles desde cualquier pestaña.

## Modelo propuesto

**Plan de un tipo → días/sesiones → bloques → ejercicios → prescripción por semana.**

- Plan: nombre, tipo Running/Fuerza, fecha de inicio opcional, cantidad de semanas y activo. Cuatro semanas como valor inicial editable, sin fijarlo en la base.
- Día/sesión: nombre (Fuerza A, Rodaje, Series), orden y día de la semana opcional. Permitir running y fuerza el mismo día, así como descanso. No fijar tres sesiones por tipo: depende del alumno.
- Bloques: Entrada en calor, Entrenamiento, Vuelta a la calma. Los bloques actuales se conservan con nombres visibles ajustados. Activación y movilidad pueden ser dos ejercicios/pasos ordenados dentro de Entrada en calor; no necesitan convertirse en bloques nuevos.
- Ejercicio: identidad y orden compartidos a través de las semanas.
- Prescripción semanal: series, repeticiones/duración/distancia como texto, descanso, carga objetivo opcional e indicaciones. La carga que indica Lucas debe distinguirse del peso realmente registrado por el alumno.
- Las indicaciones explícitas de cada semana son independientes. Una celda vacía hereda la última indicación previa, según la aclaración del usuario.
- Diferenciar “sin indicación previa” de “descanso” y de “igual a la semana anterior”.

La distribución actual de siete booleanos no puede representar estas sesiones: conservarla inicialmente como disponibilidad habitual y evitar mantener dos agendas contradictorias cuando exista planificación concreta.

## Cómo lo editaría Lucas

1. En Plan, elegir Running o Fuerza y el plan.
2. Configurar duración y sesiones: por ejemplo Fuerza A/lunes, Fuerza B/miércoles y Fuerza C/viernes.
3. Seleccionar una sesión. Cargar la entrada en calor por pasos y los ejercicios principales una sola vez.
4. En escritorio, completar una tabla con Ejercicio | Semana 1 | Semana 2 | Semana 3 | Semana 4. Cada celda permite editar series, indicación y descanso sin comprimir todos los campos en una sola cadena.
5. Copiar una semana completa o una sesión para ajustar la progresión sin volver a cargar ejercicios. Las copias quedan independientes.
6. En celular, seleccionar una semana y ver sus ejercicios en tarjetas; evitar una matriz de cuatro columnas apretadas.

Primera versión: mantener la misma lista de ejercicios durante el ciclo. Si Lucas necesita variantes semanales, definir cómo agregar, omitir o reemplazar un ejercicio en una semana sin alterar las anteriores.

## Qué vería el alumno

Semana seleccionada, días con sus sesiones y detalle del día: entrada en calor, entrenamiento y vuelta a la calma. Mostrar la prescripción de esa semana, registrar peso usado y notas. La tabla comparativa de semanas puede quedar como vista secundaria; el recorrido principal debe permitir entender qué hacer hoy.

No calcular automáticamente la semana actual hasta definir inicio, pausas y reprogramaciones. Con inicio ausente se elige semana manualmente; un cambio de fecha no debe borrar registros.

## Implementación y compatibilidad

1. Ampliar contrato en la API, tablas de sesiones y prescripciones con claves únicas, permisos por rol, RLS y validaciones. Mantener el criterio de un plan activo por tipo.
2. Definir cómo importar planes actuales: migrarlos a una sesión llamada “Rutina general”, sin inventar días ni fechas. Los valores existentes pasan a semana 1. No replicarlos en otras semanas sin una acción explícita del profe.
3. Agregar endpoints, mapeo y tests; sincronizar contrato al cliente.
4. Extender store y sincronización para las entidades nuevas; agregar editor y lectura del alumno.
5. Validar persistencia, aislamiento entre alumnos, edición independiente de semanas, copia independiente y visualización en celular.

No se implementó este cambio de datos en el ajuste visual: requiere esa migración y validación completa, no alcanza con agregar un selector de semanas a la pantalla actual.

## Validaciones para la reunión

- ¿El ciclo suele ser de cuatro semanas? ¿Tiene fecha de inicio o avanza cuando el alumno termina?
- ¿Los días son lunes/miércoles/viernes fijos o Día 1/Día 2/Día 3 intercambiables?
- ¿La activación es común al ciclo, al tipo de entrenamiento o a cada día?
- Resuelto: una celda vacía mantiene la prescripción anterior del ejercicio.
- ¿El running se organiza con la misma matriz? Pedir una captura legible de esa pestaña.
- ¿Necesita ejercicios distintos en alguna semana o solo cambiar la dosis?
- ¿Qué registra el alumno y qué solo indica el profesor?
