# Aktiv — sistema web para profesionales del deporte

Aktiv es un club de **running y entrenamiento integral**. El profe **Lucas** lleva el entrenamiento personalizado de cada alumno. El sistema le permite gestionar alumnos, pagos, planes, semana de entrenamiento, ficha médica, marcas y carreras, y le da a cada alumno una cuenta (por invitación por email) para ver su plan y completar sus datos.

Este repo tiene **dos carpetas**, cada una con su propio `package.json`, su `CLAUDE.md` y su despliegue:

| Carpeta | Qué es | Se despliega en | Documentación |
|---|---|---|---|
| [`aktiv-api/`](aktiv-api) | API **NestJS** + migraciones de Supabase + contrato de datos (Zod) | **Render** (`rootDir: aktiv-api`, ver `render.yaml`) | [`aktiv-api/CLAUDE.md`](aktiv-api/CLAUDE.md) |
| [`aktiv-client/`](aktiv-client) | Frontend **Next.js** (shadcn/Base UI) | **Vercel** (Root Directory: `aktiv-client`) | [`aktiv-client/CLAUDE.md`](aktiv-client/CLAUDE.md) |

Antes de tocar código, leer el `CLAUDE.md` de la carpeta donde se trabaja.

## Cómo encajan

```
Navegador ──► aktiv-client (Next) ──/api/*──► aktiv-api (NestJS) ──► Supabase (Postgres + Auth + Storage)
                rewrites, mismo origen          valida, autoriza        RLS + triggers + CHECK
```

- El navegador solo habla con el dominio del frontend; Next reenvía `/api/*` a la API (variable `API_URL` del cliente). Las cookies de sesión son httpOnly y del dominio del frontend.
- **El contrato de datos** (esquemas Zod, DTOs y tipos) **nace en `aktiv-api/contrato`**. El cliente usa una **copia** en `aktiv-client/src/contrato` (para que cada carpeta se compile sola): se actualiza con `npm run contrato:sync` en `aktiv-client` y `npm run contrato:check` falla si quedaron distintas. Nunca se edita la copia.
- La base la maneja **solo** `aktiv-api/supabase/migrations`.

## Reglas comunes
- Responder en español rioplatense, directo y sin relleno. El producto y el dominio van en español (voseo).
- **No hacer `git commit` / `push` sin que Andrés lo pida.** No ejecutar nada contra el Supabase **real** sin que lo pida: las pruebas se hacen con Supabase **local** (Docker).
- Los secretos van en `.env*` (ignorados por git; solo se versionan los `*.example`). Nunca inventar credenciales ni mails reales.
- Un cambio que cruza las dos carpetas (un campo nuevo, un endpoint) se hace **primero en `aktiv-api`** (contrato, DTO, migración, tests) y después se sincroniza el contrato en `aktiv-client`.
- Hay un `next dev` del usuario que puede estar corriendo en el puerto 3000: no matarlo; para pruebas usar otro puerto (3100/3101). La API de prueba va en el 4000.

## Estado y pendientes generales
1. **Aplicar las migraciones 4 y 5 al Supabase real** (SQL Editor o `npx supabase db push`) **antes** de desplegar el código nuevo de la API.
2. En Render: cargar `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` y `MAIL_FROM` y hacer *Manual sync* del blueprint (ahora usa `rootDir: aktiv-api`).
3. En Vercel: **Root Directory = `aktiv-client`** y `API_URL` apuntando a Render.
4. Probar Resend de verdad invitando a un alumno real (hasta ahora solo se probó con la consola de la API).
