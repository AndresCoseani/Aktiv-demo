# Planes de entrenamiento: implementación

Entrada en calor combina texto libre (`calentamiento`, conservado) y ejercicios del catálogo (`activacion`, JSONB con id/nombre/indicación), máximo 20 filas y 300 caracteres de indicación. Migración 35 agrega columna y CHECK de forma/tamaños/IDs únicos; RLS de sesiones mantiene permisos. El contrato usa default [] solo al leer/crear, sin inyectarlo en PATCH de otros campos. No altera ejercicios principales ni sus semanas/pesos. UI permite ambas formas con autoguardado; alumno ve ambas. Prueba browser `--calentamiento` y SQL aislado.

Bloques: `sesiones.bloques` guarda IDs/orden de tarjetas incluso vacías (migración 33, después de 32). Crear bloque y Agregar ejercicio son acciones distintas; la segunda recibe el bloque destino. Los ejercicios conservan `grupo` y no se migran ni se eliminan. Las tarjetas vacías se ocultan en la lectura del alumno hasta tener contenido. El diagnóstico `verificar_planes.sql` incluye la 33.

Nuevo plan incluye tipos y días iniciales: Running/Fuerza/ambos, de 1 a 7 días por tipo elegido. `altaMensualApi.diasIniciales` es opcional para conservar compatibilidad con clientes anteriores; si se envía, la API usa `crear_plan_con_dias` (migración 32, posterior a 31) con token del usuario. La función es security invoker y respeta RLS; falla todo si no puede crear cualquiera de los días. No se envían días como si fueran ejercicios ni se asignan fechas ficticias. El tipo inicial visible se toma del primer día creado.

## Qué está conectado

- Duración configurable en semanas e inicio independiente del mes calendario. Un único plan activo por alumno agrupa Running y Fuerza. Cuatro semanas es solo el valor inicial, no una regla fija.
- Fuerza y Running organizados por Día 1, Día 2, etc. dentro de cada tipo. Calendario opcional: `dia=null` significa sin día fijo; 1=lunes, 7=domingo. Se conservan las asignaciones existentes.
- Entrada en calor y vuelta a la calma como texto libre por sesión.
- Ejercicios con grupo (superserie/circuito), descanso y una prescripción por semana del plan.
- Celda vacía: hereda la última prescripción no vacía anterior. Si no hay ninguna, “Sin indicación”. El peso no se hereda.
- Editor en la pestaña Plan: grupos de hasta cuatro columnas en escritorio, semana elegida en celular, confirmación de guardado y conservación del borrador ante errores. Crear, editar y eliminar sesiones y ejercicios; crear, renombrar, cambiar inicio/duración, activar y eliminar planes. Las bajas piden confirmación.
- El alumno consulta el plan activo y registra peso por ejercicio y semana. Los planes viejos siguen disponibles en “Planes anteriores”.
- La distribución semanal y el resumen de hoy usan las sesiones del plan activo cuando existe. Fuera del ciclo se muestra que aún no empezó o ya terminó, sin reiniciarlo.

El contenido de cada entrenamiento se guarda automáticamente tras 800 ms sin escribir, mediante PATCH serializados con confirmación del servidor. Se permite seguir escribiendo durante el pedido: el siguiente guardado envía los cambios posteriores. Si falla, conserva el borrador y ofrece reintentar. No pasa por el debounce del store anterior. Altas/bajas y el modal de metadatos del plan mantienen acciones explícitas. Los planes se cargan a demanda por alumno, con identidad ligada a la sesión, y se vuelven a consultar después de guardar o al volver a la pestaña.

Para crear entrenamientos sin día fijo se requiere `20261031000000_sesiones_dia_opcional.sql`, después de la 30. Diagnóstico previo de solo lectura: `aktiv-api/supabase/verificar_dias_entrenamiento.sql`. No se ejecutó SQL remoto. Confirmar con Lucas la numeración por tipo y si la referencia a lunes en su planilla es obligatoria o sugerida.

## Migraciones y despliegue

1. `aktiv-api/supabase/migrations/20261028000000_planes_mensuales.sql` es la copia exacta del SQL adjunto que el usuario informa haber ejecutado. Se eligió la versión 28 para continuar el historial local. **No volver a ejecutarlo sobre tablas ya creadas**. Antes de `db push`, comprobar y reconciliar su versión en el historial remoto.
2. **Nueva y necesaria:** `aktiv-api/supabase/migrations/20261029000000_celdas_semanales.sql`. Crea las cuatro celdas al insertar un ejercicio en la misma transacción y completa celdas que falten en ejercicios existentes, sin modificar sus prescripciones o pesos. Aplicar antes de usar el nuevo editor.
3. **Nueva y necesaria:** `aktiv-api/supabase/migrations/20261030000000_planes_duracion_variable.sql`, después de 28 y 29. Agrega duración por plan, amplía el rango de semanas y adapta los triggers. Los planes existentes conservan cuatro semanas. Ampliar agrega celdas sin modificar las existentes; acortar se rechaza si descartaría indicaciones o registros. El límite técnico es 104 semanas, no una duración deportiva recomendada.
4. Desplegar API y cliente juntos. No se ejecutó SQL contra Supabase remoto, no hubo commit ni push.

