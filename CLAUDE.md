@AGENTS.md

# Aktiv — sistema web para profesionales del deporte

Aktiv es un club de **running y entrenamiento integral**. El profe **Lucas** lleva el entrenamiento personalizado de cada alumno. El sistema le permite gestionar alumnos, pagos, planes, semana de entrenamiento, ficha médica, marcas y carreras, y le da a cada alumno una cuenta para ver su plan y completar sus datos.

- **Idioma:** producto y dominio en **español rioplatense** (voseo: "Tocá", "Cargá", "Creá"). Los nombres de código del dominio también van en español (`alumno`, `plan`, `ejercicio`, `semana`, `marca`, `carrera`, `inscripcion`). Los términos técnicos quedan en inglés.
- **Tono de UI:** minimalista, limpio, sin ruido. Celular y PC por igual.

## Arquitectura

```
Navegador ──► Next.js (frontend) ──/api/*──► NestJS (API) ──► Supabase (Postgres + Auth + Storage)
                 rewrites, mismo origen        valida, autoriza       RLS + triggers + CHECK
```

- El navegador **solo habla con su propio origen**: Next reenvía `/api/*` a la API (`rewrites` en `next.config.ts`). Así las cookies de sesión son del mismo sitio y no hace falta CORS.
- La **API (NestJS)** autentica con Supabase Auth, valida cada pedido con el **contrato compartido** (Zod), aplica permisos por rol y accede a la base **como el usuario** (con su token): las políticas **RLS, triggers y CHECK de la base siguen valiendo** aunque la API tuviera un bug. **Nunca usa la clave `service_role`.**
- El frontend **ya no usa Supabase directamente** ni necesita ninguna clave de Supabase.
- **Dos modos de frontend**, según `NEXT_PUBLIC_MODO`:

| Modo | Cuándo | Datos | Para qué |
|---|---|---|---|
| **API** | `NEXT_PUBLIC_MODO=api` | Postgres real vía la API, login real, archivos en Storage | Producción y desarrollo serio |
| **Demo** | sin la variable | 14 alumnos falsos en `localStorage`, cuentas `admin/admin` y `alumno/alumno` | Mostrar el diseño sin backend |

El modo demo es **transitorio**: se elimina (`data.ts`, `CUENTAS`, botón "Restablecer datos demo", atajos del login) cuando el modo API esté en uso en todos lados.

### Estado de verificación
Probado contra una instancia **local** de Supabase (Docker): **27 tests unitarios del frontend/contrato**, **18 unitarios y 65 e2e de la API**, **134 verificaciones de RLS/CHECK/storage en la base** y flujos completos en navegador (Next → NestJS → Supabase) en escritorio y celular. **Todavía no se corrió nada contra el proyecto Supabase real del usuario** (ver "Puesta en marcha").

## Stack

| Cosa | Detalle |
|---|---|
| Frontend | Next.js **16.4** (App Router, Turbopack), React 19, Tailwind v4 |
| UI | **shadcn/ui estilo `base-nova`** → basado en **Base UI**, **no Radix** |
| Tabla | `@tanstack/react-table` **v8** (fijada; la v9 trae otra API y rompe) |
| API | **NestJS 11** (`backend/`), Express 5, `helmet`, `cookie-parser`, `@nestjs/throttler` |
| Datos | **Supabase**: Postgres + Auth + Storage, con `@supabase/supabase-js` (solo en la API y en los scripts) |
| Contrato | **Zod 4** en el paquete `@aktiv/contrato` (esquemas, DTOs y tipos compartidos) |
| Tests | **Vitest 5** (frontend y contrato), **Jest + supertest** (API) |
| Workspaces | npm workspaces: raíz (frontend), `packages/contrato`, `backend` |

### Cosas no obvias (leer antes de tocar el frontend)

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
- El frontend usa `@aktiv/contrato` **desde el código fuente** (alias en `tsconfig.json` y `vitest.config.mts`); la API usa la versión **compilada** (`npm run contrato` antes de compilar o testear la API).
- En scripts de shell con muchos strings y comillas, escribir el parche en un archivo y ejecutarlo (los `node -e '...'` largos se rompen y pierden las barras invertidas).

