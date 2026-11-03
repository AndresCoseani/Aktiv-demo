# Aktiv: paso a paso de implementación

Este es el checklist operativo. La comparación con otros productos queda en [HOJA-RUTA-AKTIV.md](HOJA-RUTA-AKTIV.md). Trabajamos sobre un paso por vez; el siguiente empieza cuando Andrés da el OK del paso anterior.

## Estado actual

**Paso activo: 2 — Andrés está probando el flujo real; se ajusta la edición según su devolución.**

Andrés compartió una captura del SQL Editor de Supabase con las cuatro comprobaciones en `true`. Se confirmó la presencia de los objetos consultados de las migraciones 28/29/30. Esto no comprueba todas sus definiciones, el historial de migraciones ni que la API apunte a ese mismo proyecto; el recorrido real se valida en el paso 2.

| Paso | Trabajo | Estado | Qué habilita el siguiente |
|---|---|---|---|
| 0 | Crear este checklist y repartir responsabilidades | Hecho | Pedido de comenzar recibido |
| 1 | Comprobar y alinear migraciones | Cerrado: diagnóstico correcto y continuación autorizada | Andrés eligió crear el plan y recorrer el flujo |
| 2 | Validar el recorrido completo profe/alumno | En curso: alta de plan confirmada; ajuste de edición implementado | Resto del recorrido persistido + OK de Andrés |
| 3 | Duplicar una sesión | Pendiente | Copia independiente comprobada + OK de Andrés |
| 4 | Duplicar/asignar un plan | Pendiente | Copia completa y sin pesos ajenos + OK de Andrés |
| 5 | Registrar sesiones realizadas | Pendiente | Comportamiento acordado, implementado y aprobado |
| 6 | Definir running y cambios puntuales | Pendiente de metodología de Lucas | Alcance acordado antes de implementarlo |
| 7 | Cerrar demo y entrega del MVP | Pendiente | Checklist final aprobado |

## Cómo trabajamos

- **Yo:** inspección, diseño concreto, contrato, migraciones, API, interfaz, pruebas y documentación. Resuelvo decisiones rutinarias dentro del paso autorizado.
- **Andrés:** acceso al proyecto Supabase/ambiente real, ejecución de SQL cuando corresponda, prueba con sus cuentas y aprobación del resultado visible. No necesita programar ni compartir claves o contraseñas.
- Al terminar cada paso dejo cambios, evidencia, límites y una acción breve para Andrés. Si falla algo, lo corregimos dentro del mismo paso.
- El OK habilita el paso siguiente, no un commit, push, despliegue ni cambios automáticos en Supabase real.
- No marcamos un paso como completo por tener solo el código escrito. Si una dependencia impide validarlo, queda indicado.

## Paso 1 — Comprobar migraciones

### Mi parte

- [x] Preparar [verificar_planes.sql](aktiv-api/supabase/verificar_planes.sql), de solo lectura y sin datos de alumnos.
- [x] Dejar las migraciones 28, 29 y 30 en el repositorio.
- [x] Agregar diagnóstico específico cuando falta la columna de duración.
- [x] Probar los cambios de esquema en PostgreSQL embebido; esa comprobación no demuestra el estado del proyecto real.
- [x] Interpretar el resultado compartido por Andrés: las cuatro comprobaciones son `true`.
- [x] No hay objetos faltantes entre los consultados. No se indica reejecutar las migraciones 28, 29 ni 30 con este resultado.

### Tu parte ahora

1. Abrí Supabase → SQL Editor del **mismo proyecto que usa la API**.
2. Pegá y ejecutá el contenido de [verificar_planes.sql](aktiv-api/supabase/verificar_planes.sql).
3. Compartí únicamente estos cuatro resultados, por texto o captura:

```text
tabla_planes_creada:
duracion_variable_migracion_30:
creacion_celdas_migracion_29:
ajuste_duracion_migracion_30:
```

No apliques migraciones a ciegas. Si algún resultado es `false`, revisamos ese caso. Las tablas iniciales corresponden a la 28, las celdas automáticas a la 29 y la duración configurable a la 30; algunas comprobaciones son parciales y no reemplazan revisar el archivo aplicado.

### Cierre

- [x] Objetos del esquema consultados presentes; compatibilidad funcional pendiente del paso 2.
- [x] Resultado registrado acá.
- [x] OK de Andrés para empezar el paso 2: indicó que crearía el plan para ver el flujo.

