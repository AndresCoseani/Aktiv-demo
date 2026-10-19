# Aktiv API (NestJS + Supabase)

API REST de **Aktiv**, el sistema web del club de running y entrenamiento integral del profe **Lucas**. Esta carpeta (`aktiv-api/`) es el backend; el frontend está en `../aktiv-client/`. Contexto general y reglas comunes: `../CLAUDE.md`.

- **Idioma:** dominio en **español rioplatense** (`alumno`, `plan`, `ejercicio`, `semana`, `marca`, `carrera`, `inscripcion`); términos técnicos en inglés. Los mensajes de error van en español, listos para mostrar.

## Arquitectura

```
Navegador ──► Next.js (aktiv-client) ──/api/*──► NestJS (esta carpeta) ──► Supabase (Postgres + Auth + Storage)
                 rewrites, mismo origen            valida, autoriza          RLS + triggers + CHECK
```

- La API autentica con Supabase Auth, valida cada pedido con el **contrato** (Zod), aplica permisos por rol y accede a la base **como el usuario** (con su token): las políticas **RLS, triggers y CHECK de la base siguen valiendo** aunque la API tuviera un bug. **Única excepción:** el módulo de invitaciones/cuentas usa la clave `service_role` (crear/borrar la cuenta de un alumno y consumir el enlace de invitación), siempre **después** de comprobar que el profe es dueño del alumno (ver "Invitaciones").
- El frontend no habla con Supabase ni necesita ninguna clave suya.
- **No hay datos de ejemplo**: lo que se ve es lo que hay en la base.

### Estado de verificación
Probado contra una instancia **local** de Supabase (Docker): **18 tests unitarios y 80 e2e de la API**, **19 tests del contrato**, **149 verificaciones de RLS/CHECK/storage en la base** y flujos completos en navegador (Next → NestJS → Supabase) en escritorio y celular. **Todavía no se corrió nada contra el proyecto Supabase real del usuario ni se mandó un mail real con Resend** (en local los mails salen por la consola de la API).

## Stack

| Cosa | Detalle |
|---|---|
| API | **NestJS 11**, Express 5, `helmet`, `cookie-parser`, `@nestjs/throttler` |
| Datos | **Supabase**: Postgres + Auth + Storage, con `@supabase/supabase-js` |
| Contrato | **Zod 4** en `contrato/` (esquemas, DTOs y tipos compartidos con el frontend) |
| Tests | **Jest + supertest** (API), **Vitest** (contrato) |
| Workspaces | npm workspaces: la raíz de esta carpeta (API) y `contrato/` |

En scripts de shell con muchos strings y comillas, escribir el parche en un archivo y ejecutarlo (los `node -e '...'` largos se rompen y pierden las barras invertidas).

## Estructura

```
contrato/src/              # CONTRATO DE DATOS (Zod): entidades, DTOs de formularios y de la API (+ tests)
src/
  main.ts  app.factory.ts  app.module.ts
  config/env.ts            # variables de entorno validadas al arrancar
  auth/                    # login, refresh, logout, guards (auth, roles, CSRF), cookies
  common/                  # errores, filtro global, pipe Zod, helpers de base
  supabase/                # cliente anónimo, cliente "del usuario" y admin (service_role, acotado)
  datos/                   # GET /datos + mapeo filas ⇄ dominio (filas.ts, mapeo.ts)
  alumnos/ planes/ carreras/ certificados/ health/
  cuentas/ invitaciones/ mail/   # alta de cuentas por invitación (service_role + Resend)
test/                      # e2e contra Supabase local (api.e2e-spec.ts, invitaciones.e2e-spec.ts)
supabase/                  # config local + migraciones (5)
scripts/
  crear-usuarios.mjs       # crea a Lucas y a Andres (service_role, solo en tu compu)
  probar-seguridad.mjs     # 149 verificaciones de RLS, storage, CHECK e invitaciones (solo base local)
render.yaml                # (en la raíz del repo) blueprint de Render con rootDir aktiv-api
```

## Contrato de datos (fuente única de verdad)

`contrato/` (paquete `@aktiv/contrato`) define **un esquema Zod por entidad**. De ahí salen:

