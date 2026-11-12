# Ajustes del manual: planes y asignaciones

Registro de instrucciones retiradas o corregidas para que el manual coincida con el flujo actual de Aktiv.

- **Planes mixtos:** se quitó la instrucción de combinar Fuerza y Running en un mismo plan o marcar ambos tipos para un día. Cada plan y modelo contiene un solo tipo; un alumno puede tener uno activo por tipo.
- **Asignación automática o rotación:** se quitó cualquier expectativa de que Aktiv rote sesiones o complete días automáticamente. El entrenador elige manualmente qué sesión distinta va en cada día. Las sesiones no elegidas quedan disponibles y los días vacíos permanecen como “Sin asignar”.
- **Asignar después de crear la copia:** se corrigió el paso que postergaba toda la selección de días hasta después de crear el borrador. Al asignar un modelo, la selección de sesiones y días ocurre en el mismo modal; luego se puede ajustar desde la ficha.
- **Activar sin resolver otro plan activo:** se corrigió la indicación que decía que activar un plan no afecta los demás. Si ya hay uno activo del mismo tipo, Aktiv ofrece “Reemplazar plan” o “Cancelar”; reemplazar deja el anterior como borrador y conserva sus datos e historial.
- **Rutinas compartidas:** se quitó la afirmación general de que editar una rutina actualiza todos los días que la comparten. La asignación de un modelo crea copias editables e independientes.
- **Herramientas “pendientes de ubicación”:** se quitó esa nota genérica, que ya no describe una acción concreta de la interfaz.
- **Guardar como modelo:** se agregó una guía propia para el icono de marcador con +. Explica que guarda el plan completo, excluye pesos y seguimiento personal, y sobrevive a la eliminación del plan original.

La guía actualizada está en `aktiv-client/src/lib/manual-detallado.ts`. La decisión de separar Running en su propio tipo se refleja en el manual; su editor sigue usando detalle diario, volumen y sugerencias semanales.
