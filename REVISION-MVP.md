# Revisión de Aktiv para la reunión del 3 de noviembre de 2026

Revisión del repositorio realizada el 2 de noviembre. Se leyeron los documentos Markdown del proyecto y se revisaron arquitectura, contrato, pantallas principales, persistencia, permisos, certificados, configuración de despliegue y cobertura de pruebas. Los estados históricos que dicen los documentos no se toman como pruebas ejecutadas hoy.

## Diagnóstico

El alcance principal del MVP ya está implementado en código. La prioridad para mañana es comprobar el recorrido real y el despliegue, resolver fallas reproducibles y preparar una demo. No conviene ampliar el alcance antes de validar eso.

No se puede declarar todavía un MVP completo validado: Supabase local no está disponible en el puerto 54321 y Docker no tiene su motor en ejecución. No se ejecutaron pruebas contra la base real, no se enviaron correos ni se modificó producción.

## Qué existe

| Área | Implementación encontrada | Límite o aclaración |
|---|---|---|
| Acceso | Login, cookies httpOnly, renovación, roles, cambio de contraseña | No hay registro público ni flujo visible de recuperación autónoma de contraseña |
| Alumnos | Alta, búsqueda, filtros, detalle, estado y eliminación | Confirmar permisos y persistencia con base operativa |
| Planes | Running y Fuerza, varios planes, uno activo por tipo, bloques, ejercicios, series, repeticiones, descanso y peso | Se arman manualmente; no hay plantillas reutilizables ni agenda de sesiones por fecha |
| Semana | Siete días con indicadores de correr y fuerza | Indica tipo de actividad; no vincula una sesión distinta a cada día |
| Marcas | Alta, edición, baja, historial y mejores tiempos por distancia | Validar entrada de tiempos y persistencia en la demo |
| Aptos médicos | Subir PDF/JPG/PNG/WebP hasta 5 MB, reemplazar, abrir, quitar, vencimiento y resumen de estados | El estado depende del archivo y la fecha; no existe una aprobación explícita del profe |
| Ficha médica | Datos personales, condiciones y contacto familiar | Ambos roles pueden completarla; lesiones estructuradas tienen API pero no pantalla |
| Carreras | Calendario, distancias, inscripción, objetivo y resultado; sumar resultado a marcas | Calendario administrado por el profe; alumno gestiona sus inscripciones |
| Pagos | Próximo vencimiento y acción de registrar pago que avanza la fecha | No es contabilidad: no guarda importe, medio ni historial de cobros |
| Catálogo | Ejercicios base y propios, categorías, búsqueda y edición | Los planes guardan el nombre del ejercicio |
| Acceso del alumno | Invitación por correo o entrega de credenciales aleatorias | Correo real y variables del despliegue pendientes de comprobar |

## Comprobaciones ejecutadas hoy

| Comprobación | Resultado |
|---|---|
| API: typecheck | Correcto |
| API: unitarios | 18/18 |
| Contrato: tests | 19/19 |
| API: build | Correcto |
| Cliente: contrato sincronizado | Correcto, 10 archivos |
| Cliente: tests | 9/9 |
| Cliente: typecheck | Correcto |
| Cliente: lint | Sin errores; advertencia de React Compiler por TanStack Table |
| Cliente: build | Correcto al repetir con acceso de red para Google Fonts |
| API e2e, RLS/storage y navegador con persistencia | Pendientes: requieren Supabase local operativo |

Los 91 e2e y 166 chequeos de base mencionados en CLAUDE.md son antecedentes documentados, no resultados de esta revisión. Los tests actuales del cliente cubren formato de tiempos y fechas; no prueban el motor de sincronización ni las pantallas.

## Hallazgos y prioridades

### P0: antes de dar la demo por lista

1. **Confirmar migraciones del ambiente de demo.** Hay nueve archivos de migración, hasta `20261027000000_plan_descanso.sql`. Los documentos se contradicen sobre cuáles ya se aplicaron; la guía de primera instalación incluso enumera solo hasta la 25. No asumir que producción tiene bloques y descanso. Una columna faltante puede impedir cargar `/datos`. Verificar el estado real antes de ejecutar cambios.
2. **Probar el recorrido con recarga.** Alta de alumno → plan con ejercicios → marca → certificado → cerrar sesión → ingresar como alumno. Recargar después de cada carga para distinguir el estado optimista de datos guardados.
3. **Confirmar el acceso del profe y un alumno de prueba.** El acceso por credenciales es una alternativa al correo, pero también requiere `SUPABASE_SERVICE_ROLE_KEY` en la API. No depender de configurar Resend durante la reunión.
4. **Verificar el despliegue concreto.** Frontend con `API_URL` correcto al compilar; API con `WEB_ORIGIN` del frontend, conexión a Supabase y claves necesarias. No se inspeccionaron cuentas de Vercel/Render ni su estado remoto.

### P1: riesgos de confiabilidad identificados en código

