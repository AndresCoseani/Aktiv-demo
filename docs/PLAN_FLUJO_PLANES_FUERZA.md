# Plan para mejorar la creación y asignación de planes de fuerza

**Estado:** decisiones aprobadas e implementación en curso. La migración nueva todavía debe aplicarse y verificarse en una base antes de desplegar.
**Alcance inicial:** modelos y planes de fuerza. Running queda fuera de este flujo hasta definir sus reglas particulares.

## Objetivo

Que el entrenador pueda crear una base reutilizable y, desde la ficha del alumno, convertirla en un plan propio: elegir los días de entrenamiento, decidir qué rutina va en cada día y adaptar la copia sin alterar el modelo ni otros alumnos.

La grilla semanal debe responder sin ambigüedad: **qué plan está siguiendo este alumno y qué rutina de ese plan le toca cada día**.

## Cómo funciona Aktiv hoy

Aktiv tiene tres niveles que la interfaz llama, en distintos lugares, “plan” o “día”:

1. **Modelo de Planes:** plantilla reutilizable, independiente de alumnos y fechas. Puede contener varias sesiones, semanas de prescripción y una distribución semanal.
2. **Plan del alumno:** copia con nombre, actividad, fecha de inicio, duración y estado (borrador/activo). Al asignar un modelo se copian todas sus sesiones; la distribución queda vacía para que el entrenador elija manualmente los días. Modelo y copia quedan independientes.
3. **Sesión o rutina:** por ejemplo, “Fuerza - Día 1”, con sus ejercicios, bloques y prescripciones. La grilla asigna una sesión a un día de la semana.

El flujo actual está dividido:

- En **Planes**, se crea y edita el modelo. Desde allí se puede asignar el modelo completo a un alumno, con fecha de inicio y nombre; se crea como borrador.
- En la ficha del alumno, **Nuevo plan** crea una planificación directamente para esa persona y **Asignar modelo** abre la biblioteca para copiar una base existente.
- La grilla de ese plan permite activar Fuerza en ciertos días, elegir una sesión para cada uno y crear sesiones nuevas. El chevrón junto al día solo copia una sesión de fuerza desde un modelo; no asigna el modelo completo.
- El encabezado nuevo de planificación unificada incluye un icono **Guardar como modelo** para guardar una copia del plan completo.
- Duplicar un modelo crea otro modelo. Duplicar un plan de alumno crea una copia para el alumno actual u otro, permite cambiar nombre y fecha, conserva duración y queda como borrador.

Un modelo, un plan asignado y un duplicado guardan copias independientes de sus datos. Borrar el plan de origen no borra un modelo creado desde él; borrar el modelo tampoco borra las copias ya asignadas. La acción “Guardar como modelo” vuelve a estar disponible como icono de marcador con más en las acciones del plan completo del alumno. El modal indica que guarda el plan entero, excluye pesos y seguimiento personal, y que la plantilla permanece si se elimina el original.

**Regla acordada para el flujo nuevo:** cada modelo y cada plan del alumno contiene una sola actividad. Un alumno puede tener un plan activo de Fuerza y otro de Running, pero solo uno activo por tipo. La implementación agrega el tipo al modelo y al plan, prepara una migración para separar los registros mixtos existentes, y activa mediante una operación atómica con confirmación explícita de reemplazo. La migración requiere revisión y ejecución en una base de prueba antes del despliegue.

Referencias de implementación: [biblioteca de Planes](../aktiv-client/src/app/%28app%29/planes/page.tsx), [encabezado y acciones de planes del alumno](../aktiv-client/src/components/plan-mensual.tsx), [copia de modelo a alumno](../aktiv-api/supabase/migrations/20261124000000_actividades_bloques.sql), [asignación de una sesión desde un modelo](../aktiv-client/src/components/asignar-dia-modelo.tsx), [distribución semanal](../aktiv-api/contrato/src/planificacion.ts).

## Qué pasa con un modelo de cuatro sesiones y un alumno que entrena dos días

La asignación del modelo copia sus cuatro sesiones. No elimina las dos que no se usan. La distribución copiada conserva las referencias a sesiones y crea identificadores independientes para el alumno.

