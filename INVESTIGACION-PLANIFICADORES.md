# Planificación flexible y referencias para la reunión con Lucas

Consulta de páginas oficiales: 2 de noviembre de 2026. Se revisaron las páginas públicas, descripciones de producto y el acceso público al creador de Entrenamientos.com. No se crearon cuentas ni se verificaron las funciones privadas de pago. Las descripciones de generación automática corresponden a lo que publica cada proveedor, no a una auditoría de su algoritmo.

## Por qué aparecieron 28 días

El SQL adjunto original fija semanas 1–4 y describe períodos de siete días desde `inicio`. De ahí salieron los 28 días del código anterior. Eso era una limitación del esquema compartido, no una regla de Lucas ni una equivalencia entre mes calendario y cuatro semanas. Fue incorrecto trasladarla a “Crear mes” como decisión de producto.

**Requisito aclarado:** Lucas debe elegir la duración de cada plan: cuatro, seis, ocho o más semanas. La planilla de ejemplo no determina todos sus planes. Cuatro queda únicamente como valor inicial editable.

## Qué aporta cada referencia

| Referencia | Qué publica | Aplicación propuesta para Aktiv |
|---|---|---|
| Entrenamientos.com | Creación, guardado, edición y distribución de programas; catálogo de ejercicios y posibilidad de cargar propios. El creador público carga una app embebida. | Priorizar armar rutinas rápido, guardar y reutilizar ejercicios/sesiones. No inferir una duración fija desde esta referencia. |
| Arvo | Generador guiado por objetivo, experiencia, frecuencia y equipamiento. Distingue el plan inicial estático de la adaptación posterior del producto. | Un formulario de contexto útil para Lucas; separar generación inicial de seguimiento. No incorporar automáticamente sus recomendaciones deportivas. |
| WorkoutGen | Perfil, objetivos, nivel, duración y días disponibles; muestra un ejemplo de ciclos de ocho semanas con sesiones. Distingue prescripción y registros de rendimiento. | Separar plan, semanas, sesiones y lo realizado por el alumno; permitir distintas duraciones. |
| TrainerPlan | Calendario, sesiones por pasos, copias de días/semanas, plantillas y planes por períodos. Muestra ejemplos de 8, 12 y 16 semanas y distingue plantillas con inicio individual de planes compartidos en fechas reales. | Es la referencia más próxima al trabajo de un profe con varios deportistas: reutilización, fechas y personalización por alumno. |

