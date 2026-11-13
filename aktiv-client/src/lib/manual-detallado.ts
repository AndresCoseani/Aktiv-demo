export type PasoManual = { titulo: string; texto: string; imagen?: string; campos?: { nombre: string; detalle: string }[] };
export type GuiaManual = { id: string; categoria: string; titulo: string; descripcion: string; destino: string; pasos: PasoManual[]; nota: string };
const p = (titulo: string, texto: string, imagen?: string, campos?: [string, string][]): PasoManual => ({ titulo, texto, imagen, campos: campos?.map(([nombre, detalle]) => ({ nombre, detalle })) });
const g = (id: string, categoria: string, titulo: string, descripcion: string, destino: string, pasos: PasoManual[], nota: string): GuiaManual => ({ id, categoria, titulo, descripcion, destino, pasos, nota });

export const guias: GuiaManual[] = [
  g("planificacion-unificada", "Planes", "Planificar la semana desde la ficha del alumno", "Definir qué días entrena y completar la planificación de Fuerza o Running.", "/alumnos", [
    p("Abrí la ficha", "Entrá en Alumnos y pulsá el nombre. Resumen muestra la planificación directamente. El icono de información junto al nombre abre los datos de contacto y acceso.", "planificacion-ficha"),
    p("Usá la barra del plan", "El nombre enmarcado abre su edición. Crear día agrega una sesión de Fuerza y abre su modal. El switch activa o desactiva el plan; los iconos de marcador, copiar y papelera guardan como modelo, duplican o eliminan. Ver más planes permite elegir otro plan.", "planificacion-ficha"),
    p("Elegí la actividad de cada día", "En Semana, activá el día y elegí Fuerza o Running con sus iconos; apagalo si descansa. Fuerza se asigna a una sesión del plan. Running se completa con texto libre en cada semana. Las sugerencias están disponibles siempre; el volumen en km aparece cuando hay Running programado.", "planificacion-actividades"),
    p("Creá las sesiones de Fuerza", "Pulsá + Crear día en la barra. Se abre el mismo modal que se usa para editar. Cambiá su nombre arriba. La sesión nueva queda disponible para asignarla a los días; no se asigna sola.", "planificacion-crear"),
    p("Creá los bloques", "En el modal pulsá + Nuevo bloque, elegí Movilidad, Activación o Fuerza en Tipo de actividad y pulsá Crear. El + de cada bloque agrega un ejercicio. Buscalo o crealo desde su campo.", "planificacion-bloque"),
    p("Completá la semana", "El modal abre la semana actual; los botones Semana 1, Semana 2, etcétera permiten consultar las demás. Cargá series, repeticiones y descanso. Los ejercicios nuevos comienzan con 3×8 y 60 s. Podés escribir indicaciones libres en Repeticiones. Arrastrá el asa para mover ejercicios entre bloques; con las flechas del teclado podés ordenarlos. Indicaciones generales es opcional.", "planificacion-modal-profe"),
    p("Asigná o quitá un día de Fuerza", "Pulsá el nombre del día en la grilla para elegir una sesión del plan o copiar una desde un modelo. Para quitarla, abrí el mismo día y elegí Desasignar día de fuerza: la sesión y sus ejercicios se conservan.", "planificacion-rutina"),
    p("Organizá los bloques", "Usá las flechas del encabezado para subir o bajar un bloque. La papelera permite quitarlo con sus ejercicios; confirmá y pulsá Guardar cambios para aplicar la eliminación.", "planificacion-bloque"),
    p("Eliminá un día completo", "Abrí la rutina y pulsá Eliminar día. Al confirmar se borra la sesión de todas las semanas, junto con sus ejercicios, asignaciones y registros. Para conservarla y solo quitarla de la grilla, usá Desasignar día de fuerza.", "planificacion-modal-profe"),
    p("Cargá Running", "En los días con Running, pulsá la celda de la semana para abrir el detalle con el día y la semana elegidos. Escribí el entrenamiento completo; la vista previa tiene altura fija para no agrandar la grilla. Volumen admite los kilómetros totales manuales y Sugerencias texto libre. La app no calcula distancias a partir de abreviaturas.", "planificacion-grilla"),
    p("Duplicá un día de Running", "Guardá el texto, pulsá Duplicar día y marcá uno o varios destinos con Running activado. La app avisa si alguno ya tiene texto antes de reemplazarlo.", "planificacion-grilla"),
    p("Cerrá el modal", "Pulsá Guardar cambios antes de cerrar con la X o Escape. Si quedan cambios pendientes, podés guardarlos, descartarlos o seguir editando. Ante un error el borrador permanece y podés reintentar.", "planificacion-modal-profe"),
    p("Revisá la vista del alumno", "El alumno abre el mismo día en un modal de lectura. Puede marcarlo como realizado opcionalmente; si no lo hace no se muestra una advertencia ni se bloquea el plan.", "planificacion-modal-alumno"),
    p("Abrí la navegación móvil", "En celular, pulsá el botón de menú junto al logo. El panel lateral muestra los apartados con sus nombres. Elegí uno para navegar; se cierra al elegir una opción. También podés cerrarlo con la X o Escape.", "planificacion-menu-movil"),
    p("Desde el celular", "La grilla muestra una semana por vez. Usá el selector y las flechas para avanzar. En escritorio aparecen hasta cuatro semanas con sus rangos de fechas; los planes más largos se recorren por grupos.", "planificacion-movil"),
  ], "El plan organiza la semana; cada día puede tener Fuerza, Running o descanso. Running usa texto libre en la semana y no requiere una sesión de ejercicios."),

  g("primeros-pasos", "Primeros pasos", "Conocer las pantallas y empezar", "Dónde encontrar cada tarea y en qué orden preparar una cuenta y sus entrenamientos.", "/dashboard", [
    p("Entrá con tu cuenta de profesor", "Abrí Aktiv, escribí tu email y contraseña y pulsá Entrar. Si la olvidaste, elegí ¿Olvidaste tu contraseña? No crees otra cuenta para recuperar la existente.", "login"),
    p("Ubicá la navegación principal", "Dashboard reúne el resumen. Clases organiza los horarios y avisos de asistencia. Alumnos abre las fichas. Planes contiene modelos reutilizables. Ejercicios es tu catálogo. Carreras organiza eventos. Certificados permite revisar la documentación médica. En el celular, abrí el menú para encontrar estos mismos apartados.", "dashboard"),
    p("Incorporá a la persona", "Desde Dashboard, debajo del saludo, podés compartir el enlace de registro y aprobar su solicitud. Si preferís cargarla vos, entrá en Alumnos y elegí Nuevo alumno y prepará su acceso con DNI después.", "alumnos-lista"),
    p("Prepará la rutina", "Creá un plan desde su ficha o armá un modelo en Planes y asignale una copia. Revisá fechas, actividades, días, ejercicios y semanas antes de activarlo.", "alumno-planes"),
    p("Volvé al manual desde tu perfil", "Pulsá el círculo de tus iniciales y elegí Manual de uso. Buscá la acción que necesitás. Las capturas usan datos ficticios y las marcas celestes señalan dónde hacer clic; pulsá una imagen para ampliarla.", "perfil-menu"),
  ], "Este manual es exclusivo del profesor. El alumno ve sus propios datos, no las pantallas de gestión de otras personas."),

  g("registro-alumnos", "Alumnos", "Registrar alumnos y aprobar su acceso", "El recorrido del alumno y el tilde de aprobación desde tu cuenta.", "/dashboard", [
    p("Compartí el enlace", "Entrá en Dashboard y, debajo de Hola, tu nombre, pulsá Copiar enlace de registro en Solicitudes de alta. Pegalo en el mensaje que le enviarás a la persona. También puede abrir Aktiv y pulsar ¿Sos nuevo? Registrate en Aktiv, debajo de Entrar.", "dashboard-solicitudes"),
    p("El alumno completa sus tres datos", "Pedile que revise la escritura antes de continuar. No se le pide una ficha de entrenamiento.", "registro", [["Nombre completo", "Nombre y apellido para reconocerlo en tu lista."], ["Email", "Será el usuario para entrar y la dirección para recuperar una contraseña. Debe estar bien escrito."], ["DNI", "Sin puntos ni espacios, con 7 u 8 números. Será su contraseña inicial."]]),
    p("Pulsa Solicitar mi alta", "La cuenta se crea y queda pendiente. No tiene que verificar el email, abrir un correo, completar teléfono, objetivos ni ficha médica. Si ya tiene cuenta, debe volver a Entrar o recuperar su contraseña.", "registro"),
    p("Consultá las solicitudes", "En tu cuenta, volvé a Dashboard → Solicitudes de alta, debajo del saludo. Pulsá Actualizar si acaba de registrarse. Compará nombre, email y DNI con la persona que te pidió acceso.", "dashboard-solicitudes"),
    p("Aprobá una o todas", "Usá el tilde Aprobar de su fila. Aprobar todos procesa las solicitudes visibles de la lista. Esperá que termine: las aprobadas salen de pendientes; si alguna falla, queda para revisar y reintentar individualmente.", "dashboard-solicitudes"),
    p("Avisale que ya puede entrar", "Mandale: «Ya podés entrar con tu email y tu DNI sin puntos como contraseña inicial». La aprobación no manda un correo automático. Antes de que la apruebes, el login informa que su solicitud está pendiente.", "login"),
    p("Prepará los planes después", "Abrí su ficha y completá los entrenamientos cuando corresponda. La ficha médica no es requisito para iniciar sesión. El alumno podrá cambiar su contraseña desde Mi perfil → Cambiar contraseña.", "alumno-resumen"),
  ], "Las solicitudes no vencen y no tienen botón de rechazo. No se pide ningún identificador del profesor. Mensaje para compartir: «Entrá al enlace de registro de Aktiv, completá nombre, email y DNI sin puntos y pulsá Solicitar mi alta. No confirmes ningún correo. Avisame al terminar para aprobar tu acceso»."),

  g("crear-alumno", "Alumnos", "Crear un alumno manualmente", "Cargar la ficha desde tu cuenta y preparar el acceso.", "/alumnos", [
    p("Buscá antes de crear", "Entrá en Alumnos y escribí su nombre o email en Buscar alumnos. Si ya está en la lista, abrí esa ficha. No generes una segunda persona para cambiarle el plan o ayudarla con su acceso.", "alumnos-lista"),
    p("Pulsá Nuevo alumno", "El botón de la cabecera abre el formulario. Esta es la alternativa al registro propio: no hace falta usar los dos caminos para la misma persona.", "alumnos-lista"),
    p("Completá el formulario", "Revisá especialmente email y DNI si vas a preparar sus credenciales.", "alumno-nuevo", [["Nombre completo", "Identifica a la persona en las fichas y listas."], ["DNI", "Sin puntos; se utiliza como contraseña inicial al preparar el acceso."], ["Email", "El que va a escribir la persona al entrar."], ["Teléfono", "Su contacto, si lo tenés."], ["Objetivo", "Por ejemplo primer 10K. Puede definirse después."], ["Nivel", "Principiante, Intermedio o Avanzado según corresponda."]]),
    p("Confirmá Crear alumno", "Pulsá Crear alumno al final. Se abre la ficha nueva. Si hay un error, corregí el dato que indica el mensaje; no crees fichas repetidas para intentar resolverlo.", "alumno-nuevo"),
    p("Prepará su acceso con DNI", "En la cabecera de su ficha, usá Preparar acceso con DNI si todavía no tiene cuenta. Revisá el email y el DNI, confirmá y compartí el mensaje de acceso que ofrece la app.", "alumno-acceso"),
    p("Comprobá el estado del acceso", "Pulsá el icono de información junto al nombre y revisá que el modal indique Con acceso. Tener una ficha cargada y tener una cuenta preparada son cosas distintas. Prepará sus rutinas desde la grilla de Resumen.", "alumno-resumen"),
  ], "El alta manual no envía automáticamente una invitación por email. Compartí las instrucciones de acceso con la persona. Si se registró sola y está pendiente, usá Aprobar en vez de crear otra ficha."),

  g("editar-alumno", "Alumnos", "Consultar y actualizar la ficha del alumno", "Datos de acceso, estado y próximo pago.", "/alumnos", [
    p("Abrí la ficha correcta", "Entrá en Alumnos, buscá a la persona y pulsá su nombre. Comprobá nombre y email de la cabecera antes de modificar información.", "alumnos-lista"),
    p("Consultá contacto y acceso", "Pulsá el icono de información junto al nombre: abre el modal con email, teléfono, fecha de alta y objetivo. Las acciones de acceso están debajo. Cerralo con la X o Escape para volver a la grilla.", "alumno-informacion"),
    p("Revisá sus apartados", "Resumen muestra la planificación. Ficha permite actualizar salud y contacto de emergencia. Marcas registra tiempos. Carreras contiene sus inscripciones. Los datos de acceso, estado y próximo pago están en el icono de información junto al nombre.", "alumno-resumen"),
    p("Revisá Estado", "El switch junto al nivel es verde cuando está activo y rojo cuando está inactivo. Desactivarlo bloquea el inicio de sesión, la renovación y los nuevos pedidos de una sesión abierta. Esperá la confirmación del guardado; si falla, el estado no cambia. Los datos y planes se conservan. Reactivalo desde el mismo switch para que vuelva a ingresar con su contraseña habitual.", "alumno-resumen"),
    p("Controlá Próximo pago", "Revisá la fecha antes de pulsar Registrar pago. La acción mueve el próximo vencimiento un mes: desde la fecha vigente si todavía no venció, o desde hoy si ya pasó. No pulses varias veces por el mismo pago.", "alumno-resumen"),
    p("Para acceso, usá el formulario de credenciales", "Pulsá el icono de información junto al nombre. El modal muestra email, teléfono, fecha de alta y objetivo. Allí Preparar acceso con DNI o Restablecer acceso permite revisar email y DNI. Restablecer reemplaza la contraseña actual: no lo uses solamente para consultar o para editar las indicaciones de un plan.", "alumno-acceso"),
  ], "Los datos médicos se completan en Ficha y los planes en Resumen. Cambiar un estado, modificar un entrenamiento y restablecer una contraseña son acciones diferentes."),

  g("eliminar-alumno", "Alumnos", "Desactivar o eliminar un alumno", "Pausar conservando registros o quitar una ficha definitivamente.", "/alumnos", [
    p("Buscá y verificá la persona", "Entrá en Alumnos y abrí su ficha. Revisá nombre y email antes de actuar.", "alumno-resumen"),
    p("Si es una pausa, usá Estado", "Cambiá el switch junto al nivel de activo (verde) a inactivo (rojo). Se bloquea el acceso a la aplicación y se conservan la información, contraseña y planes. Reactivalo desde el mismo lugar para devolverle el acceso.", "alumno-resumen"),
    p("Si es definitivo, abrí Información del alumno", "Pulsá la i junto al nombre y luego Eliminar alumno dentro de ese modal. Se abre una confirmación con el nombre de la persona. Leela antes de continuar; no es el tacho de un ejercicio o un plan.", "alumno-eliminar"),
    p("Confirmá o cancelá", "Cancelar vuelve sin borrar. Eliminar quita la ficha y los datos asociados indicados por la app, incluida la cuenta vinculada cuando corresponda. Esperá el resultado y revisá cualquier error antes de reintentar.", "alumno-eliminar"),
  ], "No se puede deshacer la eliminación desde la app. Para retirar una rutina de la vista del alumno, usá Desactivar plan en lugar de eliminar a la persona."),

  g("recuperar-acceso", "Cuenta y acceso", "Recuperar una contraseña olvidada", "Recuperación por correo o restablecimiento al DNI desde tu cuenta.", "/alumnos", [
    p("Usá ¿Olvidaste tu contraseña?", "Desde el login, pulsá el enlace de recuperación. No hace falta crear otro usuario ni volver a registrarse.", "login"),
    p("Escribí el email de la cuenta", "Ingresá el mismo email con el que entra la persona y enviá la solicitud. Comprobá la escritura antes de continuar.", "recuperar"),
    p("Abrí el correo y elegí una nueva clave", "El alumno abre el mensaje, sigue el enlace y completa una contraseña nueva. Si no lo encuentra, revisa spam. Si el enlace dejó de funcionar, solicita otro y usa el más reciente.", "recuperar"),
    p("Para ayudar desde tu cuenta, abrí Restablecer acceso", "Entrá en Alumnos → ficha de la persona → icono de información → Restablecer acceso. Primero acordalo con ella, porque reemplaza la clave que estaba usando.", "alumno-acceso"),
    p("Revisá los datos y confirmá", "Comprobá email y DNI. Marcá la casilla que confirma el reemplazo de contraseña si aparece y confirmá el restablecimiento. Compartí las instrucciones de acceso; no pidas la clave personal por chat.", "alumno-acceso"),
    p("Probá entrar nuevamente", "La persona vuelve a Entrar con su email y la clave nueva, o el DNI si restableciste a ese valor. Si el alta sigue pendiente, todavía hay que aprobarla desde Dashboard → Solicitudes de alta.", "login"),
  ], "El registro no exige confirmar correo, pero la recuperación por email sí envía un mensaje con un enlace. Son procesos distintos."),

  g("cuenta", "Cuenta y acceso", "Cambiar la contraseña y cerrar sesión", "Usar las acciones del menú de perfil.", "/dashboard", [
    p("Abrí Mi perfil", "Pulsá el círculo con tus iniciales en la navegación. Se despliegan las acciones de tu cuenta y el acceso al manual del profesor.", "perfil-menu"),
    p("Elegí Cambiar contraseña", "Esta opción abre el formulario para tu cuenta. No cambia las claves de los alumnos.", "clave-cambiar"),
    p("Completá el formulario y confirmá", "Escribí las contraseñas que pide la pantalla, respetá las indicaciones y confirmá. Si aparece un error, corregí el campo indicado. Guardá la nueva clave en un lugar seguro.", "clave-cambiar"),
    p("Cerrá sesión si usaste un equipo ajeno", "Volvé a Mi perfil y elegí Cerrar sesión al terminar. La sesión se recuerda en el dispositivo: cerrar una pestaña no equivale a cerrar la cuenta.", "perfil-menu"),
  ], "La contraseña inicial puede cambiarse, pero no es obligatorio hacerlo para entrenar. El alumno no ve el manual de gestión del profesor."),

  g("modelos", "Planes", "Crear y asignar un plan modelo", "Preparar una base completa desde Planes y entregar una copia a un alumno.", "/planes", [
    p("Andá a Planes", "Pulsá Planes en la navegación. Esta página es tu biblioteca de rutinas modelo, todavía sin alumno. Buscá por nombre o actividad para comprobar si ya tenés una base que sirva.", "modelos-lista"),
    p("Hacé clic en Nuevo plan", "El botón de la cabecera abre Nuevo plan modelo. Como es una base reutilizable, no te pide una persona ni una fecha de comienzo.", "modelos-lista"),
    p("Cargá los datos del modelo", "Elegí un nombre, una actividad de rutina y la cantidad de sesiones disponibles. Running se selecciona después en los días de la semana y se completa con texto libre.", "modelo-nuevo", [["Nombre", "Por ejemplo Fuerza inicial o Movilidad suave."], ["Duración en semanas", "Cantidad de semanas de la progresión."], ["Actividad", "El modelo contiene sesiones de una actividad de rutina."], ["Sesiones", "Cantidad de entrenamientos disponibles para asignar manualmente a los días del alumno."]]),
    p("Confirmá Crear modelo", "Se abre el editor. Elegí la actividad y el Día que vas a cargar. Para volver a la biblioteca usá Todos los modelos después de guardar.", "modelo-editor"),
    p("Completá las rutinas", "Completá movilidad y activación, bloques, ejercicios, indicaciones y semanas. Pulsá Guardar cambios. La planificación semanal de Running se carga en el plan del alumno.", "editor-bloques"),
    p("Hacé clic en Asignar a alumno", "En el editor usá Asignar a alumno; en la biblioteca también está Asignar en cada fila. Se abre el formulario para crear una copia para una persona.", "modelo-asignar"),
    p("Elegí alumno, nombre, fecha y duración", "Buscá a la persona por nombre o email y seleccionála. Revisá el nombre de la copia, la fecha de inicio y cuántas semanas durará; el rango de fechas se actualiza con esos valores.", "modelo-asignar"),
    p("Elegí qué sesiones asignar", "Seleccioná manualmente qué sesiones del modelo van en cada día. Una sesión solo se puede elegir una vez; las restantes quedan disponibles en la copia. Running se agrega desde la planificación semanal del plan del alumno.", "modelo-asignar"),
    p("Revisá fechas, duración y activá", "La fecha y duración se eligen en el formulario y determinan las semanas de la copia. Abrí Alumnos → ficha → Resumen para revisar y editar. Si ya hay otro plan activo, elegí Reemplazar plan o Cancelar; el anterior queda como borrador y conserva sus datos.", "alumno-planes"),
  ], "Modelo y copias son independientes. Editar o eliminar el modelo no modifica los planes ya asignados. No se copian pesos personales ni registros de entrenamiento completado."),

  g("crear-plan", "Planes", "Crear un plan directamente para un alumno", "Armar la rutina desde su ficha, asignar sus días y publicarla.", "/alumnos", [
    p("Andá a Alumnos y abrí la ficha", "Buscá a la persona, pulsá su nombre y quedate en Resumen. Confirmá que sea el alumno correcto.", "alumno-resumen"),
    p("Hacé clic en Nuevo plan", "El botón está en Plan de entrenamiento, dentro de Resumen. El formulario crea una rutina para esa persona, a diferencia de Nuevo plan en la biblioteca de modelos.", "alumno-planes"),
    p("Completá el formulario", "Elegí nombre, actividad principal, fecha de inicio y duración. La actividad principal define las sesiones de rutina; Running se elige por día desde Semana y se completa con texto libre.", "plan-nuevo", [["Nombre del plan", "Por ejemplo Mes 2 o Base noviembre."], ["Duración en semanas", "Cantidad de semanas que tendrá el plan."], ["Fecha de inicio", "Desde esa fecha se calculan sus semanas en el calendario."], ["Actividad y sesiones", "Elegí la actividad de las rutinas y cuántas sesiones querés crear para distribuir durante la semana."]]),
    p("Prepará Fuerza", "En Semana, activá los días que entrenará y elegí el icono de Fuerza. Usá + Crear día para abrir una rutina nueva. En Días de fuerza de este plan podés abrir las rutinas existentes; pulsá el nombre del día en la grilla para asignar una o copiarla desde un modelo.", "planificacion-rutina"),
    p("Prepará Running", "En los días que corre, elegí el icono de Running. Pulsá cada celda semanal, escribí el entrenamiento en el modal y elegí Guardar cambios. Completá sugerencias; el volumen en km aparece si hay Running programado.", "planificacion-running-detalle"),
    p("Consultá sesiones anteriores", "Si el plan tiene sesiones antiguas de Running, abrí Sesiones anteriores de Running para revisarlas en solo lectura. Su contenido no se convierte automáticamente al texto libre.", "planificacion-running-detalle"),
    p("Revisá el plan y su estado", "Guardá los cambios de cada rutina. Al activar un plan, si ya existe otro activo, aparece la confirmación Reemplazar o Cancelar. El plan anterior se conserva como borrador con sus registros.", "planificacion-ficha"),
  ], "El plan puede combinar días de Fuerza, Running y descanso. Fuerza usa sesiones del modelo; Running se escribe por día y semana."),

  g("actividades", "Planes", "Elegir las actividades de la semana", "Combinar sesiones de Fuerza y días de Running dentro de la planificación del alumno.", "/alumnos", [
    p("Creá las rutinas de Fuerza", "Desde Planes creá modelos de sesiones reutilizables o agregá sesiones directamente al plan del alumno. Asignalas manualmente a los días de Fuerza.", "modelo-nuevo"),
    p("Elegí actividades día por día", "En Semana, usá los iconos para activar Fuerza o Running en cada día. Apagá el switch si descansa. Fuerza abre el selector de sesión; Running habilita el detalle semanal de texto libre.", "planificacion-actividades"),
    p("Usá sugerencias y volumen", "Sugerencias está disponible en todas las planificaciones. Volumen aparece cuando hay al menos un día de Running y permite cargar los kilómetros totales manualmente.", "planificacion-grilla"),
    p("Activá el plan", "Puede haber una planificación activa por alumno. Si activás otra, Aktiv ofrece Reemplazar o Cancelar.", "plan-activar"),
  ], "El plan organiza la semana; cada día define si corresponde Fuerza, Running o descanso."),
  g("editar-plan-datos", "Planes", "Editar el nombre, inicio y duración del plan", "Modificar la cabecera sin confundirla con la edición de un entrenamiento.", "/alumnos", [
    p("Seleccioná la rutina", "Abrí Alumnos → ficha → Resumen. Si tiene varias, elegí el nombre de la que vas a modificar y comprobá la cabecera.", "alumno-planes"),
    p("Abrí la edición del plan", "Pulsá el nombre enmarcado en la barra del plan. Los iconos de copiar y papelera permiten duplicarlo o eliminarlo.", "planificacion-ficha"),
    p("Modificá los campos", "En Editar plan revisá Nombre, Fecha de inicio y Duración en semanas. Cambiar el inicio cambia en qué fechas caen las semanas. Antes de reducir la duración, revisá el trabajo y los registros de las semanas que estás quitando.", "plan-editar"),
    p("Confirmá Guardar cambios", "Guardá y revisá nuevamente la cabecera y sus semanas. Si aparece un error, mantené abierto el formulario y corregí lo indicado; no des por aplicada la edición.", "plan-editar"),
  ], "Para modificar ejercicios entrá a cada sesión. Para cambiar una base de la biblioteca usá Editar modelo: una copia del alumno y un modelo son elementos independientes."),

  g("editar-plan", "Planes", "Editar un día de entrenamiento", "Abrir el modal, cambiar su nombre y completar los bloques.", "/alumnos", [
    p("Abrí el día", "En Resumen, pulsá el botón con el nombre del día en una celda de Fuerza. Crear día, en la barra del plan, permite crear otro.", "planificacion-rutina"),
    p("Editá el nombre", "Escribí directamente en el título del modal. Ese nombre identifica la rutina en la grilla y en el selector de asignación.", "planificacion-modal-profe"),
    p("Elegí la semana", "Al abrir se selecciona la semana actual. Pulsá otra semana para ver o editar sus indicaciones. Las series y repeticiones de los ejercicios del bloque se guardan en esa semana.", "planificacion-modal-profe"),
    p("Completá los bloques", "Nuevo bloque permite elegir Movilidad, Activación o Fuerza. El + de cada bloque agrega ejercicios; buscá el nombre en su campo. Cargá series, repeticiones y descanso.", "planificacion-bloque"),
    p("Guardá y cerrá", "Pulsá Guardar cambios. Ante un error, el borrador permanece y podés reintentar. Si cerrás con cambios pendientes, elegí Guardar y salir, Descartar o Seguir editando.", "planificacion-modal-profe"),
  ], "Cada sesión asignada al plan es una copia editable. Cambiarla no modifica el modelo original."),

  g("bloques", "Planes", "Crear bloques y agregar uno o varios ejercicios", "Separar grupos de trabajo y completar sus filas sin salir del editor.", "/planes", [
    p("Bajá a Entrenamiento", "Abrí el modelo o el plan del alumno, elegí la actividad y el Día y bajá después de Movilidad, Activación e Indicaciones generales.", "editor-bloques"),
    p("Hacé clic en Crear bloque", "Se agrega un grupo vacío. Un bloque puede contener uno o varios ejercicios: no tenés que crear un bloque nuevo para cada movimiento si los querés juntos.", "editor-bloques"),
    p("Dentro del bloque, pulsá Agregar ejercicio", "Usá el botón del bloque donde debe quedar la fila. Revisá el encabezado Bloque 1, Bloque 2, etcétera para no agregarlo en otro grupo.", "editor-bloques"),
    p("Buscá y elegí el ejercicio", "Pulsá Elegí o creá un ejercicio y escribí parte del nombre. Las coincidencias muestran nombre y categoría. Seleccioná el nombre correcto para cargarlo en esa fila.", "ejercicio-buscar-en-plan"),
    p("Escribí semanas y descanso", "Completá las indicaciones en las celdas semanales que necesites. Los ejercicios nuevos empiezan con 3×8 en cada semana y 60 s de descanso, guardados como valores reales. Cambialos según el entrenamiento; los ejercicios anteriores conservan sus indicaciones. Revisá que el nombre y la indicación correspondan al mismo movimiento.", "editor-bloques"),
    p("Para otro ejercicio juntos, repetí Agregar ejercicio", "Pulsá nuevamente Agregar ejercicio dentro del mismo bloque. Así quedan dos o más filas en ese grupo. Crear bloque se usa cuando querés separar otro conjunto.", "editor-bloques"),
    p("Reordená o quitá lo que no corresponde", "Mové con la manija o Mover a otro bloque. El tacho de una fila quita ese ejercicio del entrenamiento. El tacho de un bloque vacío elimina solamente ese bloque.", "editor-bloques"),
    p("Esperá la confirmación de guardado", "Revisá los grupos, ejercicios y semanas. No cambies de pantalla mientras haya cambios pendientes; si falla, usá Reintentar guardado.", "editor-vuelta-calma"),
  ], "Agrupar varios ejercicios no define por sí solo cuántas vueltas, series o pausas realizar: escribí las indicaciones necesarias para que el alumno entienda la secuencia."),

  g("ejercicio-desde-plan", "Ejercicios", "Buscar o crear un ejercicio desde el plan", "Crear el movimiento directamente donde estás cargando la rutina.", "/planes", [
    p("Agregá la fila en el lugar correcto", "En Entrenamiento usá Agregar ejercicio dentro del bloque. En la preparación elegí Agregar ejercicio de movilidad o de activación. El buscador funciona en las tres secciones.", "editor-bloques"),
    p("Escribí el nombre y revisá coincidencias", "Hacé clic en Ejercicio y escribí unas letras. Si existe, pulsá el resultado. Evitá crear variantes del mismo nombre por una tilde o una diferencia de escritura.", "ejercicio-buscar-en-plan"),
    p("Si no existe, escribí el nombre completo", "Debajo de los resultados aparece Crear, con el nombre escrito, un selector de categoría y un botón para confirmar. No hace falta salir del plan e ir al catálogo.", "ejercicio-crear-en-plan"),
    p("Elegí su categoría", "Abrí Categoría y seleccioná el grupo. Puede ser cualquier categoría aunque estés en movilidad, activación o entrenamiento. Si falta un grupo, usá Nueva categoría, escribí su nombre y confirmá Crear categoría.", "ejercicio-crear-en-plan"),
    p("Hacé clic en Crear ejercicio en la categoría elegida", "Por ejemplo Crear ejercicio en Fuerza. Se agrega al catálogo y se selecciona en la misma fila. Revisá el nombre antes de confirmar.", "ejercicio-crear-en-plan"),
    p("Cargá la indicación del plan", "En entrenamiento completá semanas y descanso. En movilidad o activación escribí la Indicación al lado. Pulsá Guardar cambios antes de salir.", "editor-bloques"),
  ], "Crear el ejercicio define nombre y categoría. Las series, repeticiones, tiempos y descansos se escriben en cada rutina, no en el nombre del catálogo."),

  g("movilidad", "Planes", "Cargar movilidad, activación y vuelta a la calma", "Organizar la preparación antes del entrenamiento principal.", "/planes", [
    p("Elegí el Día que vas a preparar", "Abrí el plan y seleccioná actividad y Día. La preparación se organiza primero en Movilidad y después en Activación.", "editor-movilidad"),
    p("Pulsá Agregar ejercicio de movilidad", "Buscá el movimiento o crealo desde el selector. Escribí su Indicación al lado, por ejemplo 10 por lado. Ese texto es opcional: no hace falta inventar un tiempo si no corresponde.", "editor-movilidad"),
    p("Pulsá Agregar ejercicio de activación", "Elegí los movimientos de activación y completá las indicaciones. Las categorías del catálogo no están restringidas por esta sección.", "editor-movilidad"),
    p("Ordená o cambiá de sección", "Arrastrá la manija de cada fila. Si quedó en la sección equivocada, elegí Pasar a movilidad o Pasar a activación. El tacho quita la fila de esa preparación.", "editor-movilidad"),
    p("Completá Indicaciones generales", "Debajo de los ejercicios escribí una consigna común, como una sola vuelta sin pausas. No hace falta repetir lo que ya pusiste al lado de cada movimiento.", "editor-movilidad"),
    p("Terminá con Vuelta a la calma", "Después de los bloques principales, escribí cómo finaliza la sesión. Esperá la confirmación de guardado antes de cambiar de entrenamiento.", "editor-vuelta-calma"),
  ], "La preparación y sus indicaciones se mantienen durante las semanas de ese Día. La progresión principal se carga en las celdas semanales de los ejercicios."),

  g("duplicar-plan", "Planes", "Duplicar un plan", "Crear una copia para el mismo alumno o para otra persona.", "/alumnos", [
    p("Abrí el plan correcto", "Entrá a su ficha y, si hace falta, usá Ver más planes para elegir el origen.", "planificacion-ficha"),
    p("Para copiar un día o semana", "Abrí un día de Fuerza o Running y elegí Duplicar día; en Running podés marcar varios destinos con Running activado. Para copiar una semana usá Duplicar semana en la grilla, elegí origen y destino y confirmá el reemplazo. Los pesos de la semana de destino se conservan. Si una indicación vacía heredaría otra distinta en el destino, la copia se detiene; completá esa indicación en el origen y reintentá.", "planificacion-grilla"),
    p("Pulsá el icono de copiar", "Está en la barra del plan, junto al switch y la papelera. Elegí Día, Semana o Planificación completa; para copiar el plan entero, seleccioná Planificación completa.", "planificacion-ficha"),
    p("Elegí el destino", "En el modal revisá Alumno de destino, Nombre del plan y fecha de inicio. Podés conservar la misma persona o buscar otra.", "plan-duplicar"),
    p("Confirmá la copia", "Pulsá Duplicar plan. La copia queda como borrador y no desactiva el plan anterior. Si hay un error, reintentá desde el mismo modal; Cancelar no hace cambios.", "plan-duplicar"),
    p("Revisá antes de activar", "Controlá nombre, fechas, semanas y asignaciones. La copia conserva el tipo y todo el contenido de ese plan, incluidos los detalles semanales de Running; no copia pesos personales ni seguimiento. Activala con el switch cuando corresponda.", "planificacion-ficha"),
  ], "Guardar como modelo está disponible como icono de marcador en la barra del plan completo. La plantilla es independiente y no incluye los pesos personales ni el seguimiento."),

  g("guardar-modelo", "Planes", "Guardar el plan de un alumno como modelo", "Crear una plantilla reutilizable a partir del plan completo.", "/alumnos", [
    p("Abrí el plan del alumno", "Entrá en Alumnos → ficha → Resumen y seleccioná el plan que querés reutilizar.", "planificacion-ficha"),
    p("Pulsá el icono de marcador con +", "En la barra del plan, el icono Guardar como modelo abre el formulario para crear una copia en Planes.", "planificacion-ficha"),
    p("Revisá el nombre y guardá", "La plantilla incluye el plan completo: sesiones de Fuerza o días, detalles, sugerencias y volumen de Running. No copia pesos ni seguimiento personal. Queda en Planes aunque después elimines el plan original.", "plan-guardar-modelo"),
  ], "Guardar como modelo crea una copia independiente; no convierte ni mueve el plan del alumno. No existe una acción para guardar una sesión individual como modelo. Pulsá el nombre del día en la grilla para copiar una sesión desde un modelo existente al plan actual."),

  g("duplicar-modelo", "Planes", "Duplicar un modelo de la biblioteca", "Crear otra base reutilizable sin cambiar la original.", "/planes", [
    p("Buscá el modelo en Planes", "Usá nombre o filtros de actividad. Verificá el nombre y la duración de la base antes de copiarla.", "modelos-lista"),
    p("Pulsá su icono de dos hojas", "En la fila, el icono de copiar es Duplicar. Si abriste el modelo, usá Duplicar modelo en la cabecera. El lápiz edita y el tacho elimina.", "modelos-lista"),
    p("Escribí el nombre de la nueva base", "En Duplicar modelo revisá el nombre propuesto y poné uno identificable, por ejemplo Fuerza inicial adaptada. Confirmá Duplicar modelo.", "modelo-duplicar"),
    p("Adaptá y guardá la copia", "Modificá días, ejercicios e indicaciones en el editor y pulsá Guardar cambios. El modelo original se conserva.", "modelo-editor"),
    p("Asignala si la vas a usar con un alumno", "Duplicar un modelo no lo asigna a nadie. Para usarlo elegí Asignar y seleccioná alumno, nombre, fecha y duración. En Fuerza, elegí qué sesiones van en cada día; en Running, se copia la planificación semanal editable. Confirmá Asignar como borrador y después revisá y activá desde su ficha.", "modelo-asignar"),
  ], "Duplicar modelo crea otra base de la biblioteca. Duplicar plan crea una copia para un alumno, con el mismo tipo y datos semanales. Cada copia se modifica de forma independiente."),

  g("editar-eliminar-modelo", "Planes", "Editar o eliminar un modelo", "Cambiar datos y contenido o quitar una base de la biblioteca.", "/planes", [
    p("Ubicá el modelo en Planes", "Buscá su nombre. Pulsar el nombre abre el contenido; los iconos de la fila duplican, editan o eliminan.", "modelos-lista"),
    p("Para nombre o duración, usá el lápiz", "Abrí Editar modelo, modificá los campos y confirmá Guardar cambios. Antes de reducir la duración, revisá la progresión que habías preparado.", "modelo-editar"),
    p("Para cambiar ejercicios, abrí su nombre", "Elegí actividad y Día y modificá movilidad, activación, bloques y semanas. Pulsá Guardar cambios antes de volver a Todos los modelos.", "modelo-editor"),
    p("Para quitarlo, usá el tacho", "Eliminar modelo abre una confirmación con su nombre. Si solo querías editarlo, cancelá. Si confirmás Eliminar modelo, desaparece de la biblioteca.", "modelo-eliminar"),
    p("Distinguí modelo de copia asignada", "Las rutinas ya asignadas a alumnos se conservan aunque borres la base. Si solo querías que una persona dejara de ver su rutina, entrá en su ficha y desactivá ese plan.", "alumno-planes"),
  ], "Los cambios de una base no se propagan a copias ya asignadas. Para una versión nueva sin tocar la anterior, duplicá el modelo antes de editar."),


  g("desactivar-plan", "Planes", "Activar, desactivar o eliminar un plan", "Elegir qué ve el alumno y conservar los registros cuando solo querés retirarlo.", "/alumnos", [
    p("Seleccioná la rutina correcta", "Entrá en Alumnos → ficha → Resumen y elegí su nombre. Revisá estado, fecha de inicio y duración.", "alumno-planes"),
    p("Para publicar un borrador, pulsá Activar plan", "Revisá antes días de semana, ejercicios e indicaciones. Puede quedar activa una planificación por alumno. Si ya existe otra, Aktiv te permite Reemplazar plan o Cancelar.", "plan-activar"),
    p("Para retirarlo sin borrar, pulsá Desactivar plan", "Usá el botón de esa rutina y esperá el cambio. Deja de mostrarse como activa, pero conserva contenido y registros. Podés activarla otra vez más adelante.", "plan-activar"),
    p("Para eliminar definitivamente, usá su tacho", "Eliminar plan de entrenamiento abre una confirmación. Lee que se borran sesiones, ejercicios y registros de peso. No es la forma de terminar un período conservando historial.", "plan-eliminar"),
    p("Confirmá solo si querés borrar ese contenido", "Eliminar plan confirma la acción; Cancelar conserva la rutina. Si querías una versión nueva, usá Duplicar; si solo querías ocultarla, Desactivar.", "plan-eliminar"),
  ], "Reemplazar conserva el plan anterior como borrador, con su contenido y registros. Cancelar deja ambos estados sin cambios."),

  g("vista-alumno", "Planes", "Entender lo que ve el alumno en Mi plan", "Calendario, sesiones de varios planes, pesos y seguimiento opcional.", "/alumnos", [
    p("El alumno abre Mi plan", "Al entrar con su cuenta, consulta sus planes activos de Fuerza y/o Running. Puede haber uno activo de cada tipo. No ve las fichas de las otras personas.", "alumno-mi-plan"),
    p("Elige semana de fechas y día", "Usa los controles para ir a otra semana y Hoy para volver a la fecha actual. Al seleccionar un día aparecen las sesiones que correspondan de sus planes activos.", "alumno-mi-plan"),
    p("Reconoce de qué plan es cada sesión", "Cada sesión muestra plan y semana. Si tiene rutinas simultáneas se muestran juntas según su fecha. Un plan futuro no muestra trabajo antes de su inicio; los períodos pasados se consultan navegando al momento correspondiente.", "alumno-mi-plan"),
    p("Lee el entrenamiento", "Fuerza muestra movilidad, activación, ejercicios y prescripciones de esa semana. Running muestra el detalle libre que cargó el profesor, junto con volumen y sugerencias cuando estén disponibles.", "alumno-mi-plan"),
    p("Registra pesos o seguimiento si lo necesita", "Cuando hay campo de peso, escribe el valor y espera el guardado automático. Marcar completado, sensación o nota es opcional: no tocar esos campos no bloquea el plan ni el avance de semana.", "alumno-mi-plan"),
  ], "Si falta una sesión, revisá estado activo, fecha de inicio, duración y día semanal asignado desde la ficha del alumno. No hace falta marcar completado para ver lo siguiente."),

  g("ejercicios", "Ejercicios", "Buscar, crear y editar ejercicios del catálogo", "Nombres, categorías y filtros de la página Ejercicios.", "/ejercicios", [
    p("Andá a Ejercicios", "El catálogo se agrupa por categoría y ordena categorías y nombres alfabéticamente. Los contadores indican cuántos ejercicios hay en cada grupo.", "ejercicios-lista"),
    p("Buscá antes de crear", "Escribí nombre o categoría en Buscar ejercicio. Podés combinar palabras y elegir además un filtro. No distingue tildes ni mayúsculas. Limpiar filtros vuelve a mostrar la lista completa.", "ejercicios-lista"),
    p("Pulsá Nuevo ejercicio", "Si no existe, abrí el formulario desde la cabecera. Allí se cargan Nombre y Categoría, no las series o repeticiones del plan.", "ejercicio-nuevo"),
    p("Completá nombre y categoría y pulsá Agregar", "Elegí un nombre claro y su grupo. Si falta una categoría, usá Nueva categoría dentro del selector. Al confirmar, el ejercicio queda disponible en los planes.", "ejercicio-nuevo"),
    p("Para corregirlo o moverlo, usá el lápiz", "Abrí Editar ejercicio en su fila. Cambiá Nombre o Categoría y pulsá Guardar. No hace falta borrar el ejercicio para cambiar de grupo.", "ejercicio-editar"),
    p("Comprobá el resultado", "Buscá el nombre otra vez. Si tenías seleccionado el filtro de su categoría anterior, pulsá Limpiar filtros o elegí la nueva categoría para encontrarlo.", "ejercicios-lista"),
  ], "Las indicaciones se completan en cada entrenamiento. Al renombrar un ejercicio revisá sus usos en los planes existentes. Todas las categorías pueden elegirse en movilidad, activación y entrenamiento."),

  g("categorias", "Ejercicios", "Crear categorías y reasignar ejercicios", "Organizar el catálogo con tus propios grupos.", "/ejercicios", [
    p("Revisá los filtros existentes", "En Ejercicios, mirá si ya existe una categoría equivalente. Evitá varios grupos con el mismo significado y distinto nombre.", "ejercicios-lista"),
    p("Pulsá Nueva categoría", "El botón de la cabecera abre el formulario. También podés crearla desde el selector al agregar o editar un ejercicio, incluso dentro de un plan.", "categoria-nueva"),
    p("Escribí el nombre y confirmá Crear categoría", "Usá un nombre como Equilibrio o Técnica. Una categoría puede quedar vacía hasta que le asignes ejercicios.", "categoria-nueva"),
    p("Para reasignar, abrí el lápiz del ejercicio", "En su fila elegí Editar. Abrí Categoría, seleccioná el grupo nuevo y pulsá Guardar. Se cambia la clasificación del mismo ejercicio, no se crea otro.", "ejercicio-editar"),
    p("Revisá el grupo nuevo", "Seleccioná el filtro de esa categoría o buscá el nombre. Si seguías filtrando el grupo anterior, limpiá el filtro.", "ejercicios-lista"),
  ], "Podés crear las categorías que necesites. Una categoría organiza movimientos; una actividad de plan organiza sesiones. Crear una no crea automáticamente la otra."),

  g("eliminar-ejercicio", "Ejercicios", "Quitar ejercicios del catálogo o del entrenamiento", "Distinguir los dos tachos y sus efectos.", "/ejercicios", [
    p("Para el catálogo, buscá el nombre en Ejercicios", "El tacho de esa página corresponde al ejercicio de la lista para seleccionar en planes. Verificá la fila antes de tocarlo.", "ejercicios-lista"),
    p("Abrí el tacho y revisá la confirmación", "La app pregunta si querés sacarlo de tu lista. Si solo querías corregir nombre o categoría, cancelá y usá el lápiz.", "ejercicio-eliminar"),
    p("Confirmá Sacar", "Deja de ofrecerse en el catálogo. Los planes que ya lo usan conservan ese contenido; quitarlo de tu lista no lo retira automáticamente de todas las rutinas.", "ejercicio-eliminar"),
    p("Para una sesión, usá el tacho de su fila", "Abrí el entrenamiento y quitá la fila del bloque o de movilidad/activación. Revisá la confirmación si aparece y esperá el guardado. Esa acción modifica esa sesión, no el catálogo.", "editor-bloques"),
  ], "Para moverlo de bloque no hace falta eliminarlo: usá la manija o Mover a otro bloque. Revisá los registros asociados antes de quitar trabajo ya realizado."),

  g("crear-horario", "Clases", "Crear horarios semanales y bloques de clase", "Elegir días, lugar y franjas, con un bloque o varios por día.", "/agenda", [
    p("Abrí Clases y ubicá la semana", "Usá las flechas para cambiar de semana, la fecha para ubicarte o Hoy para regresar. Cada tarjeta corresponde a un día.", "clases-semana"),
    p("Pulsá Nuevo horario", "Abre Nuevo horario semanal. Para una franja adicional de un día concreto también podés usar Agregar bloque al final de esa tarjeta.", "clases-semana"),
    p("Seleccioná los días que comparten esa franja", "En Días de clase marcá Lunes, Martes u otros días. Todos los seleccionados usarán la misma actividad, lugar e intervalo del formulario. No marques un día que deba tener otro horario.", "horario-nuevo"),
    p("Completá los datos obligatorios", "El selector de horas permite escribir o buscar. La hora de fin debe ser posterior al inicio.", "horario-nuevo", [["Actividad", "Nombre que verá el alumno, como Running o Entrenamiento."], ["Lugar", "Punto de encuentro, por ejemplo Palmar."], ["Hora de inicio", "Desde qué hora se ofrece ese bloque."], ["Hora de fin", "Hasta qué hora se dicta el bloque."]]),
    p("Confirmá Guardar horario", "Revisá días y datos y guardá. Comprobá en la semana que las tarjetas indiquen el lugar y el intervalo correctos.", "horario-nuevo"),
    p("Para mañana y tarde, creá dos bloques", "Por ejemplo lunes 06:00 a 12:00 y 15:00 a 18:00: cargá el primero y usá Agregar bloque del lunes para el segundo. No escribas dos intervalos dentro de un mismo campo de hora.", "clases-semana"),
    p("Para un domingo distinto, cargalo por separado", "Si lunes a viernes comparten franja y domingo tiene otra, hacé un formulario para los días comunes y otro para domingo. Cada bloque conserva su lugar y sus horas.", "horario-nuevo"),
  ], "Los horarios semanales se repiten hasta que los cambies. No hay cupos; los alumnos informan asistencia y hora de llegada dentro del bloque."),

  g("editar-clase", "Clases", "Editar, cancelar o reabrir un entrenamiento", "Cambiar una fecha o el horario habitual sin confundirlos.", "/agenda", [
    p("Buscá el bloque correcto", "En Clases elegí la semana y comprobá fecha, actividad, lugar, inicio y fin. Si hay mañana y tarde, identificá cuál querés cambiar.", "clases-semana"),
    p("Pulsá su lápiz", "Editar bloque abre actividad, lugar y horas de ese bloque. No modifica todos los horarios de la semana a la vez.", "horario-editar"),
    p("Elegí el alcance del cambio", "Elegí Esta y las próximas semanas para modificar el horario habitual desde esa fecha. Elegí Solo esta fecha para una excepción que no cambie las demás semanas. Revisá actividad, lugar y horas antes de guardar.", "horario-editar"),
    p("Guardá y comprobá la tarjeta", "Pulsá Guardar cambios y revisá el resultado. Los alumnos de los turnos afectados deberán confirmar otra vez. Una excepción puede identificarse como Solo esta fecha. Si querías un cambio permanente, no lo dejes como excepción de un día.", "horario-editar"),
    p("Para suspender, pulsá Cancelar entrenamiento", "Está al final de cada bloque. Se abre una confirmación con actividad, fecha y hora. Revisá y pulsá Confirmar. No es cancelar el aviso de un solo alumno.", "clase-cancelar"),
    p("Para volver a ofrecerla, usá Reabrir entrenamiento", "En el bloque cancelado elegí la acción de reapertura, confirmá y revisá. Las confirmaciones previas se conservan según indica el aviso.", "clases-semana"),
    p("Para retirar un horario recurrente, bajá a Horarios semanales", "Desactivar oculta sus clases conservando registros. Reactivar vuelve a ofrecerlas. Esto es distinto de cancelar solamente una fecha.", "clases-semana"),
  ], "No elimines un horario para resolver un cambio de una fecha. Usá el alcance adecuado en el lápiz o la cancelación de ese bloque."),

  g("asistentes", "Clases", "Ver quién viene y a qué hora llega", "Consultar los nombres y horas informadas en cada bloque.", "/agenda", [
    p("Elegí la fecha en Clases", "Buscá la semana y pulsá Actualizar si esperás cambios recientes. No uses una captura vieja como única referencia.", "clases-semana"),
    p("Identificá la franja", "Cada bloque muestra actividad, lugar e inicio a fin. Si hay dos intervalos en el día, cada uno tiene su propia lista.", "clases-asistentes"),
    p("Leé nombres y horas de llegada", "Debajo aparecen las personas que confirmaron y la hora que informaron. Así distinguís quién va, por ejemplo, a las 16:00 y quién llega a las 17:30 dentro de la misma franja.", "clases-asistentes"),
    p("Si falta la hora, pedí que la actualicen", "Una confirmación antigua puede figurar sin indicar hora. El alumno puede abrir Clases y completar su llegada. Después pulsá Actualizar desde tu cuenta.", "clases-asistentes"),
    p("Revisá nuevamente antes del entrenamiento", "El alumno puede cambiar o cancelar el aviso. La lista actualizada es la referencia para organizar quién viene.", "clases-asistentes"),
  ], "Es un aviso de asistencia, no un cupo reservado ni un registro de que ya entrenó. El seguimiento de planes es otra función y es opcional."),

  g("avisar-asistencia", "Clases", "Explicarle al alumno cómo avisar que asistirá", "Elegir bloque e informar la hora a la que va a llegar.", "/agenda", [
    p("El alumno abre Clases", "En su cuenta, elige Clases o consulta la tarjeta de la clase de hoy cuando aparece en su inicio. Allí revisa lugar y franja del entrenamiento.", "alumno-asistencia"),
    p("Elige el bloque correcto", "Si hay varios horarios, debe ubicar el que va a usar. Revisa lugar e intervalo para no avisar en otro bloque.", "alumno-asistencia"),
    p("Completa su hora de llegada", "Escribe o selecciona una hora dentro del intervalo. Si el bloque es 16:00 a 19:00, puede informar 17:30. No se elige una hora fuera de esa franja.", "alumno-asistencia"),
    p("Confirma Asistiré", "Pulsa la acción de asistencia y espera la confirmación. Desde ese momento aparece en tu lista con su hora informada.", "alumno-asistencia"),
    p("Actualiza o cancela si cambia de plan", "Puede cambiar la hora o cancelar su aviso. Para ir a otra franja debe confirmar en ese otro bloque. Cancelar su aviso no cancela la clase de los demás.", "alumno-asistencia"),
  ], "La confirmación no bloquea un cupo ni obliga a marcar entrenamiento completado. Vos consultás sus avisos en las tarjetas de Clases."),

  g("carreras", "Carreras", "Crear y editar carreras, fechas y distancias", "Preparar el evento antes de anotar a cada alumno.", "/carreras", [
    p("Andá a Carreras", "Pulsá Carreras en la navegación y comprobá si ya existe el evento. No lo dupliques para asignarlo a otra persona.", "carreras-lista"),
    p("Pulsá Nueva carrera", "Abre el formulario del evento. Después se cargan las inscripciones y objetivos de cada alumno por separado.", "carreras-lista"),
    p("Completá los datos", "Revisá nombre, fecha y distancias antes de confirmar.", "carrera-nueva", [["Nombre de la carrera", "Nombre con el que reconocerán el evento."], ["Fecha", "Día del evento, no inicio del plan."], ["Ubicación", "Ciudad o lugar de encuentro."], ["Kms disponibles", "Una o varias distancias; podés cargar otra si no aparece entre las opciones."], ["Notas", "Información común del evento para quienes participen."]]),
    p("Guardá y revisá el calendario", "Confirmá el formulario y comprobá fecha y kilómetros. Para anotar a alguien, entrá después en su ficha → Carreras.", "carreras-lista"),
    p("Para cambiarla, pulsá su lápiz", "En Editar carrera podés modificar nombre, fecha, ubicación, notas y distancias. Confirmá los cambios y revisá el resultado en la lista.", "carrera-editar"),
    p("Si no permite retirar una distancia, revisá las inscripciones", "Una distancia usada por alumnos no se puede quitar sin revisar esas inscripciones. Cambiá primero a las personas afectadas a otra distancia disponible y después editá el evento.", "carrera-editar"),
  ], "Objetivo admite texto y números y pertenece a cada alumno. No debe confundirse con el tiempo oficial ni con las notas comunes del evento."),

  g("inscribir-carrera", "Carreras", "Asignar una carrera y escribir el objetivo", "Elegir evento y distancia para una persona y modificar su inscripción.", "/alumnos", [
    p("Abrí la pestaña Carreras de su ficha", "Entrá en Alumnos → persona → Carreras. Allí se separan sus eventos próximos y los que ya pasaron.", "alumno-carreras"),
    p("Hacé clic en Asignar a una carrera", "El formulario vincula a esta persona con un evento que ya cargaste. Si no existe, crealo primero desde Carreras.", "carrera-asignar"),
    p("Elegí evento, distancia y objetivo", "Seleccioná la carrera y después una de sus distancias. En Objetivo podés escribir terminar cómoda, bajar de 50 minutos o texto con números. Dos alumnos del mismo evento pueden tener distancias y metas diferentes.", "carrera-asignar"),
    p("Confirmá y revisá la tarjeta", "Guardá la asignación y comprobá nombre del evento, kilómetros y objetivo. Esta acción no crea un plan de entrenamiento.", "alumno-carreras"),
    p("Para corregirla, usá el lápiz de la inscripción", "El lápiz dentro de la ficha permite modificar distancia u objetivo de esa persona. No necesitás editar todo el evento por cambiar la meta de un alumno.", "carrera-inscripcion-editar"),
    p("Para desanotarlo, usá su tacho", "Quitar de la carrera abre una confirmación. Revisá el evento y confirmá solo si querés sacar a esa persona. No elimina la carrera del calendario ni las inscripciones de los demás.", "alumno-carreras"),
  ], "Evento, inscripción, objetivo y plan son elementos distintos. El alumno consulta sus carreras desde su propia cuenta."),

  g("resultado-carrera", "Carreras", "Anotar un resultado o eliminar un evento", "Distinguir el tiempo oficial de una meta y de la inscripción.", "/carreras", [
    p("Buscá la carrera pasada en la ficha", "Entrá en Alumnos → persona → Carreras y ubicá el evento. Cuando corresponde aparece Anotar resultado; una carrera futura muestra sus datos de preparación.", "alumno-carreras"),
    p("Pulsá Anotar resultado", "Escribí el tiempo oficial en el formato del formulario, por ejemplo 48:30 o 1:05:20. Revisá que sea el tiempo real para esa distancia, no el objetivo previo.", "carrera-resultado"),
    p("Confirmá y revisá el tiempo", "Guardá y comprobá el resultado y el ritmo mostrado. Asignar una carrera no completa automáticamente su resultado.", "carrera-resultado"),
    p("Para borrar el evento, andá a Carreras y usá su tacho", "Lee la confirmación. Si solo querías desanotar a un alumno, cancelá y quitá la inscripción desde su ficha: no elimines el evento completo.", "carrera-eliminar"),
    p("Confirmá solo si corresponde", "Cancelar conserva la carrera. La eliminación quita el evento y las relaciones indicadas por la pantalla; revisá las personas anotadas antes de confirmarla.", "carrera-eliminar"),
  ], "El objetivo es texto libre; el tiempo oficial se registra en Resultado. Quitar una inscripción y eliminar la carrera son acciones distintas."),

  g("marcas", "Marcas y salud", "Crear, editar y eliminar marcas personales", "Registrar tiempos reales por distancia y consultar las mejores marcas.", "/alumnos", [
    p("Abrí Marcas en la ficha", "Entrá en Alumnos → persona → Marcas. El alumno consulta sus propios registros desde Marcas en su cuenta.", "marcas-lista"),
    p("Pulsá Nueva marca", "El botón junto al resumen de mejores marcas abre el formulario de tiempo. No es una indicación de entrenamiento ni un objetivo futuro.", "marcas-lista"),
    p("Completá los campos", "Elegí la distancia y registrá lo que realmente consiguió.", "marca-nueva", [["Distancia", "Kilómetros a los que corresponde el tiempo; elegí otra distancia si hace falta."], ["Tiempo", "Minutos:segundos u horas:minutos:segundos, por ejemplo 25:30 o 1:02:10."], ["Día", "Fecha en la que logró la marca."], ["Carrera", "Referencia opcional para reconocer el registro."]]),
    p("Guardá y comprobá la lista", "Confirmá y revisá distancia, fecha y tiempo. El resumen compara las marcas registradas por distancia y muestra las mejores.", "marcas-lista"),
    p("Para corregir, usá el lápiz de la marca", "En Editar marca modificá los campos y guardá. Si cambiás kilómetros, comprobá que el tiempo corresponda a esa distancia.", "marca-editar"),
    p("Para quitar un registro incorrecto, usá su tacho", "Pulsá Eliminar marca y revisá la confirmación. No borres otros tiempos solo para que uno figure como mejor; cargá los valores reales.", "marcas-lista"),
  ], "Las mejores marcas se calculan con registros cargados. Un objetivo de carrera no equivale a una marca conseguida."),

  g("ficha-medica", "Marcas y salud", "Completar la ficha médica y el contacto de emergencia", "Actualizar los datos en su apartado y controlar a qué persona pertenecen.", "/alumnos", [
    p("Entrá en Ficha médica", "Abrí Alumnos → persona → Ficha médica. Verificá el nombre antes de escribir datos personales de salud.", "ficha-medica"),
    p("Completá los datos generales", "Cargá fecha y lugar de nacimiento y las enfermedades o condiciones informadas. No inventes datos que todavía no te pasaron.", "ficha-medica"),
    p("Revisá lesiones y observaciones", "Usá los campos del apartado para registrar lo que corresponda. Los apuntes privados del profesor en Resumen no son lo mismo que la información médica que completa la persona.", "ficha-medica"),
    p("Cargá el contacto de emergencia", "Más abajo completá nombre, parentesco y teléfono de la persona a contactar. Revisá el número antes de salir.", "ficha-contacto"),
    p("Esperá el guardado", "Los campos se guardan al actualizarlos. Si aparece un error, corregí o reintentá antes de cambiar de pantalla. El documento médico se sube desde el apartado de certificado.", "ficha-medica"),
  ], "Esta información es personal. No es requisito para completar el registro inicial ni para iniciar sesión."),

  g("certificados", "Marcas y salud", "Subir, reemplazar y controlar certificados", "Cargar un documento, revisar vencimiento y consultar el listado general.", "/certificados", [
    p("Buscá Certificado médico en la ficha", "Entrá en Alumnos → persona → Ficha médica y ubicá el apartado del documento. Comprobá a quién pertenece antes de elegir un archivo.", "certificado-subir"),
    p("Pulsá Subir certificado médico", "Se abre el selector del dispositivo. Elegí un PDF o una imagen de esa persona. La pantalla indica el límite de 5 MB; prepará un archivo más liviano si lo supera.", "certificado-subir"),
    p("Esperá la carga y verificá el documento", "No cierres la pantalla mientras sube. Después comprobá el nombre del archivo y usá Ver o la vista previa para revisar que sea el correcto.", "certificado-cargado"),
    p("Completá Vence el", "Cargá la fecha real de vencimiento. Los estados vigente, próximo a vencer o vencido se calculan con ese dato. Esperá que se guarde.", "certificado-cargado"),
    p("Para actualizarlo, usá Reemplazar", "Elegí el nuevo archivo y revisá nombre y vencimiento. Quitar elimina el documento asociado: no lo uses si solo querías cambiar una fecha.", "certificado-cargado"),
    p("Controlá todos desde Certificados", "En la navegación abrí Certificados. El listado ayuda a detectar a quién pedirle un documento actualizado; después volvé a su ficha para cargarlo.", "certificados-lista"),
  ], "Los certificados son privados. Un enlace temporal para verlo no es un enlace público permanente ni debe compartirse como si lo fuera."),
];

export const temasManual = [...new Set(guias.map(guia => guia.categoria))];
export function normalizarBusqueda(texto: string) { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
export function textoGuia(guia: GuiaManual) { return [guia.titulo, guia.descripcion, guia.categoria, guia.nota, ...guia.pasos.flatMap(paso => [paso.titulo, paso.texto, ...(paso.campos ?? []).flatMap(campo => [campo.nombre, campo.detalle])])].join(" "); }