## Identidad visual

Sale del logo: isotipo "A" blanco en círculo negro, fondo negro azulado con **resplandor turquesa en la esquina inferior derecha**, lockup "ENTRENAMIENTO INTEGRAL" + "y RUNNING".

- Oscuro: fondo `oklch(0.145 0.022 245)`, primario turquesa `oklch(0.76 0.11 205)`. Claro: fondo casi blanco frío, primario `oklch(0.5 0.09 208)`.
- Semánticos: `success` (activo / vigente), `warning` (pago próximo, por vencer, fuerza), `destructive` (vencido).
- `src/components/logo.tsx`: el isotipo está **redibujado a mano** desde una miniatura. **Pendiente:** reemplazar por el SVG oficial.

## Estructura

```
packages/contrato/src/     # CONTRATO DE DATOS (Zod): entidades, DTOs de formularios y de la API
backend/                   # API NestJS
  src/
    main.ts  app.factory.ts  app.module.ts
    config/env.ts          # variables de entorno validadas al arrancar
    auth/                  # login, refresh, logout, guards (auth, roles, CSRF)
    common/                # errores, filtro global, pipe Zod, helpers de base
    supabase/              # cliente anónimo y cliente "del usuario"
    datos/                 # GET /datos + mapeo filas ⇄ dominio (filas.ts, mapeo.ts)
    alumnos/ planes/ carreras/ certificados/ health/
  test/                    # e2e contra Supabase local
src/                       # frontend
  app/
    login/page.tsx
    (app)/                      # navbar + guard de sesión
      dashboard/                # profe
      alumnos/ y alumnos/[id]/  # profe: tabla y detalle con pestañas
      carreras/                 # profe (calendario) y alumno (mis carreras + calendario)
      certificados/             # profe
      mi-plan/ mis-marcas/ mi-ficha/   # alumno
  components/                   # ui/ (shadcn) + pantallas
  lib/
    schemas/index.ts   # re-exporta @aktiv/contrato
    types.ts           # re-exporta los tipos inferidos
    api.ts             # cliente HTTP: cookies, CSRF, renovación de sesión, errores
    remoto.ts          # sincronización por diferencias contra los endpoints REST
    store.ts           # estado en memoria + mutaciones; valida con los DTOs
    modo.ts            # MODO_API
    dominio.ts         # reglas puras: catálogo de ejercicios, distancias, estado del certificado
    format.ts          # fechas, tiempos (parseTiempo/formatTiempo/formatRitmo), uuid
    data.ts            # SOLO DEMO: cuentas y semilla falsa
    guards.ts          # useRol("coach" | "alumno")
supabase/                # config local + migraciones (3)
scripts/
  crear-usuarios.mjs     # crea a Lucas y a Andres (service_role, solo en tu compu)
  probar-seguridad.mjs   # 134 verificaciones de RLS, storage y CHECK (solo base local)
```

## Contrato de datos (fuente única de verdad)

`packages/contrato` define **un esquema Zod por entidad**. De ahí salen:

| Pieza | Qué es | Dónde se usa |
|---|---|---|
| **Entidad** (`alumnoSchema`, `planSchema`, `carreraSchema`…) | forma completa de una cosa, con sus límites | los **tipos** de TypeScript y la validación de lo que **sale de la API** |
| **DTO de formulario** (`crearAlumnoDto`, `crearCarreraDto`, `inscribirAlumnoDto(kms)`, `loginDto`…) | lo que se acepta al crear o editar | los **formularios** (`validar(dto, datos)` → mensaje en español) y el **store** |
| **DTO de la API** (`api.ts`: `altaAlumnoApi`, `parcheAlumnoProfeApi`, `parcheEjercicioAlumnoApi`…) | cuerpo de cada endpoint, **estricto** (claves desconocidas = 400) | la **API** valida con ellos y el frontend arma los pedidos |
| **Filas** (`backend/src/datos/filas.ts`) | forma exacta de cada tabla (snake_case) | la API al leer de Supabase |

Flujo de un dato: formulario (recorta y valida con el DTO) → store (altas con `exigir`; ediciones mientras se escribe con `aceptar`, que descarta en silencio lo inválido) → `remoto.ts` manda **solo los campos que cambiaron** → la API valida con el DTO estricto, aplica permisos y escribe como el usuario → la base rechaza lo que viole un `CHECK`.