Fuentes para cada fila: [Entrenamientos.com](https://entrenamientos.com/) y su [creador](https://entrenamientos.com/entrenamiento/editar/nuevo/); [generador de Arvo](https://arvo.guru/es/tools/workout-generator); [WorkoutGen](https://workoutgen.app/es/); [calendario y planificación de TrainerPlan](https://trainerplan.co/es/features/calendario/).

## Cómo encaja la generación de planes

Hay dos funciones diferentes: ayudar al entrenador a componer un plan y generar automáticamente una propuesta desde datos del alumno. Aktiv ya tiene contexto del alumno y catálogo, pero no tiene un generador automático. Las referencias permiten estudiar su formulario y organización; no justifican introducir una IA que reemplace las decisiones de Lucas antes de conocer su método.

Para una primera evolución, la propuesta es: elegir alumno/objetivo → duración e inicio → distribución de sesiones → ejercicios por día → progresión semanal → revisión y activación. Después sumar duplicación de sesiones y plantillas independientes por alumno. Una eventual generación asistida debe entregar un borrador revisable por el profe.

## Corrección implementada

- La interfaz dice “Plan de entrenamiento”, “Nuevo plan” y “Crear plan”.
- Cantidad de semanas editable al crear y al modificar un plan. Se mantienen los planes anteriores con cuatro semanas.
- Las celdas se generan según la duración elegida. Al ampliar se crean semanas nuevas vacías que heredan las indicaciones previas; nunca se copian pesos.
- No se puede acortar si se perderían indicaciones explícitas, pesos o fechas de registro. Una reducción sin datos en las semanas quitadas elimina solo esas celdas vacías.
- Navegación en grupos de hasta cuatro semanas para el editor de escritorio; una semana visible en celular. Cuatro columnas es una decisión de presentación, no la duración del plan.
- El resumen de hoy calcula la semana con la duración real.
- El límite técnico de tamaño es 104 semanas, validado en base y contrato para acotar filas y respuestas. No es una recomendación ni una regla de Lucas; puede revisarse si aparece un caso real que necesite más.
- Los nombres físicos de tablas/endpoints anteriores se mantienen por compatibilidad; no representan un límite mensual en el producto.

Requiere la migración nueva `20261030000000_planes_duracion_variable.sql`, después de las migraciones 28 y 29. No se ejecutó SQL remoto.

## Preguntas para Lucas

### Revisión del flujo de carga (2 de noviembre)

Problema observado por Andrés: con un Día 1 cargado, “Agregar entrenamiento” no comunica cómo crear Día 2. La interfaz mezcla tipo, día y semana, y agrega un modal para confirmar un nombre que ya puede generar.

Referencias oficiales consultadas para este ajuste:

- [TrainerPlan: planes completos](https://help.trainerplan.co/es/masterclass/planes-completos-para-varios-deportistas): planes estáticos con semanas/días y acción de agregar situada en el día. [Calendario](https://trainerplan.co/es/features/calendario/): sesiones por pasos, plantillas y copias. No se probó una cuenta autenticada.
- [Trainerize: planilla de progresiones](https://help.trainerize.com/hc/en-us/articles/212130826-Progressing-Regressing-Workouts-with-the-Progressions-Spreadsheet): objetivos de ejercicios a lo largo de sesiones programadas; permite ajustar progresión manteniendo una estructura. Su planilla requiere programación previa; no atribuimos a Trainerize un calendario opcional.
- [TrueCoach: programas](https://help.truecoach.co/en/articles/3047401-programs): programas compuestos por entrenamientos, con semanas ampliables y biblioteca de entradas en calor/vuelta a la calma disponible en el editor.

Decisión propia para el método de Lucas: Plan → Fuerza/Running → Día 1, Día 2… → ejercicios y progresión semanal. “Crear Día N” junto a los días existentes; cuando está vacío, “Crear Día 1” dentro del estado vacío. Un clic crea un día vacío persistido y abre su editor, sin modal intermedio. No se crean tres días ficticios por defecto. La semana aparece después de seleccionar el día; indica explícitamente de qué día es la progresión. El calendario pasa a un desplegable opcional. El contenido mantiene autoguardado y protección del borrador.

Diseño: conservar los tokens existentes de Aktiv (fondo azul oscuro, superficie de tarjeta, texto claro, texto secundario y primario turquesa) y la tipografía actual. Alineación izquierda; tipo y días juntos, progresión debajo. La diferencia útil respecto de las referencias será reducir las acciones para reproducir la planilla de Lucas, conservando su herencia de celdas vacías. No se afirma superioridad sin medirlo con Lucas.

| Antes | Después | Por qué |
| --- | --- | --- |
| Agregar entrenamiento lejos de Día 1 | Crear Día 2 en la misma fila | Hace explícito el resultado |
| Modal para aceptar un nombre generado | Crear y editar directamente | Una acción menos |
| Semana antes del tipo/día | Tipo, día y luego progresión | Aclara qué se está editando |
| Tipo redundante y calendario en primer plano | Nombre y calendario opcional desplegable | Reduce campos en el recorrido principal |

Validar mañana: pedirle a Lucas que cree Fuerza Día 1, Día 2 y Running Día 1 sin explicarle los botones; observar si encuentra la acción, si distingue día de semana y si entiende “Guardado automáticamente”. Duplicación y plantillas siguen en sus pasos pendientes de la hoja de ruta.

1. **¿Siempre organizás el trabajo en bloques de cuatro semanas o la duración cambia? ¿Usás seis, ocho, doce o más según el alumno, la etapa o una carrera?**
2. ¿Elegís primero cantidad de semanas, una fecha de finalización o la fecha de una carrera? ¿Necesitás planes de días exactos, por ejemplo treinta, aunque la última semana quede incompleta?
3. ¿La semana va de lunes a domingo o cuenta siete días desde que empieza cada alumno? ¿Un plan puede empezar a mitad de semana?
4. ¿Fuerza y running siempre comparten inicio/duración o tienen ciclos independientes?
5. **¿Numerás por separado Fuerza Día 1/2/3 y Running Día 1/2/3? ¿Los días son fijos o el alumno elige cuándo hacer cada uno? En la foto aparece “LUNES” y también “DÍA 1”: ¿el lunes es obligatorio o solo una referencia?** Provisionalmente la UI separa por tipo y número, con calendario opcional.
6. ¿Se mantienen ejercicios y solo cambia la dosis, o también cambiás ejercicios, entrada en calor o descanso entre semanas?
7. ¿Armás todo el ciclo al principio o vas completando semanas según el progreso?
8. ¿Qué pasa si el alumno pierde una semana: se corre el calendario, repite o continúa?
9. ¿Querés una biblioteca de sesiones/planes para duplicar y ajustar? ¿Los cambios deben afectar solo a un alumno o a todos los que usan una plantilla?
10. ¿Qué debería registrar el alumno: peso, repeticiones reales, tiempo, distancia, esfuerzo, molestias y sesión completada?
11. ¿Qué parte de la carga querrías automatizar y qué parte necesitás decidir siempre vos?

Definición ya resuelta: celda vacía repite la última indicación anterior del ejercicio. No significa descanso ni ausencia de entrenamiento.