| Pieza | Qué es | Dónde se usa |
|---|---|---|
| **Entidad** (`alumnoSchema`, `planSchema`, `carreraSchema`…) | forma completa de una cosa, con sus límites | los **tipos** de TypeScript y la validación de lo que **sale de la API** |
| **DTO de formulario** (`crearAlumnoDto`, `crearCarreraDto`, `inscribirAlumnoDto(kms)`, `loginDto`…) | lo que se acepta al crear o editar | los **formularios** (`validar(dto, datos)` → mensaje en español) y el **store** del frontend |
| **DTO de la API** (`api.ts`: `altaAlumnoApi`, `parcheAlumnoProfeApi`, `parcheEjercicioAlumnoApi`…) | cuerpo de cada endpoint, **estricto** (claves desconocidas = 400) | la **API** valida con ellos y el frontend arma los pedidos |
| **Filas** (`src/datos/filas.ts`) | forma exacta de cada tabla (snake_case) | la API al leer de Supabase |

Flujo de un dato: formulario (recorta y valida con el DTO) → store (altas con `exigir`; ediciones mientras se escribe con `aceptar`, que descarta en silencio lo inválido) → `remoto.ts` manda **solo los campos que cambiaron** → la API valida con el DTO estricto, aplica permisos y escribe como el usuario → la base rechaza lo que viole un `CHECK`.

Reglas:
- **Los límites (`LIMITES` en `comunes.ts`) se repiten como `CHECK`** en `supabase/migrations/…_validaciones.sql`. Si cambiás uno, cambialo en los dos lados.
- **Los esquemas de entidad NO hacen `trim()`**: se aplican mientras alguien escribe. El recorte va en los formularios; la base valida con `length(trim(...))`.
- Las fechas "hasta hoy" toleran un día de más (zona horaria): en la base `current_date + 1`, en la API "hasta mañana".
- **Un campo nuevo** = esquema en el contrato + DTO de la API + migración (con su `CHECK`) + `filas.ts` y `mapeo.ts` + casos en los tests (`mapeo.spec.ts`, e2e, `probar-seguridad.mjs`) **y después** traer el contrato al frontend (`npm run contrato:sync` en `aktiv-client`) y ajustar `remoto.ts` y los formularios allá.
- Los ids de las altas los genera el **cliente** (UUID) para mostrar el dato al instante; la API responde 409 si ya existe.

**El contrato NACE acá** y el frontend usa una **copia** en `aktiv-client/src/contrato` (para que cada carpeta se pueda compilar sola en Render y en Vercel). Nunca se edita la copia: se cambia `contrato/src`, se corre `npm run contrato:sync` en `aktiv-client` y `npm run contrato:check` falla si quedaron distintos. La API usa la versión compilada (`npm run contrato` la genera; `build`, `test` y `typecheck` ya lo hacen).

## API (NestJS)

Todo bajo `/api`. Errores siempre con el mismo formato: `{ statusCode, codigo, mensaje, detalles?, requestId }` (el `codigo` es estable, el `mensaje` está en español y es seguro mostrarlo; nunca se filtran stack traces ni detalles de la base).

| Área | Endpoints |
|---|---|
| Salud (público) | `GET /health`, `GET /health/supabase` (sirve para probar la conexión **antes** de migrar) |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Carga | `GET /datos` (todo lo que el usuario puede ver, ya validado) |
| Alumnos | `POST /alumnos` (profe), `PATCH /alumnos/:id`, `DELETE /alumnos/:id` (profe; borra también sus archivos **y su cuenta de acceso**) |
| Invitaciones | `POST /alumnos/:id/invitar` (profe; crea la cuenta si falta y manda el mail), `GET /auth/invitacion/:token` (público; a quién pertenece el enlace), `POST /auth/invitacion/aceptar` (público; elige la contraseña y deja la sesión iniciada) |
| Ficha | `PATCH /alumnos/:id/ficha` |
| Lesiones | `POST /alumnos/:id/lesiones`, `PATCH/DELETE /lesiones/:id` |
| Marcas | `POST /alumnos/:id/marcas`, `PATCH/DELETE /marcas/:id` |
| Planes (profe) | `POST /alumnos/:id/planes`, `PATCH/DELETE /planes/:id` |
| Ejercicios | `POST /planes/:id/ejercicios` (profe), `PATCH /ejercicios/:id` (el alumno solo `peso`/`pesoFecha`), `DELETE /ejercicios/:id` (profe) |
| Carreras (profe) | `POST /carreras`, `PATCH/DELETE /carreras/:id` |
| Inscripciones | `POST /alumnos/:id/inscripciones` (profe), `PATCH /inscripciones/:id` (el alumno solo `objetivoSeg`/`resultadoSeg`), `DELETE` (profe) |
| Catálogo (profe) | `POST /catalogo/ejercicios` (`{id, nombre, categoria}`), `DELETE /catalogo/ejercicios/:id` |
| Certificado | `POST /alumnos/:id/certificado` (multipart, campo `archivo`), `GET …/url` (URL firmada de 2 min), `PATCH …` (vencimiento), `DELETE …` |

