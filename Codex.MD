# Aktiv — contexto único del proyecto

Actualizado el 3 de noviembre de 2026. Este documento reúne el contexto, las decisiones vigentes, la operación y los pendientes del proyecto. Reemplaza los README, CLAUDE, informes y hojas de ruta anteriores; se eliminaron repeticiones y propuestas superadas. Las preguntas para Lucas se conservan aparte en [PREGUNTAS-LUCAS-2026-11-03.md](PREGUNTAS-LUCAS-2026-11-03.md).

## 1. Producto y acuerdos vigentes

Aktiv es el sistema del club de running y entrenamiento integral de Lucas. Andrés desarrolla el producto. El profesor administra alumnos, planes, vencimientos de cuotas, fichas médicas, certificados, marcas, carreras y clases. El alumno consulta qué le toca y completa sus propios datos. Interfaz simple, minimalista, legible y usable en celular por personas de distintas edades; español rioplatense y voseo.

Decisiones confirmadas después de hablar con Lucas:

- Acceso con **email + DNI como contraseña inicial**, cambio de clave opcional desde Cuenta y sesión recordada. No hay un segundo acceso por DNI ni registro público.
- Cada entrenamiento mantiene su numeración dentro de Fuerza o Running y puede asignarse a un día semanal. Se admiten varias sesiones del mismo o distinto tipo en un mismo día. No se acordaron horas ni «Momento del día» para los planes: se retiraron esos controles.
- La duración se elige en semanas: cuatro es el valor inicial, no un mes obligatorio. El límite técnico actual es 104 semanas, no una regla deportiva.
- Celda semanal vacía = repetir la última prescripción anterior del ejercicio. Sin ninguna anterior, mostrar «Sin indicación». Nunca heredar pesos.
- Google Forms recoge datos de alta de alumnos; no reserva clases. Se importa un CSV revisado, sin sincronización automática con Google.
- Clases es una agenda simple de horarios recurrentes y confirmaciones por fecha, sin cupos ni aprobación. Confirmar significa intención de ir, no asistencia efectiva.

## 2. Reglas de trabajo

- Leer este archivo al retomar trabajo. Las solicitudes actuales de Andrés prevalecen sobre propuestas históricas. Mantener aquí el contexto, sin crear otro documento por cada ajuste.
- No hacer commit, push, despliegue ni operaciones sobre Supabase real sin autorización de Andrés. Preparar SQL no equivale a ejecutarlo. No inferir aprobación del silencio.
- **Los puertos 3000 y 4000 son del usuario:** no detener sus procesos ni usarlos para servidores o pruebas del agente. Usar frontend 3101 y API 4100; apagar únicamente los procesos propios al terminar.
- Secretos solo en `.env*` ignorados por Git; versionar únicamente ejemplos con placeholders. No inventar cuentas, emails ni credenciales reales.
- Código simple y eficaz, SOLID sin capas vacías: controladores finos, servicios acotados, funciones puras para cálculos y transformaciones, reutilización de reglas.
- Cambios de datos empiezan en API: contrato, DTO, migración y restricciones, filas/mapeo, permisos y pruebas. Después sincronizar contrato y adaptar frontend, incluido el motor de diferencias.
- No editar `aktiv-client/src/contrato/*.ts` a mano. Fuente: `aktiv-api/contrato/src`; sincronizar desde el cliente con `npm.cmd run contrato:sync` y verificar con `npm.cmd run contrato:check`.
- No usar `service_role` para evitar permisos. Uso acotado a cuentas/invitaciones, tras comprobar propiedad del alumno. Las demás consultas usan el token del usuario y RLS.
- No modificar componentes generados `src/components/ui/*` salvo necesidad concreta; para añadirlos, usar el CLI de shadcn. Mantener el dashboard del profesor simple.
- Patrón de edición: lápiz junto al tacho en el encabezado de la entidad; abre modal con sus datos generales, Cancelar y Guardar cambios. Cancelar no modifica datos y un error conserva el formulario. No usar desplegables de edición ni formularios permanentes en la tarjeta. El contenido del entrenamiento (ejercicios e indicaciones) mantiene su editor con autoguardado. En sesiones, nombre y día semanal se editan juntos en ese modal.
- Antes de escribir código de Next, leer la guía pertinente instalada en `aktiv-client/node_modules/next/dist/docs/`: esta versión tiene diferencias respecto de versiones anteriores.
- Next puede regenerar automáticamente `aktiv-client/AGENTS.md` al arrancar desarrollo. Su regla relevante está incorporada arriba; no mantener allí otra copia del contexto. Este archivo no presupone que todos los agentes lo carguen automáticamente: indicarlo al iniciar una sesión nueva si fuera necesario.

## 3. Arquitectura y carpetas

`Navegador → aktiv-client (Next) → /api/* por rewrite → aktiv-api (NestJS) → Supabase (Postgres, Auth, Storage)`.

