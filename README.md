# Aktiv

**Reunión del 3 de noviembre:** [preguntas y acuerdos para Lucas](PREGUNTAS-LUCAS-2026-11-03.md).

**Seguimiento del trabajo:** [PASO-A-PASO.md](PASO-A-PASO.md) — paso activo, responsabilidades, comprobaciones y aprobaciones. La comparación de funcionalidades está en [HOJA-RUTA-AKTIV.md](HOJA-RUTA-AKTIV.md).

Sistema web del club de running y entrenamiento integral **Aktiv**: el profe gestiona alumnos, planes, pagos, ficha médica, marcas y carreras; cada alumno entra con su cuenta (por invitación por email) a ver su plan.

| Carpeta | Qué es |
|---|---|
| [`aktiv-api/`](aktiv-api) | API NestJS + Supabase (migraciones) + contrato de datos |
| [`aktiv-client/`](aktiv-client) | Frontend Next.js |

## Probarlo en tu compu

1. Supabase local y API: ver [`aktiv-api/CLAUDE.md`](aktiv-api/CLAUDE.md) → *Desarrollo local con Supabase*.
2. Frontend: ver [`aktiv-client/CLAUDE.md`](aktiv-client/CLAUDE.md) → *Desarrollo*.

## Despliegue

- **API → Render:** `render.yaml` (en esta carpeta) con `rootDir: aktiv-api`.
- **Frontend → Vercel:** Root Directory `aktiv-client`, variable `API_URL`.