Reglas:
- **Los límites (`LIMITES` en `comunes.ts`) se repiten como `CHECK`** en `supabase/migrations/…_validaciones.sql`. Si cambiás uno, cambialo en los dos lados.
- **Los esquemas de entidad NO hacen `trim()`**: se aplican mientras alguien escribe. El recorte va en los formularios; la base valida con `length(trim(...))`.
- Las fechas "hasta hoy" toleran un día de más (zona horaria): en la base `current_date + 1`, en la API "hasta mañana".
- **Un campo nuevo** = esquema en el contrato + DTO de la API + migración (con su `CHECK`) + `filas.ts` y `mapeo.ts` de la API + el motor de diferencias de `remoto.ts` + casos en los tests (`mapeo.spec.ts`, e2e, `probar-seguridad.mjs`).
- Los ids de las altas los genera el **cliente** (UUID) para mostrar el dato al instante; la API responde 409 si ya existe.

## API (NestJS)

Todo bajo `/api`. Errores siempre con el mismo formato: `{ statusCode, codigo, mensaje, detalles?, requestId }` (el `codigo` es estable, el `mensaje` está en español y es seguro mostrarlo; nunca se filtran stack traces ni detalles de la base).

| Área | Endpoints |
|---|---|
| Salud (público) | `GET /health`, `GET /health/supabase` (sirve para probar la conexión **antes** de migrar) |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Carga | `GET /datos` (todo lo que el usuario puede ver, ya validado) |
| Alumnos | `POST /alumnos` (profe), `PATCH /alumnos/:id`, `DELETE /alumnos/:id` (profe; borra también sus archivos) |
| Ficha | `PATCH /alumnos/:id/ficha` |
| Lesiones | `POST /alumnos/:id/lesiones`, `PATCH/DELETE /lesiones/:id` |
| Marcas | `POST /alumnos/:id/marcas`, `PATCH/DELETE /marcas/:id` |
| Planes (profe) | `POST /alumnos/:id/planes`, `PATCH/DELETE /planes/:id` |
| Ejercicios | `POST /planes/:id/ejercicios` (profe), `PATCH /ejercicios/:id` (el alumno solo `peso`/`pesoFecha`), `DELETE /ejercicios/:id` (profe) |
| Carreras (profe) | `POST /carreras`, `PATCH/DELETE /carreras/:id` |
| Inscripciones | `POST /alumnos/:id/inscripciones` (profe), `PATCH /inscripciones/:id` (el alumno solo `objetivoSeg`/`resultadoSeg`), `DELETE` (profe) |
| Catálogo (profe) | `POST /catalogo/ejercicios`, `DELETE /catalogo/ejercicios/:id` |
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
- La API **no tiene la clave `service_role`**: aunque la comprometan, solo accede a lo que ese usuario puede ver.

## Funcionalidad

### Login y navegación
- **Email + contraseña** (Supabase Auth, a través de la API). Las cuentas las crea el script; **no hay registro público**. Modo demo: usuario + contraseña con atajos.
- Navbar arriba (sticky), solo íconos en celular. **Profe:** Dashboard (casa), Alumnos, Carreras, Certificados. **Alumno:** Mi plan, Marcas, Carreras, Ficha.
- Cada rol solo puede entrar a sus pantallas.

### Profe
- **Dashboard** (deliberadamente simple, **no agregarle más tarjetas**): "Hola, {nombre}!", métricas (activos con barra, inactivos, pagos próximos, pagos vencidos), lista de alumnos con "Ver todos" y "Próximos pagos".
- **Alumnos:** DataTable con búsqueda, filtros (estado, nivel, pagos), orden, paginación, filas clickeables. "Nuevo alumno".
- **Detalle del alumno**, con pestañas **Resumen · Ficha médica · Marcas · Carreras** (la de ficha muestra un punto de aviso si el certificado falta, está vencido o por vencer):
  - *Resumen:* cabecera, **Estado** (switch) y **Próximo pago** (+ "Registrar pago" suma 30 días), **Semana de entrenamiento** (7 días × correr/fuerza), **"Lesiones o apuntes"** (privado del profe) y **Plan**.
  - *Plan:* varios planes por alumno, uno **activo** (el que ve el alumno). Cada ejercicio con combobox sobre el catálogo (25 base + los que cree el profe con **"Crear «X»"**), series, repeticiones (texto libre) y **peso en kg** (solo fuerza y ejercicios creados a mano).
  - *Carreras:* las carreras del alumno y **"Asignar a una carrera"**: elige una carrera **ya creada**, la **distancia** (entre las que ofrece esa carrera) y un tiempo objetivo opcional. Puede cambiar la distancia, quitarlo de la carrera y anotar el resultado.
