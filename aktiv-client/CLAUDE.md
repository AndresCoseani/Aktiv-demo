@AGENTS.md

# Aktiv Client (Next.js)

## Actualización: días numerados y autoguardado

Última decisión para demo: selector simple Día 1/Día 2 en Plan, sin tarjetas/gráfico. El calendario semanal queda solo en Resumen del detalle del alumno; Mi plan no muestra ese gráfico. Si hay sesiones sin fecha, no indicar descanso en los huecos: mostrar Sin asignar. Se revisará con Lucas. Preguntas en `../PREGUNTAS-LUCAS-2026-11-03.md`.

`EntradaEnCalorEditor` combina `calentamiento` texto libre y `activacion` ejercicios elegidos del catálogo con indicación individual. Filtro Movilidad por defecto, desmarcable para todas las categorías. Lista snapshot de nombres, no referencias borrables al catálogo. Autoguardado en cabecera de sesión y lectura del alumno con ambas partes. Requiere migración 35; no convertir ni descartar texto anterior. Prueba `--calentamiento`.

El catálogo ya no incluye ejercicios fijos del código. `catalogoCompleto` deduplica solo los recibidos de la base; la página Ejercicios también muestra únicamente esas filas. Migración 34 reemplaza el catálogo con los 11 ejercicios de la foto por profesor, a pedido de Andrés. Los nombres históricos elegidos en planes siguen visibles; no borrar ejercicios de planes al limpiar el catálogo.

Grilla de prescripciones sin grupos fijos de cuatro: `EditorEjerciciosPlan` mide su ancho y calcula columnas legibles; móvil muestra la semana seleccionada. No limitar `semanasVisibles` en el padre a cuatro. `--semanas` comprueba planes de cinco/doce semanas.

Identidad del catálogo: `claveEjercicio`/`limpiarNombreEjercicio` nacen en contrato. Búsqueda, deduplicación de opciones, categoría y prevención de duplicados en store usan la misma clave. Mantener nombres legibles; no guardar el nombre como slug ni reescribir registros anteriores. `--catalogo` cubre variantes Hiptrust/Hip Trust/HIP_TRUST.

Flujo de tarjetas: Crear bloque crea una tarjeta vacía al final, persistida en `sesiones.bloques` mediante autoguardado (requiere migración 33). Agregar ejercicio vive dentro de cada tarjeta y recibe su grupo, no crea otro bloque. Orden de `bloques` prevalece y se incorporan grupos de ejercicios aún no listados para compatibilidad. Prueba `--bloques-vacios` cubre recarga, añadir dos en una tarjeta y eliminar la vacía.

Altas de ejercicios optimistas: tarjeta local inmediata al final, POST serializado con el guardado de campos, alta pendiente conservada ante error. No remontar el formulario por cambios en la lista de IDs: perdería ediciones durante pedidos lentos. Bajas de ejercicios confirmadas actualizan borrador y baseline local. El orden de tarjetas sigue el orden de ejercicios, no el ID numérico del grupo. `scripts/mensual.browser.mjs --alta` cubre estos casos.

Nuevo plan incluye nombre, semanas, Running/Fuerza/ambos, cantidad de días (1–7 por tipo seleccionado) e inicio. Envía `diasIniciales` en el POST; el servidor crea todo atómicamente (requiere migración 32 después de 31). No hacer múltiples POST de días desde el navegador al crear el plan. El botón Crear Día N permite ampliar después.

El editor/lector del plan organiza Fuerza y Running en Día 1, Día 2, etc. según el orden de sesiones de cada tipo. `dia` ahora admite null: el calendario es opcional y se conservan las asignaciones anteriores. Requiere migración 31. La edición de ejercicios, calentamiento y prescripciones se guarda automáticamente tras 800 ms, con pedidos serializados, borrador conservado ante error y reintento explícito. Se puede escribir durante el guardado; los cambios nuevos se envían después. La navegación se bloquea mientras hay cambios pendientes. Altas, eliminaciones y el modal de metadatos siguen siendo acciones explícitas. Esto reemplaza las referencias históricas al guardado manual de sesiones.