Resultado recibido: captura del usuario en el SQL Editor del proyecto Aktiv, 2 de noviembre de 2026:

```text
tabla_planes_creada: true
duracion_variable_migracion_30: true
creacion_celdas_migracion_29: true
ajuste_duracion_migracion_30: true
```

Si el alta sigue fallando, no atribuirlo automáticamente a migraciones pendientes: comprobar el nuevo código de error del servidor y que su configuración apunte al proyecto verificado. No compartir claves ni contraseñas.

## Paso 2 — Validar el recorrido real

Avance recibido: Andrés creó un plan y compartió capturas. Solicitó sustituir el desplegable de nombre/inicio/duración por un lápiz junto al tacho y un modal. Ajuste implementado y verificado en navegador: cancelar no guarda, los errores conservan el formulario y el guardado correcto cierra el modal. Las sesiones y ejercicios siguen en su editor. El resto de la prueba real del alumno y persistencia sigue pendiente; no se habilita aún el paso 3.

Segunda devolución: en un plan de cinco semanas se veían solo cuatro botones porque el selector paginaba. Corregido según el espacio disponible: las semanas van en una fila y aparecen flechas cuando no entran todas.

Tercera devolución: acercar la carga a la planilla de Lucas. Implementado Fuerza/Running → Día 1, Día 2, etc. → ejercicios con progresión semanal. El día calendario pasa a ser opcional (migración 31, pendiente de aplicar por Andrés). Se mantienen las asignaciones existentes. La edición de los contenidos se guarda automáticamente tras una pausa de 800 ms; conserva el borrador ante error, permite reintentar y evita salir con cambios pendientes. Altas y eliminaciones requieren su botón; los metadatos del plan mantienen el modal con Guardar cambios. No se avanzó al paso 3.

**Andrés:** ejecutar primero `aktiv-api/supabase/verificar_dias_entrenamiento.sql` (solo lectura). Si devuelve false, aplicar `20261031000000_sesiones_dia_opcional.sql` en SQL Editor y repetir el diagnóstico hasta true. No reejecutar las migraciones 28–30. Luego probar Fuerza Día 1, Día 2 y Running Día 1; editar una indicación, esperar “Guardado automáticamente” y recargar. Confirmar mañana con Lucas si la numeración es independiente por tipo y si los días calendario son fijos o los elige el alumno.

Cuarta devolución: simplificado el recorrido de creación. “Crear Día 2” aparece junto a Día 1; crea y abre el editor directamente, sin modal intermedio. Estado vacío con “Crear Día 1”. Orden visual: tipo → días → progresión semanal. Calendario opcional en desplegable. Investigación y evaluación en `INVESTIGACION-PLANIFICADORES.md`. Continúa el paso 2; no se implementó duplicación ni plantillas.

Quinta devolución: Nuevo plan pide nombre, duración, Running/Fuerza/ambos, cantidad de días de cada tipo seleccionado (1–7) y fecha de inicio en español. Al confirmar se crean plan y días en una sola transacción (RPC con permisos del usuario y RLS), sin ejercicios inventados. Los días quedan listos para editar; se pueden agregar más después. Requiere migración 32 `20261101000000_crear_plan_con_dias.sql`, después de la 31. El diagnóstico `supabase/verificar_dias_entrenamiento.sql` ahora verifica ambas. Andrés aplica únicamente las que devuelvan false, en orden. No se ejecutó SQL remoto.

Corrección de carga: calendario y entrenamiento de hoy esperan la consulta del plan antes de decidir si corresponde mostrar datos anteriores. Ante error no se muestra la distribución anterior como sustituto. Resumen comparte la consulta del perfil; Mi plan también espera antes de mostrar su semana. Regresión de navegador `mensual.browser.mjs --carga` simula demora y error/reintento.

Selector de tipos actualizado a desplegable con casillas independientes. Arranca sin selección; Lucas marca Running y/o Fuerza y aparecen sus cantidades de días. No hay opción combinada. Se requiere al menos un tipo para crear el plan. Opciones y campos salen de una configuración común de UI; nuevos tipos siguen requiriendo ampliar contrato y base (no es una biblioteca de tipos configurables todavía). No requiere otra migración.