- **Carreras** (página aparte, **calendario del profe**): se carga la carrera **una vez** con **nombre, fecha, ubicación, kms disponibles y notas**. Próximas / pasadas, editar, eliminar. **No se muestran nombres de alumnos bajo cada carrera**: solo "N alumnos anotados" y, al tocar, la lista. No se puede sacar una distancia que ya eligió algún alumno.
- **Certificados** (página aparte): resumen (vigentes, por vencer, vencidos, sin cargar), filtro por estado, ordenado por urgencia, abre el archivo y muestra el **contacto familiar** (teléfono con link para llamar).

### Alumno
- **Mi plan:** saludo, próxima carrera, próximo pago, aviso si el certificado falta/vence, **Mi semana** (solo lectura), plan (tabs si hay varios), **peso usado** por ejercicio de fuerza y **Mis notas**.
- **Marcas:** mejores marcas por distancia (con ritmo, fecha y carrera), historial con filtro y badge "MEJOR", alta/edición/baja.
- **Carreras:** **Mis carreras** (las que el profe le asignó; puede editar su objetivo y anotar su resultado, no asignarse ni quitarse) y **Calendario** (todas las del profe, marcando "Vas a correr 10K").
- **Ficha:** completa lo mismo que ve el profe.

### Ficha médica (profe y alumno la completan)
- **Datos personales:** fecha de nacimiento (muestra la edad), lugar de nacimiento, enfermedades y condiciones.
- **Lesiones:** descripción, fecha y estado (activa / recuperada).
- **Certificado médico:** PDF o imagen, **hasta 5 MB**, con **fecha de vencimiento** editable (por defecto +1 año). Estado: `vigente`, `por-vencer` (≤ 30 días), `vencido`, `sin-certificado`.
- **Contacto familiar (opcional):** nombre, parentesco y teléfono.