## Actualización: planes mensuales

Corrección posterior: la UI usa “Plan de entrenamiento” y permite elegir duración en semanas al crear/editar. Cuatro es solo el valor inicial; escritorio pagina columnas en grupos de cuatro y celular muestra una semana. Requiere migración 30 de la API. El resumen calcula la semana con la duración real del plan. Ver `../INVESTIGACION-PLANIFICADORES.md` para referencias/preguntas. Prevalece esta aclaración sobre las menciones históricas a cuatro semanas fijas.

`components/plan-mensual.tsx` es el editor/lector principal en Plan y Mi plan; `lib/mensual.ts` carga por alumno y sesión de usuario, separado del store optimista. Los cambios mensuales se guardan explícitamente; no pasar estas entidades por `remoto.ts`. Cuatro semanas, sesiones por día, grupo/descanso y prescripciones heredadas cuando una celda está vacía. Los pesos son independientes por semana. La distribución del resumen y la preview de hoy usan el mes activo. Las rutinas anteriores permanecen en “Planes anteriores”.

Requiere la migración complementaria 29 de la API antes de usar el editor. Ver `../PLANES-MENSUALES.md` para estado, endpoints y comprobaciones. Smoke de UI con API controlada en `scripts/mensual.browser.mjs`; no sustituye pruebas con Supabase local.

Frontend de **Aktiv**, el sistema web del club de **running y entrenamiento integral** del profe **Lucas**: gestión de alumnos, pagos, planes, semana de entrenamiento, ficha médica, marcas y carreras, y una cuenta para que cada alumno vea su plan. Esta carpeta (`aktiv-client/`) es el frontend; la API está en `../aktiv-api/`. Contexto general y reglas comunes: `../CLAUDE.md`.

- **Idioma:** producto y dominio en **español rioplatense** (voseo: "Tocá", "Cargá", "Creá"). Los nombres de código del dominio también van en español (`alumno`, `plan`, `ejercicio`, `semana`, `marca`, `carrera`, `inscripcion`). Los términos técnicos quedan en inglés.
- **Tono de UI:** minimalista, limpio, sin ruido. Celular y PC por igual.

## Arquitectura

```
Navegador ──► Next.js (esta carpeta) ──/api/*──► NestJS (aktiv-api) ──► Supabase
                 rewrites, mismo origen
```

- El navegador **solo habla con su propio origen**: Next reenvía `/api/*` a la API (`rewrites` en `next.config.ts`, variable `API_URL`). Así las cookies de sesión (httpOnly, SameSite=Lax) son del mismo sitio y no hace falta CORS.
- El frontend **no usa Supabase directamente** ni necesita ninguna clave de Supabase.
- **Store en memoria + sincronización por diferencias:** la UI responde al instante; `src/lib/store.ts` guarda el estado y `src/lib/remoto.ts` detecta qué cambió y manda solo eso a los endpoints REST (POST / PATCH de los campos modificados / DELETE), con debounce. El servidor decide qué puede ver y editar cada rol.
- **No hay modo demo ni datos de ejemplo**: lo que se ve es lo que hay en la base.

## Stack

| Cosa | Detalle |
|---|---|
| Frontend | Next.js **16.4** (App Router, Turbopack), React 19, Tailwind v4 |
| UI | **shadcn/ui estilo `base-nova`** → basado en **Base UI**, **no Radix** |
| Tabla | `@tanstack/react-table` **v8** (fijada; la v9 trae otra API y rompe) |
| Contrato | **Zod 4**; copia del contrato en `src/contrato` (nace en `../aktiv-api/contrato`) |
| Tests | **Vitest 5** |

## Cosas no obvias (leer antes de tocar el frontend)