- **Guardado optimista sin confirmación general.** `store.ts` muestra el cambio inmediatamente y `remoto.ts` espera 600 ms para enviarlo. Algunos mensajes de éxito aparecen antes de la respuesta del servidor. Cerrar o recargar rápido puede perder el último cambio; el envío en `visibilitychange` no garantiza que el navegador lo termine. Prioridad: estado visible de guardado y protección al salir con cambios pendientes.
- **Fallo de sincronización absorbido.** `sincronizar()` captura el error y resuelve su promesa. Operaciones que esperan ese método, como invitar o subir un certificado de un alumno recién creado, pueden continuar aunque el alta haya fallado. Conviene propagar el resultado del guardado a esas acciones y cubrirlo con una prueba de fallo del alta.
- **Bajas de ejercicios y planes en paralelo.** Aunque el comentario dice “hijos antes que padres”, las promesas de ambas bajas se inician antes del mismo `Promise.all`. Al eliminar un plan con ejercicios, el borrado del padre puede adelantarse y el hijo responder 404 por el borrado en cascada. Secuenciar los grupos o dejar que el padre borre sus hijos. Es un riesgo por inspección; falta reproducirlo contra la base.
- **Carga global sin paginación.** `DatosService.cargar()` consulta cada tabla con `select('*')`. El límite de filas de Supabase puede truncar información, especialmente ejercicios de planes. No bloquea necesariamente una demo pequeña, pero revisar el volumen antes de cargar todos los alumnos del club.
- **Vista previa al reemplazar un certificado.** La clave de actualización usa nombre, tamaño y día de carga; un reemplazo con esos mismos valores no cambia la clave aunque cambie la ruta del archivo. Puede seguir mostrando el certificado anterior hasta remontar la pantalla. Usar la ruta como identidad del archivo.

### Después de la reunión

Plantillas o duplicación de planes, historial de pagos si se requiere, planificación por fecha, pruebas de navegador reproducibles dentro del repositorio y recuperación de acceso. Priorizar según el uso real que describa Lucas.

## Criterio de aceptación para mañana

- [ ] El profe entra desde la URL que se va a mostrar.
- [ ] Crea un alumno de prueba y sigue existiendo tras recargar.
- [ ] Crea un plan de running y otro de fuerza con ejercicios y descansos.
- [ ] Cambia el plan activo, recarga y el alumno ve el correcto de cada tipo.
- [ ] Carga una marca de 5 km en 24:35 y se conserva tras recargar.
- [ ] Sube un certificado de prueba, lo abre y cambia su vencimiento.
- [ ] El certificado aparece en el resumen y persiste tras recargar.
- [ ] El alumno entra, ve sus planes y puede completar su ficha.
- [ ] El alumno no puede administrar otros alumnos ni editar el plan del profe.
- [ ] El recorrido se puede realizar también en un ancho de celular.
- [ ] Hay un alumno de prueba precargado por si falla la conexión durante la reunión.

## Guion de demo, 10 a 15 minutos

1. Entrar como profe y mostrar alumnos y vencimientos.
2. Abrir un alumno de prueba; explicar su objetivo y semana.
3. Crear un plan, agregar ejercicios y marcarlo activo. Recargar.
4. Cargar una marca y mostrar tiempo y ritmo.
5. Subir un apto de prueba y mostrar vencimiento y resumen de certificados.
6. Entrar como alumno en otro perfil de navegador y mostrar qué ve y qué puede completar.
7. Mostrar carreras y control de próximo pago si queda tiempo.
8. Pedirle al profe que haga él mismo una tarea para observar dónde se traba.

Usar información ficticia para la demostración, especialmente en certificados y datos médicos.

## Preguntas para Lucas

- **Duración:** ¿siempre organizás bloques de cuatro semanas o usás seis, ocho, doce o más según el alumno/objetivo? ¿La duración la define una cantidad de semanas, fechas exactas o una carrera? Ver [preguntas ampliadas](INVESTIGACION-PLANIFICADORES.md).

1. ¿Cómo armás un plan hoy? Pedirle un ejemplo real: papel, Excel, PDF o mensaje.
2. ¿El alumno necesita una rutina general, sesiones por día, o planes por semana con fechas?
3. ¿Qué campos faltan para running: ritmo objetivo, zona, duración, distancia, percepción de esfuerzo?
4. ¿Reutilizás planes entre alumnos? ¿Qué cambiás de uno a otro?
5. ¿El apto se considera vigente al cargarlo o necesitás revisarlo y aprobarlo? ¿Qué vencimiento usás?
6. ¿Quién carga las marcas? ¿Contás también entrenamientos o solo competencias?
7. ¿Los pagos son mensuales? ¿Necesitás historial, importes y comprobantes, o solo recordatorio de vencimiento?
8. ¿El alumno debe poder anotarse solo a carreras o necesitás aprobarlo?
9. ¿Cuántos alumnos y profesores usarían la primera versión?
10. ¿Cuáles son las tres tareas que deberían reemplazar tu método actual desde el primer día?

Cerrar la reunión con alcance acordado, prioridades y una fecha de prueba con pocos alumnos. Registrar los pedidos nuevos separados de los errores encontrados.
