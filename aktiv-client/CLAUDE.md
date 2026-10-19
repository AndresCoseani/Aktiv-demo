@AGENTS.md

# Aktiv Client (Next.js)

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
  - *Resumen:* cabecera, **Estado** (switch) y **Próximo pago** (+ "Registrar pago" suma 30 días), **Semana de entrenamiento** (7 días × correr/fuerza), **"Lesiones o apuntes"** (privado del profe) y **Plan**.
  - *Plan:* varios planes por alumno, uno **activo** (el que ve el alumno). Cada ejercicio con combobox sobre el catálogo (los 27 base + los que cree el profe, con su categoría), series, repeticiones (texto libre) y **peso en kg** (solo fuerza y ejercicios creados a mano).
  - *Carreras:* las carreras del alumno y **"Asignar a una carrera"**: elige una carrera **ya creada**, la **distancia** (entre las que ofrece esa carrera) y un tiempo objetivo opcional. Puede cambiar la distancia, quitarlo de la carrera y anotar el resultado.
- **Carreras** (página aparte, **calendario del profe**): se carga la carrera **una vez** con **nombre, fecha, ubicación, kms disponibles y notas**. Próximas / pasadas, editar, eliminar. **No se muestran nombres de alumnos bajo cada carrera**: solo "N alumnos anotados" y, al tocar, la lista. No se puede sacar una distancia que ya eligió algún alumno.
- **Ejercicios** (página aparte): la lista de ejercicios (base + los del profe) agrupada por categoría, con **búsqueda**, filtro por categoría, **Nuevo ejercicio** (nombre + categoría) y sacar los propios (los planes que ya lo usan lo conservan). Al armar un plan se buscan y eligen de esa lista; si no está, se crea al vuelo eligiendo la categoría.
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
1. Reemplazar el isotipo por el SVG oficial del logo.
2. Sumar Playwright como dependencia de desarrollo (hoy los tests de navegador viven fuera del repo).
3. Plantillas de plan reutilizables (hoy cada plan se arma de cero).

## Reglas de trabajo para Claude
- Responder en español rioplatense, directo y sin relleno.
- No hacer `git commit` / `push` sin que Andrés lo pida.
- Antes de dar algo por terminado: `npm run typecheck`, `npm test`, `npm run build`; si toca UI o datos, verificación en navegador en escritorio y celular.
- No editar `src/contrato` a mano (se sincroniza desde `aktiv-api`).
- No tocar `src/components/ui/*` a mano salvo que sea imprescindible; para agregar componentes usar el CLI de shadcn.
- El dashboard del profe se mantiene simple.
- Hay un `next dev` del usuario que puede estar corriendo en el puerto 3000: no matarlo; usar otro puerto (3100/3101) para pruebas.