POST → 201 `{id}`, PATCH → 200 `{id}`, DELETE → 204. Un parche vacío es 400 `sin_cambios`.

### Seguridad de la API
- **Sesión:** `access token` y `refresh token` de Supabase viajan **solo en cookies httpOnly** (`aktiv_at` en `/`; `aktiv_rt` solo en `/api/auth`), `SameSite=Lax`, `Secure` en producción. JavaScript del navegador nunca los ve (verificado en el test de navegador). El cliente renueva la sesión solo si el access token venció.
- **Autenticación global** (`AuthGuard`): todo es privado salvo lo marcado `@Publico()`. El token se valida con Supabase (caché de 30 s) y el rol sale de `profiles`.
- **Autorización por rol** (`@Roles('coach')`) + **permisos por campo**: el alumno solo puede editar `notasAlumno`, el `peso` de sus ejercicios y el objetivo/resultado de su inscripción (lo demás → 403 `sin_permiso`). Además la base lo impone con RLS y triggers.
- **Sin filtrar existencia:** un recurso ajeno responde igual que uno inexistente (404).
- **CSRF:** los pedidos que modifican datos exigen el header `X-Requested-With: aktiv` y, si hay `Origin`, que esté en `WEB_ORIGIN`.
- **Límites:** `@nestjs/throttler` global (por IP) + **bloqueo de login por intentos fallidos** (IP + email, 8/min; mismo mensaje exista o no la cuenta). Está en memoria: si se escala a **varias instancias** hay que moverlo a Redis.
- **Validación:** DTOs estrictos (no se puede colar `coach_id`), ids UUID, cuerpo JSON ≤ 100 kb, topes de negocio (≤ 50 planes por alumno, ≤ 100 ejercicios por plan).
- **Certificados:** el tipo se detecta por la **firma real del archivo** (no por la extensión ni el Content-Type), ≤ 5 MB, solo PDF/JPG/PNG/WebP, bucket privado, URL firmada de 2 min. Un `.exe` renombrado a `.png` se rechaza (415).
- `helmet`, sin `x-powered-by`, `x-request-id` en cada respuesta y en los logs, `trust proxy` configurable.
- **`service_role` acotada:** solo la tocan `supabase/admin.service.ts` y `cuentas/` + `invitaciones/`, y únicamente tras verificar (con el token del profe, o sea con RLS) que el alumno es suyo. Si falta `SUPABASE_SERVICE_ROLE_KEY` la API arranca igual, pero no se puede invitar ni borrar cuentas. El resto de la API sigue sin poder ver nada que el usuario no vea.

### Invitaciones (cómo entra un alumno)
1. El profe da de alta al alumno (con email) y marca "Mandarle una invitación por email", o después usa **Invitar / Reenviar invitación** en su ficha.
2. La API crea la cuenta de Supabase Auth (sin contraseña usable), la vincula al alumno y manda un mail (Resend) con `APP_URL/invitacion?token=…`.
3. El token: 32 bytes aleatorios, **solo se guarda su hash SHA-256**, de un solo uso, vence en `INVITACION_DIAS` (7); los enlaces reemplazados se **invalidan** (no se borran: cuentan para el tope de `INVITACIONES_POR_HORA` = 5 por alumno). El profe puede ver el estado pero no el hash (permiso por columna).
4. El alumno abre el enlace (`/invitacion`, página pública con `Referrer-Policy: no-referrer`), elige una contraseña de **8+ caracteres** y queda con la sesión iniciada.
5. Estado de acceso en la ficha del profe: `sin_cuenta` → `invitado` → `activo` (o `invitacion_vencida`). Eliminar un alumno borra también su cuenta.
6. Sin `RESEND_API_KEY`/`MAIL_FROM`: en desarrollo el mail (con el enlace) se imprime en la consola de la API; en producción la invitación falla con 503 `mail_no_configurado`.

## Modelo de datos (Supabase, esquema `public`)