| Parte | Tecnología / responsabilidad |
| --- | --- |
| `aktiv-api/` | NestJS 11, Express 5, supabase-js, cookies, Helmet, throttling; despliegue Render |
| `aktiv-api/contrato/src/` | Fuente Zod 4: entidades, DTOs estrictos, límites, tipos y reglas compartidas |
| `aktiv-api/supabase/migrations/` | Único historial del esquema, RLS, funciones y triggers |
| `aktiv-client/` | Next 16.4.2 App Router, React 19, Tailwind 4; despliegue Vercel |
| UI | shadcn `base-nova` sobre Base UI; TanStack React Table v8; Sonner |
| Pruebas | Jest/supertest API; Vitest contrato/frontend; scripts de navegador y PostgreSQL embebido |

El navegador habla solo con su origen y no tiene claves de Supabase. `API_URL` configura el rewrite de Next al compilar. Tokens en cookies httpOnly; no almacenar contraseñas en el navegador. No existe modo demo ni datos ficticios incorporados a la app.

Rutas de código importantes:

- API: `src/auth`, `src/common`, `src/datos`, `src/alumnos`, `src/mensuales`, `src/agenda`, `src/cuentas`, `src/invitaciones`, `src/certificados`, `src/carreras`.
- Frontend: `src/components/plan-mensual.tsx`, `src/lib/mensual.ts`, `src/lib/store.ts`, `src/lib/remoto.ts`, `src/lib/api.ts`, `src/lib/importar-alumnos.ts`, `src/app/(app)/agenda/`.
- `store.ts` y `remoto.ts` mantienen datos generales con sincronización por diferencias. Los planes por semanas y Clases tienen consultas propias; no meterlos en ese motor.

## 4. Acceso y alta de alumnos

El DNI se guarda como texto, sin puntos, espacios ni guiones, con 7 u 8 dígitos y conservando ceros iniciales. Puede estar vacío en alumnos anteriores; es único cuando no está vacío dentro del mismo profesor.

Flujo: crear/importar alumno → completar DNI y email → Preparar acceso en su ficha → entregar email y DNI inicial → alumno inicia sesión. Editar DNI o importar **no cambia contraseñas**. Una cuenta existente exige restablecimiento explícito con `{restablecer:true}`; nunca resetearla al abrir la ficha. La preparación de acceso espera la confirmación del guardado de DNI/email: si falla, no continúa con la cuenta.

La sesión tiene renovación con cookie httpOnly de 30 días, sujeta a la vigencia configurada en Supabase. En dispositivos compartidos se debe cerrar sesión. El cambio de contraseña pide la actual; es opcional. La política real de contraseñas puede rechazar un DNI: la API lo informa, no modifica esa política automáticamente.

La invitación por email sigue disponible como alternativa, desmarcada por defecto al crear alumno. Requiere Resend; enlace de un uso con hash SHA-256, vencimiento y límite por alumno. En desarrollo sin correo configurado se imprime el enlace en consola; en producción se informa la configuración faltante. Eliminar un alumno también gestiona su cuenta y archivos.

Importación: Forms pide nombre, apellido, DNI, email y teléfono, nunca contraseña. Exportar respuestas de Sheets a CSV. En Alumnos elegir archivo, mapear columnas, revisar vista previa/duplicados y excluir filas antes de confirmar. Admite coma/punto y coma, BOM, comillas y saltos; archivo hasta 1 MB y lotes hasta 200 alumnos. Cada fila requiere DNI o email; para habilitar acceso hace falta email. RPC atómica: un fallo revierte el lote, sin crear cuentas. JSON hasta 512 KB solo en esta ruta; el resto conserva 100 KB.

## 5. Planes de entrenamiento

Modelo vigente: **plan del alumno → sesiones numeradas por tipo → entrada en calor / bloques de ejercicios / vuelta a la calma → prescripciones y peso por semana**. Un único plan activo por alumno agrupa Fuerza y Running. Los nombres físicos `planes_mensuales` y endpoints equivalentes se conservan por compatibilidad; no implican meses fijos.

Nuevo plan: nombre, duración, tipos en desplegable con casillas independientes, cantidad de días por tipo seleccionado (1–7) e inicio. `diasIniciales` crea plan y días en una sola transacción con permisos del usuario. Después se puede Crear Día N. `sesiones.dia` admite null para anteriores sin asignar; 1=lunes y 7=domingo. No inventar asignaciones.

La semana del ciclo cuenta períodos de siete días desde inicio. No reinicia automáticamente al terminar; se informa si aún no empezó o ya terminó. Confirmar con Lucas si necesita semanas calendario o ciclos separados antes de cambiar esta regla.