- **Next 16 no es el Next que conocés.** `AGENTS.md` pide leer `node_modules/next/dist/docs/` antes de escribir código de Next.
- `cacheComponents` está **desactivado** en `next.config.ts`. No volver a activarlo sin necesidad.
- Las variables `NEXT_PUBLIC_*` se **inyectan al compilar**: cambiarlas exige volver a hacer build/deploy. Los `rewrites` también se fijan al compilar (`API_URL`).
- **Base UI no usa `asChild`.** Para cambiar el elemento renderizado se usa la prop `render`.
- `Select` de Base UI: pasar `items={{valor: "Etiqueta"}}` para que `SelectValue` muestre la etiqueta. `onValueChange` puede recibir `null`.
- `DropdownMenuLabel` va dentro de un `DropdownMenuGroup`. `DropdownMenuContent` toma el ancho del trigger: ponerle `className="w-56"`.
- Cards con acción en el header: usar `CardAction` (el `CardHeader` es un grid).
- Los formularios de los diálogos viven en un componente interno que se monta limpio (`key`) cada vez que se abre.
- En celular los inputs fuerzan `font-size: 16px` (regla global) para que iOS no haga zoom.
- Fechas como `yyyy-mm-dd`, parseadas en hora local con `parseISO` (nunca `new Date("2026-10-18")`).
- Los `role="alert"` de Next (anunciador de rutas) existen en la página: en tests usar `form [role=alert]`.
- `@aktiv/contrato` es un **alias** a `src/contrato` (en `tsconfig.json` y `vitest.config.mts`). Esa carpeta es una **copia** del contrato de `aktiv-api`: no se edita a mano (ver "Contrato de datos").
- En scripts de shell con muchos strings y comillas, escribir el parche en un archivo y ejecutarlo (los `node -e '...'` largos se rompen y pierden las barras invertidas).

## Identidad visual

Sale del logo: isotipo "A" blanco en círculo negro, fondo negro azulado con **resplandor turquesa en la esquina inferior derecha**, lockup "ENTRENAMIENTO INTEGRAL" + "y RUNNING".

- Oscuro: fondo `oklch(0.145 0.022 245)`, primario turquesa `oklch(0.76 0.11 205)`. Claro: fondo casi blanco frío, primario `oklch(0.5 0.09 208)`.
- Semánticos: `success` (activo / vigente), `warning` (pago próximo, por vencer, fuerza), `destructive` (vencido).
- `src/components/logo.tsx`: el isotipo está **redibujado a mano** desde una miniatura. **Pendiente:** reemplazar por el SVG oficial.

## Estructura

```
src/
  contrato/              # COPIA del contrato de aktiv-api (no se edita a mano)
  app/
    login/page.tsx
    invitacion/page.tsx          # pública: el alumno elige su contraseña desde el mail
    (app)/                       # navbar + guard de sesión
      dashboard/                 # profe
      alumnos/ y alumnos/[id]/   # profe: tabla y detalle con pestañas
      ejercicios/                # profe: lista de ejercicios (buscar, filtrar, crear, sacar)
      carreras/                  # profe (calendario) y alumno (mis carreras + calendario)
      certificados/              # profe
      mi-plan/ mis-marcas/ mi-ficha/   # alumno
  components/                    # ui/ (shadcn) + pantallas
  lib/
    schemas/index.ts   # re-exporta @aktiv/contrato
    types.ts           # re-exporta los tipos inferidos
    api.ts             # cliente HTTP: cookies, CSRF, renovación de sesión, errores
    remoto.ts          # sincronización por diferencias contra los endpoints REST
    store.ts           # estado en memoria + mutaciones; valida con los DTOs
    dominio.ts         # reglas puras: catálogo base de ejercicios, distancias, estado del certificado
    format.ts          # fechas, tiempos (parseTiempo/formatTiempo/formatRitmo), uuid
    guards.ts          # useRol("coach" | "alumno")
scripts/contrato.mjs     # contrato:sync / contrato:check contra ../aktiv-api
```