```
profiles          id (= auth.users.id), rol ('coach'|'alumno'), nombre, email
alumnos           id, coach_id → profiles, user_id → profiles (único, null si no tiene cuenta),
                  nombre, email, telefono, objetivo, nivel, activo, proximo_pago, alta_en,
                  plan_activo_id, semana (jsonb de 7), notas_profe, notas_alumno
planes            id, alumno_id, nombre, orden
plan_ejercicios   id, plan_id, orden, nombre, series, repeticiones, peso, peso_fecha
fichas_medicas    alumno_id (PK), fecha_nacimiento, lugar_nacimiento, enfermedades,
                  cert_ruta, cert_nombre, cert_tipo, cert_tamano, cert_subido_en, cert_vencimiento,
                  contacto_nombre, contacto_parentesco, contacto_telefono
lesiones          id, alumno_id, descripcion, fecha, estado
marcas            id, alumno_id, distancia_km, tiempo_seg, fecha, carrera
carreras          id, coach_id → profiles, nombre, fecha, lugar, distancias_km (numeric[]), notas
inscripciones     id, alumno_id, carrera_id, distancia_km, objetivo_seg, resultado_seg   # único (alumno, carrera)
ejercicios_custom id, coach_id, nombre, categoria  # el catálogo base vive en el código del frontend (dominio.ts)
storage: bucket privado `certificados`, rutas  <alumno_id>/<archivo>
```
Un trigger crea la ficha vacía al crear cada alumno. Otro valida que una inscripción sea del mismo profe que la carrera y que su distancia exista en esa carrera. Multi-profe desde el día 1.

## Seguridad de la base (obligatoria; no relajar sin probarlo)

- **RLS activado en todas las tablas**; `anon` no tiene permisos sobre nada. Las políticas usan funciones `security definer` con `search_path` vacío.
- Un **profe** ve y edita solo a **sus** alumnos y **sus** carreras. Un **alumno** ve solo lo suyo y el **calendario de su profe**, y **solo puede escribir**: `notas_alumno`, `peso`/`peso_fecha` de sus ejercicios, su ficha, lesiones, marcas y el **objetivo/resultado de su inscripción**. Lo imponen **triggers** en la base.
- **Validación en la base:** los `CHECK` de `…_validaciones.sql` (largos, formatos de email/teléfono/peso, rangos, fechas, certificado completo y de tipo/tamaño permitidos), probados saltándose la app. **La base es la defensa real**; los esquemas Zod y la API son las primeras barreras.
- **Datos médicos y certificados son sensibles:** bucket **privado**, nunca URLs públicas, URL firmada de 2 minutos. (Datos de salud: tratarlos con cuidado también por la ley argentina de datos personales.)
- **Registro público desactivado** (`[auth] enable_signup = false`). **Ojo:** dejar activo el proveedor de email (`[auth.email] enable_signup = true`); ponerlo en `false` apaga el login por email entero.
- La clave **`service_role`/secret** vive en `.env.seed` en tu compu (script de cuentas) y en las variables del **servicio de la API** (solo para el módulo de invitaciones). **Nunca** en el frontend, en `NEXT_PUBLIC_*`, en Vercel ni en git. Si se filtra, rotarla en Supabase.
- **Contraseñas:** Supabase Auth exige **al menos 6 caracteres** (no se puede bajar). `admin` (5) es imposible; para pruebas locales se usa `admin1`. Una clave tan débil **no debe usarse en un proyecto en internet con datos reales**: `crear-usuarios.mjs` pide `PERMITIR_CLAVES_DEBILES=true` para claves de menos de 8 fuera de la compu local.
- Cualquier tabla nueva debe nacer con RLS, políticas, `CHECK` y su caso en `probar-seguridad.mjs`.

## Cuentas de hoy

| Persona | Rol | Email |
|---|---|---|
| Lucas | profe (`coach`) | `lucasmamondez15@gmail.com` |
| Andres Coseani | alumno | `coseaniandres@gmail.com` (alumno de Lucas) |

Contraseña: `admin1` en local. Para el proyecto real, ver "Puesta en marcha" (elegir una de 8+ caracteres, o aceptar el riesgo a propósito). Las crea `npm run usuarios` (lee `.env.seed`).

## Puesta en marcha

### Variables de entorno (qué va dónde)

| Archivo (en `aktiv-api/`) | Quién lo usa | Contenido |
|---|---|---|
| `.env` | la API | `SUPABASE_URL`, **clave publishable/anon**, `SUPABASE_SERVICE_ROLE_KEY` (invitaciones), `RESEND_API_KEY`, `MAIL_FROM`, `WEB_ORIGIN`, `APP_URL`, `PORT`, `TRUST_PROXY` |
| `.env.seed` | `scripts/crear-usuarios.mjs` (solo tu compu) | `SUPABASE_URL`, **clave secret/service_role**, emails y contraseñas |
| `test/.env.test` | tests e2e y `test:db` (solo base **local**) | URL local + claves locales |