- Metadatos se editan con lápiz junto al tacho y modal. Las bajas piden confirmación.
- Crear bloque agrega una tarjeta vacía **al final**. Dentro, Agregar ejercicio lo incorpora a ese bloque. `sesiones.bloques` conserva tarjetas vacías y orden; `grupo` relaciona ejercicios que se hacen juntos. Máximo 20 bloques. El alumno no ve tarjetas vacías.
- Ejercicios se arrastran entre tarjetas; «Mover a» sirve también para teclado y celular. Descanso va al final de la fila en escritorio.
- Entrada en calor combina ejercicios del catálogo (`activacion`, hasta 20 objetos id/nombre/indicación) con texto libre (`calentamiento`). Ejercicios y Agregar van arriba; indicaciones generales abajo. Dosis al lado del nombre; placeholder «Opcional». Se reordena con agarre táctil/mouse o flechas de teclado. No tiene pesos ni variación semanal propia.
- La matriz mide el ancho real y muestra tantas semanas como entren legiblemente; no hay límite fijo de cuatro columnas. Móvil muestra una semana seleccionada con navegación. Las flechas aparecen cuando falta espacio.
- Prescripción libre: `4x8`, tiempos, distancias u otras instrucciones. Un vacío hereda solo hacia atrás. Completar vacíos fija el valor anterior en la semana elegida, sin copiar pesos.
- Pesos y fechas son independientes por ejercicio/semana. Ampliar duración agrega celdas; acortar se rechaza si descartaría indicaciones o registros.

Autoguardado actual: pausa de **300 ms**, pedidos independientes en tandas de hasta cuatro. Si se escribe durante un envío, el siguiente borrador continúa inmediatamente al terminar. Las dependencias (crear ejercicio antes de sus celdas) mantienen orden. Éxito actualiza la sesión confirmada en caché sin recargar todo; lecturas anteriores no deben pisarla. Ante fallo se conserva el borrador y se ofrece Reintentar; navegación protegida mientras hay pendientes. Altas, bajas y modal de metadatos siguen siendo acciones explícitas. Varios PATCH no forman una transacción global: un fallo parcial puede dejar cambios confirmados, sin anunciar éxito total.

Alumno: «Hoy te toca» muestra todas las sesiones asignadas al día, incluso varias del mismo tipo. Las no asignadas se muestran aparte. No hay franja mañana/tarde/noche en controles, etiquetas ni orden; `sesiones.franja` permanece en DB/contrato por compatibilidad. En el detalle del profesor, gráfico semanal en Resumen; editor Plan con selectores simples de tipo/día/semana, centrados. Alumno: semana primero y día semanal después; selección turquesa con texto contrastante y check, y leyenda Semana X de Y.

Los planes legacy en `planes`/`plan_ejercicios` siguen siendo otro modelo, visible como Planes anteriores. Si no hay registros para mostrar, profesor y alumno ven únicamente «No hay planes anteriores registrados.», sin filtros ni botones de creación del formato anterior. No se importan ni eliminan automáticamente. La query entregada a Andrés para borrarlos solo afecta esas tablas y limpia `alumnos.plan_activo_id`; no borra `planes_mensuales`. No se confirmó su ejecución.

## 6. Clases: lógica y uso

Diseño vigente de agenda: cuatro tarjetas iguales arriba y tres centradas debajo en escritorio (grid de ocho columnas, cada tarjeta ocupa dos). Dos columnas en tablet, una en móvil, sin scroll horizontal de página. Tarjetas de 240 px de alto; varios turnos se desplazan dentro. Cancelar clase es un botón outline con borde/fondo/texto destructivo y Reabrir usa primario, distintos de la información. Horarios semanales visibles debajo como filas ordenadas, sin acordeones. Confirmaciones y edición siguen en modales.

**El plan dice qué entrenar; Clases dice a qué encuentro presencial piensa ir el alumno.** No se vinculan automáticamente ni se marca el entrenamiento realizado por reservar una clase.

1. Lucas crea un horario recurrente, por ejemplo «Running», martes 18:00, lugar y hora de fin obligatorios para nuevas altas. Puede crear varios el mismo día.
2. La API genera las clases visibles para las fechas consultadas a partir de los horarios activos. No guarda infinitas clases futuras.
3. El alumno elige una fecha concreta y confirma «Voy». La confirmación identifica horario + fecha + alumno: pulsar dos veces no duplica. No se reserva automáticamente para todas las semanas ni se limita la cantidad de personas.
4. El alumno puede cancelar su confirmación. Solo Lucas ve los nombres de quienes confirmaron; cada alumno ve su propia elección.
5. Lucas puede cancelar una fecha sin eliminar la recurrencia. Reabrir conserva confirmaciones anteriores. Desactivar un horario oculta sus clases y conserva datos; reactivarlo vuelve a ofrecerlas.
6. Cada tarjeta de día permite Agregar bloque y editarlo con lápiz/modal. Se pueden crear varios turnos (por ejemplo 06:00–12:00 y 15:00–18:00) con lugares independientes. El habitual se repite; el modal elige «Esta y las próximas semanas» desde la fecha seleccionada o «Solo esta fecha». Cambios puntuales de otras fechas y semanas pasadas se conservan. Para cambiar el día semanal se crea otro bloque; no se mueve la identidad de una reserva a otro día.
7. Editar un bloque avisa que los turnos afectados requieren confirmar de nuevo. El RPC retira solo sus confirmaciones futuras y conserva las de excepciones/versiones posteriores que no modifica. Cancelar el modal o fallar el pedido no cambia datos. Se conserva la confirmación previa ante un rollback SQL.
8. Inicio del alumno (`/mi-plan`) incluye «Hoy entrenamos»: todos los bloques de hoy, lugar, inicio/fin y «Asistiré»/cancelar confirmación. Actualiza al volver a la pestaña. Profesor ve los nombres confirmados dentro de cada bloque, debajo del contador de confirmaciones; alumno no ve otros nombres. Cancelar entrenamiento queda al final de cada bloque.