### Marcas y carreras
- Marca = distancia + tiempo + **fecha (día)** + **carrera**. La mejor de cada distancia es la de menor tiempo. Tiempos como `mm:ss` o `h:mm:ss`; ritmo en min/km. Distancias: 1K, 3K, 5K, 10K, 15K, 21K (21,097), 42K (42,195) u "otra" en km.
- **Carrera** (calendario del profe) ≠ **inscripción** (un alumno en una carrera, con su distancia, objetivo y resultado). "Anotar resultado" aparece si la fecha ya llegó y puede sumar la marca al alumno.

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
ejercicios_custom id, coach_id, nombre            # el catálogo base vive en el código (dominio.ts)
storage: bucket privado `certificados`, rutas  <alumno_id>/<archivo>
```
Un trigger crea la ficha vacía al crear cada alumno. Otro valida que una inscripción sea del mismo profe que la carrera y que su distancia exista en esa carrera. Multi-profe desde el día 1.

## Seguridad de la base (obligatoria; no relajar sin probarlo)

- **RLS activado en todas las tablas**; `anon` no tiene permisos sobre nada. Las políticas usan funciones `security definer` con `search_path` vacío.
- Un **profe** ve y edita solo a **sus** alumnos y **sus** carreras. Un **alumno** ve solo lo suyo y el **calendario de su profe**, y **solo puede escribir**: `notas_alumno`, `peso`/`peso_fecha` de sus ejercicios, su ficha, lesiones, marcas y el **objetivo/resultado de su inscripción**. Lo imponen **triggers** en la base.
- **Validación en la base:** los `CHECK` de `…_validaciones.sql` (largos, formatos de email/teléfono/peso, rangos, fechas, certificado completo y de tipo/tamaño permitidos), probados saltándose la app. **La base es la defensa real**; los esquemas Zod y la API son las primeras barreras.
- **Datos médicos y certificados son sensibles:** bucket **privado**, nunca URLs públicas, URL firmada de 2 minutos. (Datos de salud: tratarlos con cuidado también por la ley argentina de datos personales.)
- **Registro público desactivado** (`[auth] enable_signup = false`). **Ojo:** dejar activo el proveedor de email (`[auth.email] enable_signup = true`); ponerlo en `false` apaga el login por email entero.
- La clave **`service_role`/secret** vive solo en `.env.seed` en tu compu (para el script de cuentas). **Nunca** en el frontend, en la API, en `NEXT_PUBLIC_*` ni en Vercel.
- **Contraseñas:** Supabase Auth exige **al menos 6 caracteres** (no se puede bajar). `admin` (5) es imposible; para pruebas locales se usa `admin1`. Una clave tan débil **no debe usarse en un proyecto en internet con datos reales**: `crear-usuarios.mjs` pide `PERMITIR_CLAVES_DEBILES=true` para claves de menos de 8 fuera de la compu local.
- Cualquier tabla nueva debe nacer con RLS, políticas, `CHECK` y su caso en `probar-seguridad.mjs`.

## Cuentas de hoy

| Persona | Rol | Email |
|---|---|---|
| Lucas | profe (`coach`) | `lucasmamondez15@gmail.com` |
| Andres Coseani | alumno | `coseaniandres@gmail.com` (alumno de Lucas) |

Contraseña: `admin1` en local. Para el proyecto real, ver "Puesta en marcha" (elegir una de 8+ caracteres, o aceptar el riesgo a propósito). Las crea `scripts/crear-usuarios.mjs` leyendo `.env.seed`.

## Puesta en marcha

### Variables de entorno (qué va dónde)

| Archivo | Quién lo usa | Contenido |
|---|---|---|
| `.env.seed` | `scripts/crear-usuarios.mjs` (solo tu compu) | `SUPABASE_URL`, **clave secret/service_role**, emails y contraseñas |
| `backend/.env` | la API | `SUPABASE_URL`, **clave publishable/anon**, `WEB_ORIGIN`, `PORT`, `TRUST_PROXY` |
| `.env.local` | el frontend (Next) | `NEXT_PUBLIC_MODO=api`, `API_URL` |
| `backend/test/.env.test` | tests e2e de la API (solo base **local**) | URL local + claves locales |

Todos están **fuera de git** (`.env*`); solo se versionan los `*.example`.

### Desarrollo local con Supabase (Docker)
```powershell
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,supavisor,realtime,postgres-meta
npx supabase db reset                              # aplica las 3 migraciones desde cero
node --env-file=.env.seed scripts/crear-usuarios.mjs   # Lucas y Andres (URL local en .env.seed)
# backend/.env → SUPABASE_URL=http://127.0.0.1:54321 y la clave publishable que imprime `supabase start`
npm run dev:api                                    # API en http://localhost:4000
npm run dev                                        # frontend en http://localhost:3000 (con .env.local en modo api)
npx supabase stop
```

### Conectar el proyecto Supabase real (primera vez)
1. **Datos del proyecto** (Project Settings → API): la *Project URL* (`https://<ref>.supabase.co`), la clave **publishable** (`sb_publishable_…`) y la clave **secret** (`sb_secret_…`). La *connection string* del botón *Connect* **no hace falta**: la API no se conecta a Postgres directamente, usa la API de Supabase con el token del usuario.
2. **Migraciones**, en orden y sin editar: `20261019000000_esquema_inicial.sql`, `20261020000000_carreras_catalogo.sql` (se frena sola si `carreras` tuviera datos viejos), `20261021000000_validaciones.sql`. Opción A: pegar cada una en *SQL Editor*. Opción B (recomendada): `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`. Verificar en *Database → Tables* que todas muestran **RLS enabled**.
3. *Authentication → Sign In / Providers*: **desactivar "Allow new users to sign up"** y dejar el proveedor **Email activo**.
4. `.env.seed` desde `.env.seed.example` (URL + clave **secret** + emails y contraseñas) y `node --env-file=.env.seed scripts/crear-usuarios.mjs`.
5. `backend/.env` desde `backend/.env.example` (URL + clave **publishable**) y `npm run dev:api`. Probar la conexión: `GET http://localhost:4000/api/health/supabase`.
6. `.env.local` desde `.env.example` y `npm run dev`. Entrar con las cuentas de Lucas y Andres.
7. **Producción (Render + Vercel):** ver "Despliegue" más abajo.
8. Plan gratis de Supabase: 2 proyectos activos por organización y **pausa tras ~7 días sin actividad**.