Si luego la distribución del alumno deja Fuerza solo en dos días, las otras sesiones **no se asignan automáticamente** a esos días ni se borran: permanecen en el plan, pero sin aparecer en la grilla semanal mientras ningún día las referencie. Se pueden volver a elegir al agregar Fuerza en otro día y abrir su selector. La pantalla no presenta hoy una lista clara de “sesiones sin asignar”, así que el entrenador puede creer que se perdieron.

La regla acordada es: **nunca descartar ni reasignar sesiones en silencio**. El entrenador selecciona manualmente qué sesiones del modelo asigna a los días que entrena cada alumno. Si la frecuencia semanal difiere de la cantidad de sesiones del modelo, mostrar la diferencia antes de confirmar y dejar visible qué sesiones quedan programadas y cuáles disponibles sin asignar. No rotar sesiones automáticamente.

Ejemplo que la interfaz debería explicar:

| Modelo | Días que entrena el alumno | Resultado esperado |
| --- | --- | --- |
| Fuerza A, B, C y D | Lunes y miércoles | El entrenador elige qué dos sesiones van esos días. C y D quedan guardadas como sesiones disponibles, sin asignación semanal. |
| Fuerza A, B y C | Lunes, miércoles y viernes | Cada sesión queda asignada una vez a su día. |

Queda pendiente decidir si a futuro habrá un modo de rotación (por ejemplo A/B una semana y C/D la siguiente). No conviene inferirlo ni aplicarlo por defecto: es distinto de asignar sesiones fijas a días de la semana.

## Qué muestran las referencias de mercado

La evidencia pública más concreta de las tres referencias es Trainingym. Su documentación explica que una rutina guardada como plantilla puede asignarse desde el listado de plantillas o desde la ficha del socio; también permite guardar como plantilla una rutina del socio y duplicar programas. Es un patrón útil para Aktiv: mantener la biblioteca, pero permitir que el entrenador inicie el flujo desde el alumno y que pueda reutilizar un plan existente desde ambos lugares. Trainingym también documenta una confirmación cuando asignar reemplaza un plan activo.

