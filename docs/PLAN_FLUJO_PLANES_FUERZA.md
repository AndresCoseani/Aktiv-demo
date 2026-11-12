# Plan para mejorar la creación y asignación de planes de fuerza

**Estado:** flujo implementado y documentación alineada. La migración incluida todavía debe aplicarse y verificarse en una base antes de desplegar.
**Alcance:** los planes y modelos ya tienen un solo tipo; Running conserva su editor semanal de texto, volumen y sugerencias.

## Objetivo

Que el entrenador pueda crear una base reutilizable y, desde la ficha del alumno, convertirla en un plan propio: elegir los días de entrenamiento, decidir qué rutina va en cada día y adaptar la copia sin alterar el modelo ni otros alumnos.

La grilla semanal debe responder sin ambigüedad: **qué plan está siguiendo este alumno y qué rutina de ese plan le toca cada día**.

## Cómo funciona Aktiv hoy

Aktiv tiene tres niveles que la interfaz llama, en distintos lugares, “plan” o “día”:

1. **Modelo de Planes:** plantilla reutilizable, independiente de alumnos y fechas. Puede contener varias sesiones, semanas de prescripción y una distribución semanal.
2. **Plan del alumno:** copia con nombre, actividad, fecha de inicio, duración y estado (borrador/activo). Al asignar un modelo, el entrenador elige en el mismo formulario qué sesión va en cada día. Las sesiones que no asigna quedan visibles como disponibles. Modelo y copia quedan independientes.
3. **Sesión o rutina:** por ejemplo, “Fuerza - Día 1”, con sus ejercicios, bloques y prescripciones. La grilla asigna una sesión a un día de la semana.

El flujo actual está dividido:

- En **Planes**, se crea y edita el modelo. Desde allí se puede asignar el modelo completo a un alumno, con fecha de inicio y nombre; se crea como borrador.
- En la ficha del alumno, **Nuevo plan** crea una planificación directamente para esa persona y **Asignar modelo** abre la biblioteca para copiar una base existente. También se puede iniciar la asignación desde **Planes**.
- La grilla de cada plan permite marcar días de entrenamiento o descanso, elegir la sesión para cada día y crear sesiones nuevas. Un día activo puede quedar temporalmente **Sin asignar**. El chevrón junto al día copia una sesión de fuerza desde un modelo; no asigna el modelo completo.
- El encabezado nuevo de planificación unificada incluye un icono **Guardar como modelo** para guardar una copia del plan completo.
- Duplicar un modelo crea otro modelo. Duplicar un plan de alumno crea una copia para el alumno actual u otro, permite cambiar nombre y fecha, conserva duración y queda como borrador.

Un modelo, un plan asignado y un duplicado guardan copias independientes de sus datos. Borrar el plan de origen no borra un modelo creado desde él; borrar el modelo tampoco borra las copias ya asignadas. La acción “Guardar como modelo” vuelve a estar disponible como icono de marcador con más en las acciones del plan completo del alumno. El modal indica que guarda el plan entero, excluye pesos y seguimiento personal, y que la plantilla permanece si se elimina el original.

**Regla acordada para el flujo nuevo:** cada modelo y cada plan del alumno contiene una sola actividad. Un alumno puede tener un plan activo de Fuerza y otro de Running, pero solo uno activo por tipo. La implementación agrega el tipo al modelo y al plan, prepara una migración para separar los registros mixtos existentes, y activa mediante una operación atómica con confirmación explícita de reemplazo. La migración requiere revisión y ejecución en una base de prueba antes del despliegue.

Referencias de implementación: [biblioteca de Planes](../aktiv-client/src/app/%28app%29/planes/page.tsx), [encabezado y acciones de planes del alumno](../aktiv-client/src/components/plan-mensual.tsx), [copia de modelo a alumno](../aktiv-api/src/modelos/modelos.module.ts), [migración de tipos y planes activos](../aktiv-api/supabase/migrations/20261125000000_planes_un_tipo_y_activos_por_tipo.sql), [asignación de una sesión desde un modelo](../aktiv-client/src/components/asignar-dia-modelo.tsx), [distribución semanal](../aktiv-api/contrato/src/planificacion.ts).

## Qué pasa con un modelo de cuatro sesiones y un alumno que entrena dos días

La asignación copia las cuatro sesiones con identificadores independientes y muestra los siete días en el formulario. El entrenador elige manualmente qué sesiones van en sus días de entrenamiento. Cada sesión puede elegirse una sola vez en ese formulario y Aktiv lista explícitamente las que quedan disponibles. No hay rotación automática.

Si el modelo tiene cuatro sesiones y el alumno entrena dos días, se asignan dos sesiones elegidas por el entrenador; las otras dos permanecen en la copia como sesiones disponibles, sin día. Si hay más días que sesiones, los días sin selección quedan **Sin asignar**. No se borra ni se asigna contenido en silencio.

Ejemplo que la interfaz debería explicar:

| Modelo | Días que entrena el alumno | Resultado esperado |
| --- | --- | --- |
| Fuerza A, B, C y D | Lunes y miércoles | El entrenador elige qué dos sesiones van esos días. C y D quedan guardadas como sesiones disponibles, sin asignación semanal. |
| Fuerza A, B y C | Lunes, miércoles y viernes | Cada sesión queda asignada una vez a su día. |

Una rotación entre semanas (por ejemplo A/B una semana y C/D la siguiente) queda fuera del comportamiento actual; las asignaciones se hacen manualmente.

## Qué muestran las referencias de mercado