Los planes anteriores no se importan ni se borran automáticamente. Esto respeta la migración adjunta y evita inventar días o semanas para datos de prueba.

## Contrato y API

Contrato: `aktiv-api/contrato/src/mensual.ts`, sincronizado al cliente con `npm run contrato:sync`. Valida días, semanas, tamaños, pesos, fechas y DTOs estrictos. Contiene `prescripcionEfectiva` y `semanaDelPlan` con pruebas de herencia y límites del ciclo.

Módulo: `aktiv-api/src/mensuales/mensuales.module.ts`. Toda consulta usa el token del usuario; no usa service_role. La respuesta se valida con el contrato y pagina las tablas para evitar truncamiento de Supabase.

| Método | Ruta bajo /api | Permiso |
|---|---|---|
| GET / POST | `/alumnos/:id/planes-mensuales` | Lectura del propio alumno/profe; alta solo profe |
| PATCH / DELETE | `/planes-mensuales/:id` | Profe |
| POST | `/planes-mensuales/:id/sesiones` | Profe |
| PATCH / DELETE | `/sesiones/:id` | Profe |
| POST | `/sesiones/:id/ejercicios` | Profe |
| PATCH / DELETE | `/sesion-ejercicios/:id` | Profe |
| PATCH | `/sesion-ejercicios/:id/semanas/:semana` | Profe: prescripción, peso, fecha; alumno: solo peso/fecha propios |

RLS mantiene el aislamiento. Topes de API: 50 meses por alumno, 28 sesiones por mes, 100 ejercicios por sesión. Las celdas semanales no se crean ni borran desde el navegador.

## Verificación

- API: 23 tests unitarios; contrato: 25 tests. Incluyen mapeo, paginado, rechazo de recursos ajenos, permisos por campo, herencia, planes de seis/ocho/doce semanas y períodos de siete días.
- Cliente: 9 tests existentes, contrato sincronizado, tipos y build verificados; lint sin errores y con la advertencia preexistente de TanStack Table.
- `aktiv-client/scripts/mensual.browser.mjs`: smoke con Edge y API controlada; comprueba escritorio/celular, altas, guardado, error recuperable, recarga, herencia y peso independiente. No demuestra persistencia en Supabase.
- Con `--responsive`, el mismo script prueba planes vacíos y cargados con nombres/contactos largos en 320, 360, 375, 390, 430, 768, 1024 y 1440 px. Verifica ancho de página y límites de controles, y genera capturas. Las pestañas se distribuyen en dos filas en celular, y la navegación superior conserva cuenta/tema dentro del ancho. Verificado en navegador; pendiente revisión en dispositivo físico.
- `aktiv-api/scripts/probar-mensual-sql.mjs`: 26 verificaciones en PostgreSQL embebido sobre el SQL sin modificar, con Auth/base previa simulados. Comprueba migraciones, ampliación/reducción, protección de datos, creación de celdas, RLS, triggers, CHECK, activación y cascada. No reemplaza Supabase local.
- `test/mensuales.e2e-spec.ts`: siete pruebas de integración, incluido acceso directo a la base y ampliación a seis semanas. Se sumaron verificaciones a `scripts/probar-seguridad.mjs`.
- Los e2e completos y `test:db` se intentaron ejecutar, pero fallan en la preparación porque Supabase local no responde. No se consideran aprobados.

Playwright y PGlite se instalaron en una carpeta temporal, sin modificar dependencias del proyecto. Los scripts reciben `PLAYWRIGHT_MODULE` / `PGLITE_MODULE` para apuntar a esas instalaciones externas. Capturas en la carpeta temporal `aktiv-mensual-capturas`.

## Límites actuales

El guardado de una sesión puede realizar varios PATCH: cada pedido se confirma, pero el conjunto no es una transacción única. Ante un fallo, los cambios ya confirmados permanecen y el formulario conserva el borrador para reintentar. No presenta un fallo parcial como éxito.

La primera versión no duplica meses completos ni modela pausas o reprogramaciones. Editar una prescripción anterior cambia el valor efectivo de las semanas vacías posteriores; una celda con valor explícito no cambia. La opción de completar vacíos fija el valor anterior solo en la semana elegida, sin copiar pesos.

Investigación de referencias y preguntas actualizadas: [INVESTIGACION-PLANIFICADORES.md](INVESTIGACION-PLANIFICADORES.md). Falta confirmar con Lucas si quiere semanas calendario, fechas exactas o períodos independientes de running/fuerza. El nombre histórico de este archivo/tablas/endpoints no implica que un plan tenga duración mensual.