Fuentes de Trainingym: [asignar un plan a clientes](https://help.trainingym.com/es/knowledge/asignar-rutina), [crear, editar y asignar rutinas](https://help.trainingym.com/es/knowledge/editor-rutinas), [crear, asignar y duplicar programas; guardar como plantilla desde el socio](https://help.trainingym.com/es/knowledge/programas-de-ejercicio).

ABC EVO presenta públicamente biblioteca/prescripción de entrenamientos y seguimiento del alumno, pero la página consultada no detalla los pasos de asignación, duplicación o conversión a plantilla. Mynter comunica entrenamiento y seguimiento para entrenadores, y muestra una rutina semanal en la app; su página pública tampoco describe con precisión el flujo de asignación de modelos. No tomo esos mensajes comerciales como prueba de que tengan un flujo específico.

Fuentes: [ABC EVO](https://softwareparagimnasio.com/software-para-gimnasios/), [Mynter](https://mynter.app/).

## Propuesta de flujo para fuerza

### Crear la base una vez

1. En **Planes**, crear un **Modelo de fuerza** con nombre, duración y sesiones (Día A, Día B, etc.).
2. Cargar ejercicios y prescripciones. La plantilla describe las sesiones disponibles; su distribución semanal es una propuesta inicial, no una obligación para cada alumno.
3. Mantener una acción clara para editar, duplicar, asignar y borrar el modelo.

### Asignar y adaptar desde la ficha del alumno

1. En el encabezado del plan del alumno, ofrecer **Asignar modelo** junto a **Crear plan**. Así se puede empezar desde el alumno sin navegar a Planes y volver a buscarlo. También debe poder iniciarse la asignación desde Planes; ambos puntos de entrada comparten el mismo flujo.
2. Abrir un modal con buscador, filtros de fuerza, vista previa del modelo y cantidad de sesiones disponibles.
3. Elegir fecha de inicio y duración propuesta. Crear una copia independiente en borrador; nunca cambiar el modelo original.
4. Mostrar los días semanales propuestos y preguntar qué días entrena este alumno. Para cada día, elegir manualmente la sesión correspondiente.
5. Si las cantidades no coinciden, mostrar un resumen explícito: “El modelo tiene 4 sesiones y elegiste 2 días. Elegí las 2 sesiones para esta semana; las otras 2 quedarán disponibles, sin asignar”. No borrar contenido y no cambiar la frecuencia por cuenta propia.
6. Permitir cambiar nombre, fecha de inicio y duración en este mismo modal. Mostrar el rango de fechas que resulta de la fecha y duración elegidas.
7. Confirmar y abrir el nuevo plan del alumno como borrador. Si el alumno ya tiene un plan activo del mismo tipo, ofrecer **Reemplazar plan activo**; confirmar debe desactivar el plan anterior y activar el nuevo en una operación atómica, conservando el contenido e historial del anterior. Si no se reemplaza, la copia queda como borrador.

El mismo selector puede abrirse desde **Planes → Asignar**, pero debe usar el mismo modal y las mismas reglas. Así se admiten los dos puntos de entrada que documenta Trainingym sin duplicar comportamiento.

### Guardar el trabajo del alumno como modelo

En la barra de acciones del **plan completo** del alumno, mostrar un icono de marcador con signo más (**BookmarkPlus**) para **Guardar como modelo**. Mantener accesibilidad con `aria-label` y ayuda `title`; no agregar un botón con texto que ocupe espacio. En la vista unificada, este es el lugar coherente porque nombre, fecha, duración, actividad y sesiones pertenecen al plan completo.

No ubicar “Guardar como modelo” dentro del modal de una rutina sin distinguir el alcance: guardar el plan completo y guardar solo una sesión son operaciones distintas. Si más adelante se quiere guardar una sola sesión, nombrarla como acción separada (“Guardar esta sesión como modelo”).

Al guardar el plan completo como modelo, copiar las sesiones y prescripciones, excluir pesos y seguimiento personal, y conservar una distribución semanal editable. El nombre del modelo se puede proponer desde el nombre del plan, con edición antes de guardar. El modal debe explicarlo en una o dos frases, incluyendo que el modelo es una copia independiente y permanece aunque se borre el plan original.

## Decisiones acordadas y trabajo pendiente

1. **Resuelto:** el modal de asignación ofrece los siete días y permite elegir una sesión diferente por día. Las sesiones restantes se muestran como disponibles; no hay rotación automática.
2. **Resuelto:** cada modelo y plan tiene una actividad. Se permite un plan activo por alumno y tipo; reemplazar deja el anterior como borrador y conserva su contenido e historial. El flujo actual ya tiene la confirmación en la activación; falta aplicar y probar la migración en una base.
3. **Resuelto:** “Guardar como modelo” guarda el plan completo; guardar una sesión individual queda fuera del alcance.
4. **Resuelto:** fecha de inicio y duración se editan durante la asignación; el modal muestra hasta qué fecha cubre el plan. La copia conserva todas las sesiones y las que no se eligen quedan sin asignar.

## Orden sugerido de trabajo

1. **Probar el flujo de asignación en UI:** probar las siete opciones de día, cambios de duración, sesiones restantes y los dos puntos de entrada.
2. **Validar Guardar como modelo:** la acción ya está en el encabezado del plan unificado; verificar que copie el plan completo y excluya datos personales.
4. **Hacer la copia atómica y rápida:** hoy copiar una sesión desde el chevrón crea la sesión y luego manda solicitudes separadas para ejercicios y prescripciones. Pasar la copia completa al servidor en una sola operación reducirá esperas y evitará estados parciales.
5. **Verificar en base de prueba:** separar modelos y planes mixtos existentes, preservar sesiones, distribución y datos de Running, y confirmar el índice único por alumno/tipo y la activación atómica.
6. **Probar los casos:** modelo 4/alumno 2, modelo 2/alumno 4, sesión sin asignar visible y recuperable, reordenar días, duplicar a otro alumno, guardar como modelo, reintentos y reemplazar el plan activo sin perder su historial.
7. Recién después definir si se reutiliza el patrón para Running; su planificación por día y semana necesita un análisis propio.

## Criterio de éxito

Un entrenador puede abrir un alumno, elegir un modelo de fuerza, asignar sus sesiones a los días que esa persona entrena, ver qué queda pendiente y activar la copia sin volver a la biblioteca ni temer que se haya perdido una rutina. El modelo original y los planes de otros alumnos permanecen intactos.