La evidencia pública más concreta de las tres referencias es Trainingym. Su documentación explica que una rutina guardada como plantilla puede asignarse desde el listado de plantillas o desde la ficha del socio; también permite guardar como plantilla una rutina del socio y duplicar programas. Es un patrón útil para Aktiv: mantener la biblioteca, pero permitir que el entrenador inicie el flujo desde el alumno y que pueda reutilizar un plan existente desde ambos lugares. Trainingym también documenta una confirmación cuando asignar reemplaza un plan activo.

Fuentes de Trainingym: [asignar un plan a clientes](https://help.trainingym.com/es/knowledge/asignar-rutina), [crear, editar y asignar rutinas](https://help.trainingym.com/es/knowledge/editor-rutinas), [crear, asignar y duplicar programas; guardar como plantilla desde el socio](https://help.trainingym.com/es/knowledge/programas-de-ejercicio).

ABC EVO presenta públicamente biblioteca/prescripción de entrenamientos y seguimiento del alumno, pero la página consultada no detalla los pasos de asignación, duplicación o conversión a plantilla. Mynter comunica entrenamiento y seguimiento para entrenadores, y muestra una rutina semanal en la app; su página pública tampoco describe con precisión el flujo de asignación de modelos. No tomo esos mensajes comerciales como prueba de que tengan un flujo específico.

Fuentes: [ABC EVO](https://softwareparagimnasio.com/software-para-gimnasios/), [Mynter](https://mynter.app/).

## Flujo implementado para fuerza

### Crear la base una vez

1. En **Planes**, crear un modelo con nombre, tipo de actividad, duración y cantidad de sesiones (Día 1, Día 2, etc.).
2. Cargar ejercicios y prescripciones. La plantilla describe las sesiones disponibles; su distribución semanal es una propuesta inicial, no una obligación para cada alumno.
3. Mantener una acción clara para editar, duplicar, asignar y borrar el modelo.

### Asignar y adaptar desde la ficha del alumno

1. Desde **Planes → Asignar** o desde la ficha del alumno, buscar y elegir un modelo existente.
2. En el mismo modal indicar alumno, nombre de la copia, fecha de inicio y duración. El rango de fechas se actualiza con esos valores.
3. Elegir manualmente una sesión distinta para cada día de entrenamiento. Las sesiones no seleccionadas se listan como disponibles; las celdas vacías quedan sin asignar.
4. Confirmar **Asignar como borrador**. La copia no cambia el modelo ni otros planes.
5. Revisar y adaptar la distribución o las sesiones desde la ficha. Al activar, si ya hay un plan activo del mismo tipo, confirmar **Reemplazar plan** o **Cancelar**. Reemplazar deja el anterior como borrador y conserva sus sesiones e historial.

Los dos puntos de entrada usan las mismas reglas. La acción de guardar un plan de alumno como modelo está disponible como icono en la barra del plan completo.

### Guardar el trabajo del alumno como modelo

En la barra de acciones del **plan completo** del alumno, mostrar un icono de marcador con signo más (**BookmarkPlus**) para **Guardar como modelo**. Mantener accesibilidad con `aria-label` y ayuda `title`; no agregar un botón con texto que ocupe espacio. En la vista unificada, este es el lugar coherente porque nombre, fecha, duración, actividad y sesiones pertenecen al plan completo.

No ubicar “Guardar como modelo” dentro del modal de una rutina sin distinguir el alcance: guardar el plan completo y guardar solo una sesión son operaciones distintas. Si más adelante se quiere guardar una sola sesión, nombrarla como acción separada (“Guardar esta sesión como modelo”).

Al guardar el plan completo como modelo, se copian las sesiones, prescripciones y distribución semanal con identificadores propios; se excluyen pesos y seguimiento personal. El nombre se propone desde el plan y se puede editar antes de guardar. El modal explica que la plantilla es independiente y permanece aunque se borre el plan original.

## Decisiones acordadas e implementación

1. **Resuelto:** el modal de asignación ofrece los siete días y permite elegir una sesión diferente por día. Las sesiones restantes se muestran como disponibles; no hay rotación automática.
2. **Implementado:** cada modelo y plan tiene una actividad. Se permite un plan activo por alumno y tipo; reemplazar deja el anterior como borrador y conserva su contenido e historial. La activación requiere confirmación; falta aplicar y probar la migración en una base.
3. **Resuelto:** “Guardar como modelo” guarda el plan completo; guardar una sesión individual queda fuera del alcance.
4. **Resuelto:** fecha de inicio y duración se editan durante la asignación; el modal muestra hasta qué fecha cubre el plan. La copia conserva todas las sesiones y las que no se eligen quedan sin asignar.

## Pendientes operativos y límites conocidos

1. Aplicar la migración en una base de prueba y verificar cómo separa los registros mixtos existentes antes del despliegue.
2. Probar de punta a punta los dos puntos de asignación, los días sin asignar, la duración personalizada, la duplicación, Guardar como modelo y el reemplazo de un plan activo.
3. La copia de una sesión desde el chevrón todavía crea la sesión y luego envía solicitudes separadas por ejercicios y prescripciones. Una operación de servidor única reduciría la espera y evitaría estados parciales; no forma parte de la asignación completa del modelo.
4. La rotación automática de sesiones y la planificación de Running mediante sesiones de fuerza no forman parte del flujo: Running mantiene su plan de tipo propio con texto semanal.
La migración y los casos de extremo a extremo están pendientes de validación en una base de prueba. La implementación de la interfaz y sus contratos ya está incluida; todavía no se afirma que la migración se haya aplicado a una base.

## Criterio de éxito

Un entrenador puede abrir un alumno, elegir un modelo de fuerza, asignar sus sesiones a los días que esa persona entrena, ver qué queda pendiente y activar la copia sin volver a la biblioteca ni temer que se haya perdido una rutina. El modelo original y los planes de otros alumnos permanecen intactos.