### Despliegue

**API en Render** (`render.yaml` en la raíz; plan gratis, región **Ohio**, la más cercana a Supabase `ca-central-1`):
1. Subir el código a GitHub (`git push` a `main`).
2. Render → *New → Blueprint* → elegir el repo. Render pide 3 valores: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (la **publishable**) y `WEB_ORIGIN` (la URL del frontend; si todavía no existe, poner una provisoria y corregirla después).
3. Build (probado en una copia limpia): `npm install --include=dev --workspace=@aktiv/contrato --workspace=@aktiv/backend && npm run build:api`. **`--include=dev` es obligatorio**: Render usa `NODE_ENV=production` y sin eso no instala `nest` ni `typescript`.
4. Probar: `https://<servicio>.onrender.com/api/health/supabase` → `{"estado":"ok"}`.

**Frontend en Vercel** (proyecto = raíz del repo): variables `NEXT_PUBLIC_MODO=api` y `API_URL=https://<servicio>.onrender.com` (sin barra final), **antes** del primer build. Después volver a Render y poner en `WEB_ORIGIN` la URL real de Vercel.

**Mantenerla despierta:** el plan gratis de Render duerme el servicio tras 15 min sin pedidos y el primer pedido tarda hasta ~1 min. Se arregla con un ping periódico a `/api/health/supabase` (de paso toca Supabase, que en el plan gratis se pausa tras ~7 días sin actividad). Usar un servicio externo gratis (**cron-job.org** o **UptimeRobot**), no GitHub Actions: en repos privados cada corrida se factura como 1 minuto y el cron agotaría la cuota. Ojo con las **750 horas gratis por mes que Render reparte entre TODOS los servicios gratis del mismo workspace**: una API despierta 24/7 usa ~744; si hay otra app gratis en el mismo workspace, limitar el ping al horario del club (por ejemplo 06:00–23:00).

**Cookies y proxies:** el navegador solo ve el dominio de Vercel (las cookies son de ese dominio, `Secure`). Delante de la API hay dos proxies (Vercel y Render), por eso `TRUST_PROXY=2`. Si en producción todos los usuarios parecieran compartir una IP (el bloqueo de login o el límite de pedidos se activaría de más), revisar ese valor.

### Comandos
```powershell
npm run dev            # frontend
npm run dev:api        # API (compila el contrato y arranca con watch)
npm run build          # frontend: debe pasar sin errores antes de dar algo por terminado
npm run build:api      # API
npm test               # 27 tests (esquemas, tiempos y fechas)
npm run test:api       # 65 e2e de la API (necesita Supabase local + backend/test/.env.test)
npm run test -w @aktiv/backend   # 18 unitarios de la API
npm run typecheck && npm run typecheck:api
npm run lint
node --env-file=.env.test scripts/probar-seguridad.mjs   # 134 verificaciones de la base (solo local)
```