Todos están **fuera de git** (`.env*`); solo se versionan los `*.example`.

### Desarrollo local con Supabase (Docker)
```powershell
cd aktiv-api
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,supavisor,realtime,postgres-meta
npx supabase db reset                 # aplica las 5 migraciones desde cero
npm run usuarios                      # Lucas y Andres (con la URL local en .env.seed)
# .env → SUPABASE_URL=http://127.0.0.1:54321 y la clave publishable que imprime `supabase start`
npm run start:dev                     # API en http://localhost:4000
npx supabase stop
```

### Conectar el proyecto Supabase real (primera vez)
1. **Datos del proyecto** (Project Settings → API): la *Project URL* (`https://<ref>.supabase.co`), la clave **publishable** (`sb_publishable_…`) y la clave **secret** (`sb_secret_…`). La *connection string* **no hace falta**: la API no se conecta a Postgres directamente, usa la API de Supabase con el token del usuario.
2. **Migraciones**, en orden y sin editar: `20261019000000_esquema_inicial.sql`, `20261020000000_carreras_catalogo.sql` (se frena sola si `carreras` tuviera datos viejos), `20261021000000_validaciones.sql`, `20261022000000_invitaciones.sql`, `20261023000000_ejercicios_categoria.sql`. Opción A: pegar cada una en *SQL Editor*. Opción B (recomendada): `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`. Verificar en *Database → Tables* que todas muestran **RLS enabled**. Aplicar las migraciones **antes** de desplegar el código que las usa.
3. *Authentication → Sign In / Providers*: **desactivar "Allow new users to sign up"** y dejar el proveedor **Email activo**.
4. `.env.seed` desde `.env.seed.example` y `npm run usuarios`.
5. `.env` desde `.env.example` y `npm run start:dev`. Probar la conexión: `GET http://localhost:4000/api/health/supabase`.
6. Plan gratis de Supabase: 2 proyectos activos por organización y **pausa tras ~7 días sin actividad**.

### Despliegue en Render
`render.yaml` está en la **raíz del repo** y apunta a esta carpeta con `rootDir: aktiv-api` (plan gratis, región **Ohio**, la más cercana a Supabase `ca-central-1`).
1. Subir el código a GitHub (`git push` a `main`).
2. Render → *New → Blueprint* → elegir el repo (o *Manual sync* si el blueprint ya existe). Render pide: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (la **publishable**), `WEB_ORIGIN` (la URL del frontend en Vercel, https y sin barra final), `SUPABASE_SERVICE_ROLE_KEY` (la **secret**, solo para invitaciones), `RESEND_API_KEY` y `MAIL_FROM` (ej. `Aktiv <aktiv@tudominio.com>`, dominio verificado en Resend). Sin las tres últimas la API anda, pero no se puede invitar.
3. Build: `npm install --include=dev && npm run build` desde `aktiv-api/`; start: `node dist/main.js`. **`--include=dev` es obligatorio**: Render usa `NODE_ENV=production` y sin eso no instala `nest` ni `typescript`.
4. Probar: `https://<servicio>.onrender.com/api/health/supabase` → `{"estado":"ok"}`.

**Mantenerla despierta:** el plan gratis de Render duerme el servicio tras 15 min sin pedidos y el primer pedido tarda hasta ~1 min. Se arregla con un ping periódico a `/api/health/supabase` (de paso toca Supabase, que en el plan gratis se pausa tras ~7 días sin actividad). Usar un servicio externo gratis (**cron-job.org** o **UptimeRobot**), no GitHub Actions: en repos privados cada corrida se factura como 1 minuto. Las **750 horas gratis por mes** de Render se reparten entre TODOS los servicios gratis del mismo workspace: una API despierta 24/7 usa ~744.

**Cookies y proxies:** el navegador solo ve el dominio de Vercel (las cookies son de ese dominio, `Secure`). Delante de la API hay dos proxies (Vercel y Render), por eso `TRUST_PROXY=2`. Si en producción todos los usuarios parecieran compartir una IP (el bloqueo de login o el límite de pedidos se activaría de más), revisar ese valor.

### Comandos (desde `aktiv-api/`)
```powershell
npm run start:dev     # API con watch (compila el contrato antes)
npm run build         # contrato + API
npm run typecheck
npm test              # 18 unitarios de la API + 19 del contrato
npm run test:e2e      # 80 e2e (necesita Supabase local + test/.env.test)
npm run test:db       # 149 verificaciones de la base (solo local)
npm run usuarios      # crea/actualiza a Lucas y a Andres
```