Bloques visuales de ejercicios: reemplazado el número editable de grupo por tarjetas que indican ejercicio individual o ejercicios juntos. Arrastre con manija entre tarjetas en escritorio y selector “Mover a” para teclado/celular; permite separar a bloque individual. Se conservan los grupos existentes. Agregar ejercicio está debajo de la lista y crea un bloque individual disponible (máximo existente: 20). Descanso al final de la fila de semanas en escritorio; campos apilados en pantallas chicas. El alumno ve los mismos bloques. Autoguardado usa el campo grupo existente; no requiere migración. Prueba `mensual.browser.mjs --bloques` cubre arrastre, separación, guardado/recarga y posiciones.

Corrección de orden/rendimiento: los bloques siguen el orden de los ejercicios, no el número interno de grupo, por lo que reutilizar un número libre no inserta la tarjeta arriba. Agregar ejercicio muestra la tarjeta inmediatamente al final y permite escribir mientras se confirma el POST. Se serializa con el autoguardado, conserva borrador/alta pendiente ante error y reintenta sin perder lo escrito. No requiere guardar todo antes ni recargar el plan para mostrar la tarjeta. Se conserva la instancia del formulario al actualizar los ejercicios; las bajas confirmadas actualizan el estado local. Andrés confirmó mantener autoguardado. Prueba `--alta`: demora, fallo/reintento, huecos en números de grupo, recarga, eliminación y alta durante guardado.

Flujo final de bloques: “Crear bloque” agrega una tarjeta vacía al final; cada tarjeta tiene “Agregar ejercicio” para añadir a ese mismo bloque, sin generar otro. Bloques vacíos se pueden eliminar y se guardan junto con su orden mediante `sesiones.bloques` (migración 33). Los grupos existentes se conservan y se incorporan en su orden de ejercicios. Se mantiene arrastre y selector para mover entre tarjetas. `--bloques-vacios` verifica recarga de tarjetas vacías, dos ejercicios en un mismo bloque y eliminación del vacío. Andrés: aplicar `20261102000000_bloques_sesion.sql` después de 32; `verificar_planes.sql` incluye la columna de diagnóstico 33. No se ejecutó SQL remoto.

Columnas semanales adaptables: eliminado el límite fijo de cuatro. Se mide el ancho real del editor y se reserva espacio legible para ejercicio, semanas, descanso y acciones; se muestran tantas semanas como entren. Si no entran todas, el selector superior lleva al tramo correspondiente. En celular se edita una por vez, con indicación de semana/total. Prueba `--semanas`: cinco semanas visibles en escritorio, cambio de ancho y edición de semana 12.

Normalización de nombres: clave compartida en contrato (`claveEjercicio`) que ignora mayúsculas, marcas diacríticas y separadores de espacio/guion/underscore. Nombre visible sigue siendo texto legible, no un slug; al crear/renombrar se recortan y unifican espacios/underscores. Catálogo combinado deduplica opciones equivalentes y la búsqueda usa la misma clave. Store evita nuevas variantes; API revisa paginadamente nombres del mismo profe antes de crear/renombrar. No se fusionaron ni eliminaron registros existentes ni se agregó un índice único normalizado: el índice anterior sigue protegiendo case-insensitive, y altas equivalentes simultáneas por SQL/direct API requerirían reforzar la base tras resolver duplicados existentes. No se corrigen automáticamente errores de escritura ni sinónimos. Prueba `--catalogo`, tests de dominio y API. No requiere migración para estos cambios.

Reemplazo de catálogo solicitado para la demo: migración 34 `20261103000000_catalogo_lucas_demo.sql`, destructiva y pendiente de ejecución por Andrés. Borra TODO `ejercicios_custom` y crea 11 opciones de la foto por profesor existente (7 principales y 4 de activación). Cancela si no hay profesores; se ejecuta en transacción. No toca ejercicios ya asignados a planes, prescripciones ni pesos. Frontend deja de incluir sugerencias fijas del código: solo usa el catálogo de la base y conserva el nombre ya elegido en cada plan. Por eso eliminar del catálogo no borra nombres históricos de planes. No se ejecutó SQL remoto. Test SQL aislado comprueba 11 por profesor y conservación íntegra de las filas del plan.

Andrés informó aplicada la 34: captura muestra 11 ejercicios para su profesor.

Entrada en calor mixta: conserva `calentamiento` como texto libre opcional y suma `activacion` (lista de hasta 20 ejercicios con UUID, nombre e indicación). Se eligen del catálogo, por defecto filtrado a Movilidad; desmarcar el filtro permite otras categorías. No es necesario repetir nombres dentro del texto. Se guarda automáticamente junto con las indicaciones y se lee igual para el alumno. Los ejercicios del calentamiento no tienen pesos ni celdas semanales; son comunes a las semanas del día. Requiere migración 35 `20261104000000_activacion_sesion.sql`, pendiente por Andrés; no borra texto previo. Diagnóstico de planes actualizado. Prueba `--calentamiento`: texto + catálogo, dosis, fallo/reintento, categorías, quitar, recarga y alumno. Continúa paso 2; no se generó un plan completo inventando los días que faltan de la foto.