### Cómo se verifica
No alcanza con que compile. Se prueba en un navegador real, en **escritorio y celular** (390 px), con capturas y consola (Playwright con Edge, instalado **fuera del repo**). Para el modo API: Supabase local + API + frontend, y el flujo completo (credenciales malas, crear datos, **recargar y ver que persisten**, renovación de sesión, rol alumno, pedidos directos prohibidos). Si se toca el esquema: `probar-seguridad.mjs` y los e2e de la API.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Backend | **NestJS** (pedido explícito, tres veces): endpoints seguros y robustos entre el frontend y Supabase. |
| Acceso a la base | La API usa `supabase-js` **con el token del usuario**, no una conexión Postgres como `postgres`: así RLS/triggers/CHECK siguen valiendo (defensa en profundidad). |
| Auth | Supabase Auth, tokens en **cookies httpOnly**, el frontend por proxy (`rewrites`), CSRF por header + Origin. |
| Contrato | Paquete compartido `@aktiv/contrato` (Zod): una sola definición para frontend y API. |
| Validación | Tres capas: formularios (Zod), API (DTOs estrictos), base (CHECK). |
| Esquema de la base | Lo manejan **solo** las migraciones de Supabase. No usar un segundo sistema de migraciones. |
| Cuentas | Las crea un script con `service_role`. Sin registro público. |
| Carreras | Calendario del profe + inscripciones por alumno. |
| Catálogo de ejercicios | Base en código (`dominio.ts`); los creados a mano en `ejercicios_custom`. El plan guarda el **nombre** del ejercicio. |
| Multi-profe | `coach_id` en cada alumno y carrera desde el principio. |

## Pendiente / próximos pasos

1. **Aplicar las 3 migraciones al Supabase real**, crear las cuentas y probar la conexión (ver arriba).
2. **Resend** (mails): invitación al alumno con un **link para crear su contraseña** (un solo uso, con vencimiento), no la contraseña en texto plano. Hace falta un **dominio propio verificado**. Plan gratis: 3.000 mails/mes y 100/día. Requiere un endpoint de la API que cree el usuario y lo vincule al alumno; hoy ese vínculo lo hace `crear-usuarios.mjs`. Como la API no tiene `service_role`, ese endpoint necesitará un mecanismo aparte (por ejemplo, una Edge Function de Supabase o un servicio mínimo con esa clave y superficie reducida).
3. **Desplegar la API** (Render / Railway / Fly) y conectar el frontend en Vercel.
4. **Eliminar el modo demo** cuando el modo API esté en uso en todos lados.
5. **Rate limiting en Redis** si se escala a varias instancias de la API.
6. Alta de alumno con cuenta desde la UI (hoy la cuenta de acceso se crea por script).
7. Reemplazar el isotipo por el SVG oficial del logo.
8. Supabase limita las consultas a 1.000 filas por pedido: si un profe supera ~1.000 filas en alguna tabla, paginar `GET /datos`.
9. Sumar Playwright como dependencia de desarrollo (hoy los tests de navegador viven fuera del repo).
10. Lint para `backend/` (hoy solo tiene `tsc` y tests).

## Preguntas abiertas
1. **Contraseña de las cuentas reales:** Supabase exige 6+. ¿Se usa `admin1` solo para pruebas y después se cambia, o se elige una más fuerte desde el principio?
2. ¿Dónde se aloja la API (Render / Railway / Fly)?
3. **Dominio** para Resend.

## Reglas de trabajo para Claude
- Responder en español rioplatense, directo y sin relleno.
- **No inventar credenciales ni mails reales.** Todo dato sensible va a `.env*` (ignorados por git; solo se versionan los `*.example` con placeholders).
- No hacer `git commit` / `push` sin que Andrés lo pida. No ejecutar nada contra el Supabase real sin que lo pida: las pruebas se hacen en el Supabase **local**.
- `probar-seguridad.mjs` y los e2e de la API se niegan a correr contra una base que no sea local: no cambiar eso.
- Antes de dar algo por terminado: `npm run typecheck`, `npm test`, `npm run build` y, si toca la API, `npm run typecheck:api` y `npm run test:api`; si toca UI o datos, verificación en navegador en escritorio y celular; si toca el esquema, `probar-seguridad.mjs`.
- Todo dato nuevo pasa por el **contrato** (ver la regla de "campo nuevo"). No agregar campos sueltos.
- La API **nunca** usa `service_role` ni se conecta a Postgres como `postgres`.
- No tocar `src/components/ui/*` a mano salvo que sea imprescindible; para agregar componentes usar el CLI de shadcn.
- El dashboard del profe se mantiene simple: lo nuevo va en páginas aparte y en el menú.
- Hay un `next dev` del usuario que puede estar corriendo en el puerto 3000: no matarlo; usar otro puerto (3100/3101) para pruebas. La API de prueba va en el 4000.