### Cómo se verifica
No alcanza con que compile. Si se toca la API o el esquema: `typecheck`, `test`, `test:e2e` y `test:db`. Si se toca algo que ve el usuario, además se prueba el flujo en un navegador real (Playwright con Edge, instalado **fuera del repo**) con Supabase local + esta API + `aktiv-client`: credenciales malas, crear datos, **recargar y ver que persisten**, renovación de sesión, rol alumno, pedidos directos prohibidos e **invitación** (alta → enlace de la consola de la API → alumno elige contraseña → ve su plan → el profe lo elimina).

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Backend | **NestJS** (pedido explícito, tres veces): endpoints seguros y robustos entre el frontend y Supabase. |
| Acceso a la base | La API usa `supabase-js` **con el token del usuario**, no una conexión Postgres como `postgres`: así RLS/triggers/CHECK siguen valiendo (defensa en profundidad). Excepción acotada: `service_role` solo en el módulo de invitaciones/cuentas. |
| Auth | Supabase Auth, tokens en **cookies httpOnly**, el frontend por proxy (`rewrites`), CSRF por header + Origin. |
| Contrato | Paquete `@aktiv/contrato` (Zod) que **nace en esta carpeta**; el frontend usa una copia sincronizada. |
| Validación | Tres capas: formularios (Zod), API (DTOs estrictos), base (CHECK). |
| Esquema de la base | Lo manejan **solo** las migraciones de Supabase (`supabase/migrations`). No usar un segundo sistema de migraciones. |
| Cuentas | El profe lo crea el script (`service_role`, solo en tu compu); los alumnos entran por **invitación por email** (Resend). Sin registro público. |
| Catálogo de ejercicios | Base en el código del frontend; los que agrega el profe, en `ejercicios_custom` **con categoría**. El plan guarda el **nombre** del ejercicio. El alumno **lee** los ejercicios de su profe (RLS) para saber en cuáles anota peso. |
| Multi-profe | `coach_id` en cada alumno y carrera desde el principio. |

## Pendiente / próximos pasos

1. **Aplicar las 5 migraciones al Supabase real**, crear a Lucas y probar la conexión. Las migraciones 4 (`invitaciones`) y 5 (`ejercicios_categoria`) son nuevas: aplicarlas **antes** de desplegar el código nuevo.
2. **Probar Resend de verdad:** crear la API key, cargar `RESEND_API_KEY`, `MAIL_FROM` y `SUPABASE_SERVICE_ROLE_KEY` en Render e invitar a un alumno real.
3. **Rate limiting en Redis** si se escala a varias instancias de la API.
4. Supabase limita las consultas a 1.000 filas por pedido: si un profe supera ~1.000 filas en alguna tabla, paginar `GET /datos`.
5. Lint para esta carpeta (hoy solo tiene `tsc` y tests).
6. **Contraseña de Lucas en producción:** Supabase exige 6+; elegir una más fuerte que `admin1` antes de usar datos reales.

## Reglas de trabajo para Claude
- Responder en español rioplatense, directo y sin relleno.
- **No inventar credenciales ni mails reales.** Todo dato sensible va a `.env*` (ignorados por git; solo se versionan los `*.example` con placeholders).
- No hacer `git commit` / `push` sin que Andrés lo pida. No ejecutar nada contra el Supabase real sin que lo pida: las pruebas se hacen en el Supabase **local**.
- `probar-seguridad.mjs` y los e2e se niegan a correr contra una base que no sea local: no cambiar eso.
- Antes de dar algo por terminado: `npm run typecheck`, `npm test`, `npm run test:e2e` y, si toca el esquema, `npm run test:db`.
- Todo dato nuevo pasa por el **contrato** (ver la regla de "campo nuevo") y después se sincroniza el frontend.
- La API usa `service_role` **solo** en el módulo de invitaciones/cuentas y después de verificar la propiedad del alumno; nunca se conecta a Postgres como `postgres`. No sumar usos de `AdminService` fuera de ahí sin decirlo.
- Cualquier tabla nueva nace con RLS, políticas, `CHECK` y su caso en `probar-seguridad.mjs`.
- Hay un `next dev` del usuario que puede estar corriendo en el puerto 3000: no matarlo; para pruebas usar otro puerto (3100/3101). La API de prueba va en el 4000.