Agregar bloque y editar el habitual están disponibles aunque el día mostrado ya pasó. Se usa la próxima ocurrencia de ese día (al editar se consulta su versión vigente, no se copian datos históricos); al crear se indica la vigencia en el modal y se navega a esa semana si corresponde. La cancelación de un entrenamiento pasado sigue bloqueada. No se modifica el pasado ni se requiere otra migración para este ajuste.

Migración 39 agrega `horarios_clase.desde` (anteriores null; nuevas altas desde hoy por defecto) y `cambios_horario_clase`. La base de cada horario no se sobrescribe: versiones habituales con fecha de vigencia y excepciones por fecha se resuelven al leer. RPC `guardar_cambio_horario` valida profesor dueño, día coincidente y fecha hoy..+60; bloquea horario y guarda cambio/retiro de confirmaciones en una transacción. SELECT con RLS; sin escritura directa autenticada en cambios. Security definer acotado a ese RPC, no usa service_role en la API. Requiere [20261108000000_cambios_horarios_clase.sql](aktiv-api/supabase/migrations/20261108000000_cambios_horarios_clase.sql) después de 38; no ejecutada en remoto. No existe copia de semana ni avisos por email/push.

Actualización visual: Clases muestra la semana calendario completa de lunes a domingo, incluyendo días sin clases y resaltando hoy; elegir una fecha lleva al lunes correspondiente y las flechas avanzan semanas. «Nuevo horario» abre un modal responsive (hasta 896 px en escritorio) con selección compacta de días mediante Checkbox de shadcn y un único formulario. Actividad, inicio, fin y lugar obligatorios, iguales para todos los días seleccionados. Se retiró «Personalizar» por ser confuso: no anidar formularios ni expandir tarjetas por día. Para un domingo distinto, dejarlo sin marcar al crear el horario habitual y crear otro solo para domingo. Una nueva carga agrega un turno, no reemplaza los anteriores. En móvil se apilan campos; contenido con scroll y pie de acciones visible. La obligatoriedad de fin/lugar requiere la migración 38; conserva registros anteriores. Usa las altas individuales existentes, valida todo antes de enviar y conserva los días guardados ante fallo parcial. IDs estables y consulta previa permiten reintentar sin duplicar altas cuya respuesta se perdió; no es una transacción global. Tras un fallo parcial se bloquean cambios de datos/días hasta completar pendientes o cerrar, para no mezclar horarios ya confirmados con otros valores. El modal conserva el borrador ante error y muestra pendientes explícitos.

Tablas: `horarios_clase` (recurrencia), `clases_canceladas` (excepción por fecha), `confirmaciones_clase` (intención individual por fecha). RLS aísla profesores y alumnos. Solo alumnos activos pueden crear confirmaciones propias para su profesor. Fechas de alta de confirmación/cancelación de clase: hoy hasta 60 días, día semanal coincidente y zona `America/Argentina/Buenos_Aires`; no se confirma una clase cancelada. Consultas hasta 31 días por pedido, interfaz semanal, actualización al volver a la pestaña y botón Actualizar. No es una agenda en tiempo real ni hay registro de asistencia efectiva, lista de espera, pagos o avisos automáticos.

## 7. Otras funciones y criterios visuales