## Contrato de datos

El contrato (esquemas Zod, DTOs y tipos) **nace en `../aktiv-api/contrato`**. Acá hay una copia en `src/contrato` para que esta carpeta se compile sola (Vercel):

```powershell
npm run contrato:sync     # trae el contrato desde ../aktiv-api
npm run contrato:check    # falla si la copia no coincide
```

Flujo de un dato: formulario (recorta y valida con el DTO con `validar(dto, datos)`) → store (altas con `exigir`; ediciones mientras se escribe con `aceptar`, que descarta en silencio lo inválido) → `remoto.ts` manda **solo los campos que cambiaron** → la API valida con el DTO estricto, aplica permisos y escribe como el usuario → la base rechaza lo que viole un `CHECK`.

- **Los esquemas de entidad NO hacen `trim()`**: se aplican mientras alguien escribe. El recorte va en los formularios.
- Los ids de las altas los genera el **cliente** (UUID) para mostrar el dato al instante; la API responde 409 si ya existe.
- **Un campo nuevo** empieza en `aktiv-api` (contrato, DTO, migración, mapeo, tests). Después acá: `npm run contrato:sync`, el motor de diferencias de `remoto.ts`, el store y los formularios.

## Funcionalidad

### Login y navegación
- **Email + contraseña** (Supabase Auth, a través de la API). El profe se crea con el script; los alumnos entran por **invitación por email**; **no hay registro público**.
- Navbar arriba (sticky), solo íconos en celular. **Profe:** Dashboard (casa), Alumnos, Ejercicios, Carreras, Certificados. **Alumno:** Mi plan, Marcas, Carreras, Ficha.
- Cada rol solo puede entrar a sus pantallas.

### Profe
- **Dashboard** (deliberadamente simple, **no agregarle más tarjetas**): "Hola, {nombre}!", métricas (activos con barra, inactivos, pagos próximos, pagos vencidos), lista de alumnos con "Ver todos" y "Próximos pagos".
- **Alumnos:** DataTable con búsqueda, filtros (estado, nivel, pagos), orden, paginación, filas clickeables. "Nuevo alumno".
- **Detalle del alumno**, con pestañas **Resumen · Ficha médica · Marcas · Carreras** (la de ficha muestra un punto de aviso si el certificado falta, está vencido o por vencer):
  - *Resumen:* cabecera, **Estado** (switch) y **Próximo pago** (+ "Registrar pago" suma **un mes de calendario**: desde la fecha de pago si todavía no venció, o desde hoy si ya venció o no había; el 31 de enero pasa al 28 de febrero), **Semana de entrenamiento** (7 días × correr/fuerza), **"Lesiones o apuntes"** (privado del profe) y **Plan**.
  - *Plan:* cada plan es de **Running** o de **Fuerza** (selector arriba); por tipo puede haber varios, pero **uno activo** (el que ve el alumno); el primero que se crea queda activo y activar otro desactiva el anterior del mismo tipo. El combobox de ejercicios se filtra por tipo (running: series y ritmo, técnica, movilidad; fuerza: fuerza, movilidad). Series, repeticiones (texto libre) y **peso en kg** (en un plan de **Fuerza** lo tienen todos los ejercicios, sea cual sea su categoría; en un plan de running, solo los ejercicios de categoría Fuerza; ver `admitePeso` en `dominio.ts`). Cada ejercicio lleva también **descanso** entre series (texto libre: "60 s", "2 min"), entre repeticiones y peso; el alumno lo ve pero no lo edita. Cada plan se arma en **bloques**: *Calentamiento* (movilidad, activación, técnica), *Entrenamiento* (lo principal) y *Enfriamiento* (enfriamiento y estiramiento), cada uno con su botón "Agregar"; los dos opcionales pueden quedar vacíos.
  - *Carreras:* las carreras del alumno y **"Asignar a una carrera"**: elige una carrera **ya creada**, la **distancia** (entre las que ofrece esa carrera) y un tiempo objetivo opcional. Puede cambiar la distancia, quitarlo de la carrera y anotar el resultado (el alumno puede hacer lo mismo con las suyas).
  - *Acceso (debajo del nombre):* solo aparece si el alumno todavía no entró: **Reenviar invitación** y **Copiar credenciales** (contraseña aleatoria que se copia en un mensaje para WhatsApp; se muestra una sola vez). Con el acceso confirmado no se muestra nada.