Ajuste visual: ejercicios de entrada en calor y Agregar ejercicio van antes de las indicaciones generales. Selector de días usa tarjetas con estética del resumen (icono por tipo, cantidad de ejercicios, selección resaltada y tarjeta Crear Día N). Andrés confirmó conservar Día 1/Día 2…, sin volver a lunes/domingo ni asignar fechas. Tarjetas responsive, accesibles como botones; no cambió el modelo ni requiere otra migración.

Decisión posterior para la reunión: retirar las tarjetas/gráfico del editor Plan y usar un selector simple Día 1/Día 2… hasta hablar con Lucas. El gráfico semanal queda en Resumen del detalle; no se muestra en Mi plan. Cuando el plan contiene días sin asignación se indica “Sin asignar”, no descanso. El funcionamiento definitivo del calendario queda pendiente de la reunión.

Andrés autorizó subir todos los cambios al repositorio para activar el deploy. Preguntas preparadas en `PREGUNTAS-LUCAS-2026-11-03.md`, enlazadas desde README. Render tiene autoDeploy de main; no ejecuta migraciones SQL en build/start. Antes de la demo Andrés debe confirmar `verificar_planes.sql` en el proyecto remoto (especialmente 33 y 35). La 34 fue aplicada según su captura y no se debe reejecutar. No se ejecutó SQL remoto desde el agente.

Revisión de publicación: la 34 permite instalar el esquema en una base nueva sin profesores (no inserta filas), en lugar de cancelar un reset local. No se reejecutó en remoto ni se cambia el catálogo ya cargado por Andrés. Se mantiene el carácter destructivo si se ejecuta sobre un catálogo existente.

### Mi parte

- Revisar los fallos y corregirlos con pruebas dirigidas.
- Mantener API/cliente coherentes y el contrato sincronizado.
- Registrar qué se verificó contra Supabase y qué solo se probó de forma aislada.
- Si se usa el entorno local de pruebas, usar API 4100 y frontend 3101; no intervenir en los procesos del usuario en 3000/4000.

### Tu parte

Con un alumno de prueba, una vez aprobado el paso 1:

1. Como profe, crear un plan de seis semanas con dos sesiones y un ejercicio por sesión.
2. Cargar una indicación en semana 1 y otra en semana 3; dejar las otras vacías.
3. Guardar, recargar y comprobar la duración, sesiones e indicaciones.
4. Entrar como alumno, consultar la semana 2 y comprobar que hereda la indicación de la 1.
5. Registrar peso en semana 2, recargar y comprobar que no se copió a otras semanas.
6. Volver como profe y verificar ese registro.
7. Probar también cargar una marca y un certificado ficticio; recargar y volver a abrirlos.
8. Revisar la pantalla en tu teléfono real.

### Cierre

- [ ] Recorrido completo persistido en el ambiente de uso.
- [ ] Sin errores pendientes que bloqueen la demo.
- [ ] OK de Andrés para empezar el paso 3.

## Paso 3 — Duplicar una sesión

### Mi parte

- Agregar “Duplicar sesión”: nombre y día de destino dentro del mismo plan.
- Copiar tipo, calentamiento, vuelta a la calma, ejercicios, grupos, descansos y prescripciones.
- Crear identificadores nuevos y dejar vacíos pesos/fechas registrados.
- Hacer la copia en una transacción: si falla, no queda una sesión parcial.
- Respetar autorización del profe, RLS, validación y topes existentes.
- Verificar independencia entre original/copia, ausencia de pesos copiados, permisos y fallo con rollback.
- Probar el flujo en escritorio y celular.

### Tu parte

- Duplicar una sesión, comprobar su contenido y modificar la copia.
- Confirmar que el original sigue igual y que no se copiaron pesos.

### Cierre

- [ ] Implementación y pruebas terminadas.
- [ ] Recarga y revisión visible correctas.
- [ ] OK de Andrés para empezar el paso 4.

## Paso 4 — Duplicar o asignar un plan

### Mi parte