- Detalle con Resumen, Plan, Ficha médica, Marcas y Carreras. Estado/próximo pago compactos junto al nombre en escritorio y adaptados en móvil. Resumen con previews de apuntes privados, entrenamiento de hoy, mejores marcas y próxima carrera.
- Dashboard sencillo con alumnos, estado y vencimientos. Registrar pago avanza el próximo vencimiento un mes calendario desde la fecha vigente si no venció, o desde hoy; no guarda importe, medio ni historial contable.
- Ficha: datos personales, condiciones, contacto familiar y apto PDF/JPG/PNG/WebP hasta 5 MB. Archivo privado, validación por firma real, preview y URL firmada de 2 minutos. Vigente/por vencer (30 días)/vencido/sin certificado. Sin aprobación explícita del profesor. Lesiones estructuradas tienen API; apuntes de lesiones del profesor son privados.
- Marcas: distancia, tiempo, fecha y carrera; mejor = menor tiempo por distancia. `mm:ss` / `h:mm:ss`, ritmo min/km. Carreras del profesor separadas de inscripciones individuales con distancia, objetivo y resultado. El alumno gestiona su inscripción, no el calendario.
- Catálogo solo desde DB, sin sugerencias fijas. Nombre visible legible; `claveEjercicio` compara sin mayúsculas, tildes ni separadores, y `limpiarNombreEjercicio` limpia espacios. API verifica nombres del propio profesor paginadamente. No hay índice normalizado atómico nuevo: no se garantiza impedir toda carrera concurrente ni se fusionan sinónimos/errores.
- Fondo azul oscuro, superficies discretas, turquesa primario, texto escrito claramente más blanco que el placeholder; claro/oscuro. Mantener espaciado del lector y títulos sin caracteres corruptos. Logo vectorizado desde referencia, sustituible si llega SVG oficial.
- Lector del alumno compacto por filas: nombre/prescripción a la izquierda y descanso/peso a la derecha con justify-between; ajuste de línea en móvil, separadores sutiles y control kg inline. Evitar apilar cada dato en una línea con grandes espacios por ejercicio.
- Peso semanal del alumno con autoguardado tras 400 ms, envíos serializados por celda y estado discreto. Sin botón Guardar peso ni etiquetas Ejercicios juntos/individual en el lector. Un error conserva lo escrito y permite Reintentar; bloquea navegación de semana/día/rutas mientras está pendiente. Vaciar borra solo el peso/fecha de esa celda, nunca otra semana. El editor del profesor conserva su descripción de bloques.
- Base UI usa `render`, no `asChild`. Select necesita `items` para etiquetas y puede devolver null. `DropdownMenuLabel` dentro de Group; Content con ancho explícito. Cards con acción usan CardAction. Formularios de diálogos montan limpio al abrir.
- Inputs móviles a 16 px para evitar zoom iOS. Fechas visibles día/mes/año; fecha ISO sin hora se parsea local (`parseISO`), no `new Date("yyyy-mm-dd")`. En Clases se calcula hoy en zona Argentina.
- Horas de Clases: `HoraSelector` combina Input editable y reloj con Popover/Button de shadcn sobre Base UI, columnas desplazables de hora/minutos, selección resaltada y Listo/Limpiar. Se puede escribir `18:30` o `1830` (normaliza al salir). Formato 24 h `HH:mm`, sin selector nativo `type=time` ni AM/PM. Cerrar sin Listo descarta la selección temporal del panel. Referencia de disposición: ReUI Base UI Time Picker (https://reui.io/docs/components/base/time-picker), no se instaló ese paquete. El contrato valida el rango y que fin sea posterior a inicio.
- TanStack Table permanece en v8. `cacheComponents` desactivado. Variables públicas y rewrites se fijan al compilar.

## 8. Migraciones y diagnósticos

Ejecutar SQL en el **mismo proyecto configurado en `SUPABASE_URL` de la API**. Antes de aplicar, comprobar qué existe; no repetir archivos con CREATE sobre objetos existentes ni usar `db push` sin reconciliar lo ejecutado manualmente con el historial remoto.

Para esta actualización:

1. Ejecutar [verificar_actualizacion_lucas.sql](aktiv-api/supabase/verificar_actualizacion_lucas.sql), solo lectura.
2. Si falta la 36, aplicar [20261105000000_dni_y_calendario.sql](aktiv-api/supabase/migrations/20261105000000_dni_y_calendario.sql): DNI, índice, columna de compatibilidad y RPC de importación. No cambia claves existentes.
3. Si falta la 37, aplicar [20261106000000_agenda_clases.sql](aktiv-api/supabase/migrations/20261106000000_agenda_clases.sql): tablas de Clases, permisos/RLS y validación de fechas. Clases depende directamente de esta migración; el despliegue completo también usa la 36.
4. Aplicar la [migración 38](aktiv-api/supabase/migrations/20261107000000_horarios_datos_obligatorios.sql) después de la 37 para exigir fin/lugar en nuevas altas sin alterar registros anteriores. Repetir diagnóstico. Todos true confirma presencia de las piezas consultadas, no todas las definiciones, historial, caché ni funcionamiento end to end. Ante aplicación parcial revisar el error, no saltear ni reejecutar a ciegas.
5. Aplicar la [migración 39](aktiv-api/supabase/migrations/20261108000000_cambios_horarios_clase.sql) para bloques editables/excepciones, después de 38. Repetir diagnóstico. Si la API no reconoce objetos presentes, ejecutar [recargar_esquema.sql](aktiv-api/supabase/recargar_esquema.sql) y comprobar proyecto/configuración. NOTIFY recarga caché, no sustituye una migración.
6. Reiniciar API local y actualizar frontend; para producción desplegar API y cliente compatibles. Las migraciones no publican código y Render no las ejecuta automáticamente.

Historial resumido (número = día del nombre, no posición del archivo):

| Versiones | Cambio |
| --- | --- |
| 19–23 octubre | Esquema inicial, carreras/catálogo, validaciones, invitaciones y categorías |
| 24–27 octubre | Planes legacy por tipo, inscripciones del alumno, bloques y descanso legacy |
| 28 | Tablas de planes por semanas; copia del SQL original informado por Andrés |
| 29 | Creación automática de celdas por ejercicio y backfill de faltantes |
| 30 | Duración variable y protección al acortar |
| 31 | Día semanal opcional, sin reescribir asignaciones |
| 32 | Crear plan con días iniciales de forma atómica |
| 33 | Persistencia/orden de bloques vacíos |
| 34 | Reemplazo destructivo del catálogo de demo por 11 ejercicios de la foto por profesor |
| 35 | Entrada en calor mixta con activación JSONB |
| 36 | DNI, compatibilidad de franja e importación CSV atómica |
| 37 | Agenda de clases |
| 38 | Fin y lugar obligatorios en nuevas altas, sin alterar horarios anteriores |
| 39 | Bloques habituales versionados y cambios puntuales por fecha |

**No volver a ejecutar la 34 en el proyecto existente**: Andrés informó aplicada y mostró 11 ejercicios. No elimina ejercicios ya guardados en planes. En una base nueva sin profesores no inserta catálogo; es un caso distinto de reejecutarla en producción.

Otros diagnósticos de solo lectura: [verificar_planes.sql](aktiv-api/supabase/verificar_planes.sql) y [verificar_dias_entrenamiento.sql](aktiv-api/supabase/verificar_dias_entrenamiento.sql). Andrés mostró cuatro true para las piezas de 28/29/30 y confirmó creación de un plan; no demuestra todas las migraciones posteriores. No hay confirmación de aplicación remota de 36/37/38/39 y el agente no las ejecutó.

## 9. Contrato, permisos y API

Zod valida formularios, DTOs estrictos y respuestas. Entidades sin trim mientras se escribe; recorte en formularios. No agregar defaults a campos de PATCH que puedan borrar valores al editar otro campo. Límites deben coincidir con CHECK de DB. Los UUID de altas pueden generarse en cliente para respuesta optimista. Recurso ajeno responde como inexistente (404).

Todo bajo `/api`. Error uniforme `{statusCode, codigo, mensaje, detalles?, requestId}`, seguro para mostrar, sin stack ni detalles internos. CSRF en mutaciones con `X-Requested-With: aktiv` y Origin permitido. Auth global salvo rutas públicas, rol desde profiles, throttling por IP y límite de login. Estado del limiter en memoria: Redis pendiente si hay varias instancias.

| Área | Rutas principales |
| --- | --- |
| Salud | GET `/health`, `/health/supabase` |
| Auth | POST `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/clave`; GET `/auth/me` |
| Datos / alumnos | GET `/datos`; POST `/alumnos`, `/alumnos/importar`; PATCH/DELETE `/alumnos/:id` |
| Acceso | POST `/alumnos/:id/invitar`, `/alumnos/:id/credenciales`; GET `/auth/invitacion/:token`; POST `/auth/invitacion/aceptar` |
| Planes vigentes | GET/POST `/alumnos/:id/planes-mensuales`; PATCH/DELETE `/planes-mensuales/:id`; POST `/planes-mensuales/:id/sesiones` |
| Sesiones | PATCH/DELETE `/sesiones/:id`; POST `/sesiones/:id/ejercicios`; PATCH/DELETE `/sesion-ejercicios/:id`; PATCH `/sesion-ejercicios/:id/semanas/:semana` |
| Clases | GET `/agenda?desde=...&hasta=...`; POST `/agenda/horarios`; PATCH `/agenda/horarios/:id` (activo); POST `/agenda/horarios/:id/cambios` (habitual o puntual); POST/DELETE `/agenda/confirmaciones`, `/agenda/cancelaciones` |
| Ficha / marcas | PATCH `/alumnos/:id/ficha`; POST `/alumnos/:id/marcas`; PATCH/DELETE `/marcas/:id`; lesiones equivalentes |
| Carreras | POST `/carreras`; PATCH/DELETE `/carreras/:id`; POST `/alumnos/:id/inscripciones`; PATCH/DELETE `/inscripciones/:id` |
| Catálogo | POST `/catalogo/ejercicios`; PATCH/DELETE `/catalogo/ejercicios/:id` |
| Certificados | POST `/alumnos/:id/certificado` multipart `archivo`; GET `.../url`; PATCH/DELETE certificado |

Planes, estructura y prescripciones: solo profesor. Alumno modifica pesos/fechas propios, notas propias, ficha, marcas e inscripciones permitidas. El profesor administra sus alumnos/carreras; RLS y triggers refuerzan permisos. Clases usa identidad derivada del token, no un alumnoId libre del cuerpo. Consultas mensuales y de agenda paginadas; revisar paginado de `/datos` antes de volúmenes grandes. Límites mensuales actuales: 50 planes por alumno, 28 sesiones por plan, 100 ejercicios por sesión.

Modelo de DB: `profiles`, `alumnos`, `fichas_medicas`, `lesiones`, `marcas`, `carreras`, `inscripciones`, `ejercicios_custom`; planes vigentes `planes_mensuales → sesiones → sesion_ejercicios → ejercicio_semanas`; legacy `planes → plan_ejercicios`; agenda según sección 6. Borrado de padres usa cascada donde está definido. Bucket privado `certificados`, rutas por alumno. Anon sin acceso a tablas; alta pública desactivada manteniendo proveedor Email habilitado. No quitar protecciones de los tests que impiden apuntarlos a remoto.

## 10. Desarrollo y despliegue

Cada carpeta tiene su package.json. En PowerShell usar `npm.cmd`/`npx.cmd` si la política bloquea `.ps1`.

API `.env` desde `.env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` para cuentas, `WEB_ORIGIN`, `APP_URL`, `PORT`, `TRUST_PROXY`; `RESEND_API_KEY` y `MAIL_FROM` si se envían invitaciones. `.env.seed` solo para script de usuarios, `test/.env.test` solo base local. Nunca poner service_role en frontend o `NEXT_PUBLIC_*`.

Desde `aktiv-api/`: `npm.cmd install`, `npm.cmd run start:dev`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`. Integración: `npm.cmd run test:e2e`, `npm.cmd run test:db`, requieren Supabase local operativo. `npm.cmd run usuarios` crea/actualiza cuentas según `.env.seed`: no ejecutarlo a ciegas sobre remoto.

Supabase local requiere Docker: `npx.cmd supabase start` (se pueden excluir servicios no usados) y `npx.cmd supabase db reset` **solo en base local de pruebas**, aplica todo el historial. Usar URL/claves locales en API y tests; nunca resetear proyecto real para comprobar una migración.

Desarrollo Nest emite en `dist-dev` sin incremental; producción en `dist`. `npm.cmd run build` pasa `--path tsconfig.build.json`; no usar `nest build` sin ese path para el deploy. Si un watcher anterior busca `dist/main`, detener y reiniciar el comando de desarrollo: conserva la configuración con la que arrancó.

Cliente `.env.local` desde ejemplo con `API_URL` de la API. Desde `aktiv-client/`: `npm.cmd install`, `npm.cmd run dev`, `npm.cmd run contrato:check`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Los tipos de rutas requieren generación previa por Next. Para pruebas propias usar `AKTIV_DIST_DIR=.next-verificacion` y puerto 3101 sin compartir `.next` del usuario; ignorado en Git/lint. Apuntar API_URL a API 4100.

Render: blueprint raíz `render.yaml`, rootDir `aktiv-api`; build `npm install --include=dev && npm run build`; start `node dist/main.js`. Configurar variables de API, `WEB_ORIGIN`/`APP_URL` del frontend y revisar trust proxy según infraestructura. Vercel: rootDirectory `aktiv-client`, `API_URL` real antes de compilar; cambiarla requiere redeploy. Comprobar `/api/health/supabase` y que ambos despliegues correspondan a código compatible. SQL del Editor no actualiza por sí solo el historial de CLI. No automatizar un push/deploy por este documento.

## 11. Validación y estado de entrega

Los cambios de acceso/DNI, calendario, CSV, Clases, centrado y optimización del guardado están implementados localmente. No hay confirmación de publicación de esta actualización ni de aplicación remota de 36/37/38/39. No convertir «implementado» en «validado en producción».

Verificación registrada antes de esta consolidación documental:

- API: tipos/build correctos y 45 tests; contrato: 34 tests; frontend: 20 tests. Lint con advertencia preexistente de React Compiler/TanStack, sin errores en cambios verificados.
- `aktiv-api/scripts/probar-lucas-sql.mjs`: 61 comprobaciones con PostgreSQL embebido y SQL real 36/37/38/39, fixtures de Auth/esquema previo. Incluye RLS, rollback de importación, privacidad, fechas y conservación de confirmaciones. No es Supabase Auth/PostgREST real.
- `aktiv-api/scripts/probar-mensual-sql.mjs`: comprobaciones de esquema mensual, duración, herencia, permisos y cascada; no confundir resultados de ejecuciones históricas con una corrida actual.
- `aktiv-client/scripts/lucas.browser.mjs`: flujos de acceso/CSV/Clases con API simulada; aislamiento de nombres, fallos y reintentos. `scripts/mensual.browser.mjs` incluye carga, responsive, bloques, calentamiento, semanas, catálogo y modos `--guardado-rapido`/`--alta` verificados tras optimización.
- Playwright/PGlite se instalaron fuera del repo; scripts reciben `PLAYWRIGHT_MODULE`/`PGLITE_MODULE`. Capturas temporales `aktiv-lucas-capturas` y `aktiv-mensual-capturas`. Estas pruebas no demuestran persistencia en Supabase remoto.
- La integración completa contra Supabase local requiere Docker operativo; no declarar aprobadas pruebas que no pudieron arrancar. Resend real, dispositivo físico y recorrido remoto siguen por confirmar.

Prueba que hace Andrés después de aplicar pendientes y usar código actualizado:

1. Crear/importar un alumno de prueba, completar email/DNI, preparar acceso y entrar. Probar cambio opcional, sesión recordada y cierre.
2. Crear plan de seis semanas, dos sesiones el mismo día; cargar semana 1 y 3 y dejar 2 vacía. Recargar y verificar herencia y cantidad de semanas.
3. Registrar peso como alumno y comprobarlo desde profesor, sin propagación a otras semanas ni acceso a datos ajenos.
4. Crear horario de Clases, confirmar/cancelar con alumno y revisar nombres con Lucas. Cancelar/reabrir una fecha y desactivar/reactivar horario.
5. Cargar marca y certificado ficticio, recargar y abrirlos; probar teléfono real. No usar datos médicos reales para tests.

## 12. Pendientes y prioridades

El recorrido real es la prioridad activa. Andrés confirmó alta de plan y fue probando edición; falta cierre completo profe/alumno con persistencia y OK para funciones posteriores. La autorización de los cambios ya solicitados no autoriza nuevas funciones de la hoja de ruta.

| Orden | Trabajo | Estado / aceptación |
| --- | --- | --- |
| 1 | Aplicar/verificar 36/37/38/39 y probar actualización de Lucas | Andrés opera el ambiente real; agente corrige fallos reproducibles |
| 2 | Cerrar recorrido vigente | Plan, autoguardado, alumno, pesos, ficha, CSV y Clases con recarga |
| 3 | Duplicar sesión | Pendiente de OK: copia atómica independiente, nuevos IDs y sin pesos/fechas del alumno |
| 4 | Duplicar/asignar plan | Pendiente: otro alumno propio o mismo alumno, inicio/duración, copia como borrador sin cambiar activo |
| 5 | Registrar lo realizado | Acordar completada/parcial, fecha, comentario/esfuerzo e identidad histórica; no inferir ausencias ni asistencia |
| 6 | Running estructurado y excepciones puntuales | Pedir ejemplo completo; definir distancia/duración/ritmo/zona/recuperación, pausas y reprogramación |
| 7 | Entrega | Checks pertinentes, migraciones/configuración, ensayo desktop/móvil y autorización de publicación |

Agente: análisis, diseño concreto, contrato, migraciones, código, pruebas y documentación. Andrés: proyecto real, ejecución SQL revisado, cuentas/variables sin compartir secretos, prueba con Lucas y aprobación del resultado. No hace falta pedir permiso para ajustes reversibles dentro del alcance autorizado; sí respetar el OK entre etapas futuras.

Otros pendientes según necesidad real: plantillas; videos por ejercicio; historial de pagos; avisos/comentarios de sesión; progreso; recuperación autónoma de acceso; paginado global y fallos del store general; identidad de preview al reemplazar certificado; rate limiting compartido si escala; dependencias reproducibles de navegador. La mejora del editor mensual no resuelve automáticamente todos los riesgos del store legacy. IA, nutrición, chat completo, apps nativas e integraciones deportivas no están implementados ni priorizados.

## 13. Referencias de producto conservadas

Investigación histórica del 2 de noviembre de 2026, basada en páginas públicas; no se probaron cuentas privadas ni algoritmos de generación. Conservar como referencias de diseño, no como requisitos ni una auditoría actual de competidores:

- [Entrenamientos.com](https://entrenamientos.com/): composición y reutilización de programas/catálogo.
- [Arvo](https://arvo.guru/es/tools/workout-generator) y [WorkoutGen](https://workoutgen.app/es/): formularios de objetivos, experiencia, frecuencia y duración; diferenciar propuesta inicial de seguimiento.
- [TrainerPlan](https://trainerplan.co/es/features/calendario/): calendario, pasos, plantillas, copias y distinción prescrito/realizado; referencia principal para reutilización.
- [Trainerize](https://www.trainerize.com/features/), [progresiones](https://help.trainerize.com/hc/en-us/articles/212130826-Progressing-Regressing-Workouts-with-the-Progressions-Spreadsheet): comunicación y matriz de evolución.
- [TrueCoach](https://help.truecoach.co/en/articles/3047401-programs): programas y bibliotecas de calentamiento.
- [TrainingPeaks](https://www.trainingpeaks.com/coach-features/): planificación, análisis e integración posterior.

La decisión de Aktiv es facilitar la metodología real de Lucas, no copiar todo el alcance de esos productos. Las dudas de metodología y preferencias se mantienen únicamente en el archivo de preguntas.

## 14. Verificaci?n previa a publicaci?n solicitada (3 de noviembre de 2026)

Andr?s autoriz? commit y push a main. Se verific? el c?digo local sin modificar los servidores del usuario en 3000/4000 ni ejecutar SQL remoto.

- API: 45 tests; contrato: 34 tests; frontend: 20 tests, todos aprobados. Jest tambi?n pas? en serie con detecci?n de handles abiertos.
- Typecheck y builds de API y frontend aprobados; contrato sincronizado (12 archivos).
- Lint: cero errores, una advertencia conocida de React Compiler/TanStack Table en alumnos-table.tsx.
- PostgreSQL embebido: 59 comprobaciones de planes y 61 de actualizaci?n Lucas aprobadas (120 en total). No sustituye Auth/PostgREST/Storage reales.
- Navegador contra build de producci?n local aislado: diez modos de planes y recorrido Lucas aprobados, con API simulada, errores/reintentos, persistencia simulada y resoluciones m?viles/escritorio. Se actualizaron expectativas del dise?o anterior y se esper? la adaptaci?n de ResizeObserver antes de medir la tabla.
- Integraci?n real pendiente: test:e2e no pudo preparar sus 98 casos porque Supabase local no est? disponible (fetch de Auth fall?); test:db tampoco pudo iniciar. Docker no est? disponible. No se afirma que estas pruebas pasaron ni que producci?n fue validada.
- Producci?n requiere las migraciones 36, 37, 38 y 39. Verificar con [diagn?stico de solo lectura](aktiv-api/supabase/verificar_actualizacion_lucas.sql). Su aplicaci?n remota no fue confirmada por el agente.