- **Carreras** (página aparte, **calendario del profe**): se carga la carrera **una vez** con **nombre, fecha, ubicación, kms disponibles y notas**. Próximas / pasadas, editar, eliminar. **No se muestran nombres de alumnos bajo cada carrera**: solo "N alumnos anotados" y, al tocar, la lista. No se puede sacar una distancia que ya eligió algún alumno.
- **Ejercicios** (página aparte): la lista de ejercicios (base + los del profe) agrupada por categoría, con **búsqueda**, filtro por categoría, **Nuevo ejercicio** (nombre + categoría), **editar** los propios (renombrar o cambiar de categoría; los planes que lo usan se renombran también) y sacarlos (los planes que ya lo usan lo conservan). Los 27 base vienen en el código y no se editan. Al armar un plan se buscan y eligen de esa lista; si no está, se crea al vuelo eligiendo la categoría.
- **Certificados** (página aparte): resumen (vigentes, por vencer, vencidos, sin cargar), filtro por estado, ordenado por urgencia, abre el archivo y muestra el **contacto familiar** (teléfono con link para llamar).

### Alumno
- **Mi plan:** saludo, próxima carrera, próximo pago, aviso si el certificado falta/vence, **Mi semana** (solo lectura), el **plan activo de cada tipo** (una tarjeta "Plan de running" y otra "Plan de fuerza"), cada una dividida en sus bloques en orden (solo los que tienen ejercicios), **peso usado** por ejercicio de fuerza y **Mis notas**.
- **Marcas:** mejores marcas por distancia (con ritmo, fecha y carrera), historial con filtro y badge "MEJOR", alta/edición/baja.
- **Carreras:** **Mis carreras** (puede **anotarse** a una del calendario de su profe, cambiar la distancia, editar su objetivo, anotar su resultado y **salirse**; no puede crear ni editar las carreras del calendario) y **Calendario** (todas las del profe, marcando "Vas a correr 10K").
- **Ficha:** completa lo mismo que ve el profe.

### Ficha médica (profe y alumno la completan)
- **Datos personales:** fecha de nacimiento (muestra la edad), lugar de nacimiento, enfermedades y condiciones.
- (Las **lesiones** ya no están en la ficha: el dato sigue en el contrato y la API, pero no hay pantalla; el profe anota lesiones y molestias en "Lesiones o apuntes".)
- **Certificado médico:** PDF o imagen, **hasta 5 MB**, con **vista previa dentro de la tarjeta** (imagen o PDF en un visor embebido, con URL firmada de 2 min) y **fecha de vencimiento** editable (por defecto +1 año). La tarjeta ocupa las dos filas de la derecha; a la izquierda van Datos personales y Contacto familiar. Estado: `vigente`, `por-vencer` (≤ 30 días), `vencido`, `sin-certificado`.
- **Contacto familiar (opcional):** nombre, parentesco y teléfono.

### Marcas y carreras
- Marca = distancia + tiempo + **fecha (día)** + **carrera**. La mejor de cada distancia es la de menor tiempo. Tiempos como `mm:ss` o `h:mm:ss`; ritmo en min/km. Distancias: 1K, 3K, 5K, 10K, 15K, 21K (21,097), 42K (42,195) u "otra" en km.
- **Carrera** (calendario del profe) ≠ **inscripción** (un alumno en una carrera, con su distancia, objetivo y resultado). "Anotar resultado" aparece si la fecha ya llegó y puede sumar la marca al alumno.