- Elegir nombre, inicio y alumno de destino: el mismo alumno u otro del mismo profe.
- Conservar duración, sesiones y prescripciones; generar identificadores nuevos.
- No copiar registros del alumno fuente.
- Crear la copia como borrador, sin cambiar el plan activo del destino.
- Reutilizar la lógica de copia transaccional donde corresponda, sin duplicar reglas.
- Probar aislamiento, independencia, rollback y asignación a un alumno propio.

### Tu parte

- Copiar un plan de seis semanas al mismo alumno y luego a otro alumno de prueba.
- Revisar sesiones, indicaciones, inicio, ausencia de pesos y activación manual.

### Cierre

- [ ] Copias completas e independientes.
- [ ] OK de Andrés para empezar el paso 5.

## Paso 5 — Registrar lo realizado

Antes de escribir código, acordar si el alumno necesita registrar completada/parcial, fecha, comentario y esfuerzo. No asumir ausencias ni confundir sesión realizada con asistencia presencial.

### Mi parte

- Preparar una propuesta breve y revisable del comportamiento y los datos.
- Conservar los registros históricos aunque luego se edite el plan.
- Implementar el alcance acordado con contrato, permisos y pruebas.
- Mostrar al profe un resumen de los registros, sin ampliar innecesariamente el dashboard.

### Tu parte

- Confirmar con Lucas qué datos necesita y qué ocurre si se repite o reprograma una sesión.
- Dar OK a la propuesta antes de que implemente esas reglas.
- Probar el registro desde el alumno y su lectura como profe.

### Cierre

- [ ] Reglas acordadas y recorrido verificado.
- [ ] OK de Andrés para empezar el paso 6.

## Paso 6 — Running y cambios puntuales

### Tu parte con Lucas

- Confirmar duración habitual, semanas calendario o desde inicio y ciclos compartidos o independientes de fuerza/running.
- Conseguir un ejemplo legible de running.
- Definir qué necesita como campos: distancia, duración, ritmo, zona, recuperación.
- Aclarar si cambian ejercicios/calentamiento/descansos solo en una semana, y cómo se reprograma un día puntual.

### Mi parte

- Convertir esas respuestas en un alcance pequeño, con ejemplos antes/después.
- Presentarlo para tu OK antes de implementarlo.
- Mantener texto libre y compatibilidad cuando los campos nuevos sean opcionales.
- Separar una modificación puntual de los cambios a la estructura del ciclo.

### Cierre

- [ ] Metodología documentada, implementación acordada y validada.
- [ ] OK de Andrés para empezar el paso 7.

## Paso 7 — Cerrar demo y entrega

### Mi parte

- Ejecutar los chequeos correspondientes al alcance final: tipos, tests, contrato, builds e integración disponible.
- Revisar escritorio/celular, estados vacíos y errores recuperables.
- Dejar instrucciones de migración y despliegue concretas y una lista honesta de limitaciones.
- Preparar un guion corto con un alumno de prueba.

### Tu parte

- Confirmar las URL y cuentas que se usarán en la reunión.
- Ejecutar los cambios del ambiente real que queden pendientes y que hayamos revisado.
- Hacer el ensayo completo desde tu equipo y teléfono.
- Dar autorización específica si querés commit, push o despliegue.

## Criterios de código para todos los pasos

- Contrato primero en la API; sincronización al cliente, sin editar su copia.
- Controladores finos; reglas de negocio en servicios acotados; persistencia y transacciones con responsabilidades claras.
- Funciones puras para cálculos y transformaciones que no necesitan red.
- Reutilizar reglas existentes. Introducir interfaces/abstracciones cuando haya una necesidad real; SOLID no implica agregar capas vacías.
- Validación, autorización y RLS coherentes; no usar service_role para evitar permisos.
- Cambios pequeños y revisables; pruebas de comportamiento, permisos, persistencia y fallos relevantes.
- Evitar migraciones destructivas o pérdida de registros y conservar compatibilidad durante la transición.

## Registro de aprobaciones

| Paso | Evidencia | OK de Andrés |
|---|---|---|
| 0 | Checklist creado a pedido del usuario | Pedido inicial recibido |
| 1 | Captura del SQL Editor: cuatro resultados `true`, registrada el 02/11/2026 | Andrés indicó que crearía el plan y probaría el flujo |
| 2 | Alta de plan confirmada por capturas; edición por modal ajustada | Pendiente de finalizar el recorrido y aprobar el paso 3 |

Actualizar este archivo al avanzar. No interpretar silencio como aprobación.