## Puesta en marcha

### Variables de entorno
| Archivo (en `aktiv-client/`) | Contenido |
|---|---|
| `.env.local` | `API_URL` (dónde corre la API; en desarrollo `http://localhost:4000`). Los `rewrites` la fijan **al compilar**. |

### Desarrollo
```powershell
# 1) API y Supabase local: ver ../aktiv-api/CLAUDE.md
cd aktiv-client
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

### Despliegue en Vercel
- *Add New → Project* → elegir el repo → **Root Directory: `aktiv-client`**.
- Variable `API_URL=https://<servicio>.onrender.com` (sin barra final), **antes** del primer build (si se cambia, hay que volver a desplegar).
- Después, en Render, poner en `WEB_ORIGIN` la URL real de Vercel (https, sin barra final).

### Comandos (desde `aktiv-client/`)
```powershell
npm run dev
npm run build          # debe pasar sin errores antes de dar algo por terminado
npm run typecheck      # (la primera vez, después de un build: Next genera tipos en .next/)
npm test               # tests del frontend (tiempos, fechas, dominio)
npm run lint
npm run contrato:check
```

### Cómo se verifica
No alcanza con que compile. Se prueba en un navegador real, en **escritorio y celular** (390 px), con capturas y consola (Playwright con Edge, instalado **fuera del repo**), con Supabase local + `aktiv-api` + este frontend: credenciales malas, crear datos, **recargar y ver que persisten**, renovación de sesión, rol alumno y el flujo de invitación.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Frontend ↔ API | Por proxy (`rewrites`): el navegador no ve la API; cookies httpOnly del dominio del frontend. |
| Contrato | Copia sincronizada desde `aktiv-api` (cada carpeta se despliega sola). |
| Validación | Formularios (Zod) → store → API → base. |
| Carreras | Calendario del profe + inscripciones por alumno (el profe asigna desde el perfil del alumno). |
| Catálogo de ejercicios | Base en `dominio.ts`; los que agrega el profe, con categoría, desde la página **Ejercicios**. Repeticiones: texto libre (`10-12`, `30 s`, `400 m`, `al fallo`). |
| Dashboard | Deliberadamente simple: lo nuevo va en páginas aparte y en el menú. |

## Pendiente / próximos pasos
1. El isotipo (`logo.tsx`, `icon.svg`, `apple-icon.png`) está **vectorizado a partir de la imagen original** del logo (un solo polígono, calza casi pixel por pixel). Si aparece el SVG oficial, reemplazar el `d` del path.
2. Sumar Playwright como dependencia de desarrollo (hoy los tests de navegador viven fuera del repo).
3. Plantillas de plan reutilizables (hoy cada plan se arma de cero).

## Reglas de trabajo para Claude
- Responder en español rioplatense, directo y sin relleno.
- No hacer `git commit` / `push` sin que Andrés lo pida.
- Antes de dar algo por terminado: `npm run typecheck`, `npm test`, `npm run build`; si toca UI o datos, verificación en navegador en escritorio y celular.
- No editar `src/contrato` a mano (se sincroniza desde `aktiv-api`).
- No tocar `src/components/ui/*` a mano salvo que sea imprescindible; para agregar componentes usar el CLI de shadcn.
- El dashboard del profe se mantiene simple.
- **Los puertos 3000 y 4000 son del usuario** (su `next dev` y su API): nunca matar procesos ahí ni dejar mis servidores en esos puertos. Para pruebas usar la API en el **4100** (`PORT=4100`) y el frontend en el **3101**, compilado con `API_URL=http://localhost:4100`, y al terminar apagar **solo** esos dos (por PID o por puerto 3101/4100).
