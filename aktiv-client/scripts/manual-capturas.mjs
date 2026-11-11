// Capturas reales de la UI con datos ficticios y API interceptada. Nunca usa Supabase.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const motor = (await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright")).chromium;
const browser = await motor.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chromium", headless: true });
const base = process.env.MENSUAL_URL ?? "http://localhost:3101";
const salida = join(process.cwd(), "public/manual"); await mkdir(salida, { recursive: true });
const archivo = join(process.cwd(), "src/lib/manual-capturas.json");
let capturas = {}; try { capturas = JSON.parse(await readFile(archivo, "utf8")); } catch {}
const id = n => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const alumnoId = id(10), planId = id(20), modeloId = id(21), carreraId = id(70);
const ficha = { fechaNacimiento: "1993-04-15", lugarNacimiento: "Córdoba", enfermedades: "Sin condiciones informadas", lesiones: [], certificado: null, contacto: { nombre: "Persona de contacto", parentesco: "Familiar", telefono: "3510000000" } };
const alumno = { id: alumnoId, userId: id(3), coachId: id(1), nombre: "Ana Ejemplo", email: "ana@example.test", dni: "45111222", telefono: "3510000000", objetivo: "Volver a entrenar", nivel: "Principiante", activo: true, proximoPago: "2026-12-09", altaEn: "2026-11-09", planes: [], semana: Array.from({ length: 7 }, () => ({ correr: false, fuerza: false })), ficha, marcas: [{ id:id(96), distanciaKm:5, tiempoSeg:1500, fecha:"2026-11-01", carrera:"Carrera de ejemplo" }], notasProfe: "Ejemplo de nota privada del profesor.", notasAlumno: "", acceso: { estado: "activo", expiraEn: null } };
const ejercicio = (n, nombre, grupo, orden) => ({ id: id(n), nombre, grupo, orden, descanso: "60 s", semanas: [1, 2, 3, 4].map(semana => ({ semana, prescripcion: semana === 1 ? "3×10" : "", peso: null, pesoFecha: null })) });
const sesion = (n, tipo, dia) => ({ id: id(n), tipo, dia, nombre: `${tipo} · Día 1`, orden: 0, calentamiento: "Hacé los movimientos de forma suave, sin dolor.", activacion: [{ id: id(n + 100), nombre: "Movilidad de tobillos", indicacion: "10 por lado", fase: "Movilidad" }, { id: id(n + 101), nombre: "Puente de glúteos", indicacion: "12 repeticiones", fase: "Activación" }], enfriamiento: "Caminá suave y elongá al terminar.", bloques: [1, 2], ejercicios: [ejercicio(n + 200, tipo === "Running" ? "Rodaje suave" : "Sentadilla", 1, 0), ejercicio(n + 201, "Puente de glúteos", 1, 1)] });
const sesiones = [sesion(30, "Fuerza", 1), sesion(40, "Running", 3)];
const plan = { id: planId, nombre: "Base inicial · Ejemplo", inicio: "2026-11-09", semanas: 4, activo: true, orden: 0, sesiones };
const modelo = { id: modeloId, nombre: "Fuerza inicial · Modelo", semanas: 4, revision: 0, sesiones: [sesion(50, "Fuerza", 1)] };
const resumen = { id: modeloId, nombre: modelo.nombre, semanas: 4, dias: 1, tipos: ["Fuerza"] };
const carrera = { id: carreraId, nombre: "Carrera de ejemplo", fecha: "2026-12-06", lugar: "Córdoba", distanciasKm: [5, 10], notas: "Ejemplo para el manual, sin inscripción real." };
const inscripcion = { id: id(71), alumnoId, carreraId, distanciaKm: 10, objetivoSeg: null, objetivo: "Terminar cómoda", resultadoSeg: null };
const catalogo = [["Sentadilla", "Fuerza"], ["Puente de glúteos", "Activación"], ["Movilidad de tobillos", "Movilidad"], ["Rodaje suave", "Running"]].map(([nombre, categoria], i) => ({ id: id(80 + i), nombre, categoria }));
const horario = { id: id(90), titulo: "Entrenamiento", dia: 1, hora: "16:00", fin: "19:00", lugar: "Palmar · Lugar de ejemplo", activo: true };
const clase = { horarioId: horario.id, fecha: "2026-11-09", titulo: horario.titulo, hora: horario.hora, fin: horario.fin, lugar: horario.lugar, cancelada: false, asistire: false, horaLlegada: null, personalizada: false, confirmados: [{ alumnoId, nombre: alumno.nombre, horaLlegada: "17:30" }] };

async function pagina(rol = "coach") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Argentina/Buenos_Aires", colorScheme: "dark", reducedMotion: "reduce" });
  await ctx.addInitScript(() => localStorage.setItem("theme", "dark"));
  const page = await ctx.newPage(); await page.clock.install({ time: new Date("2026-11-09T18:00:00Z") });
  const session = rol ? { username: rol === "coach" ? "profe@example.test" : alumno.email, role: rol, nombre: rol === "coach" ? "Lucas" : alumno.nombre, userId: rol === "coach" ? id(1) : id(3), ...(rol === "alumno" ? { alumnoId } : {}) } : null;
  await page.route("**/api/**", async route => {
    const req = route.request(), path = new URL(req.url()).pathname.slice(4); let body = {}, status = 200;
    if (path === "/auth/me") { if (session) body = { session }; else status = 401; }
    else if (path === "/auth/refresh") status = 401;
    else if (path.endsWith("/certificado/url")) body = { url: ficha.certificado.ruta };
    else if (path === "/datos") body = { session, alumnos: [alumno], carreras: [carrera], inscripciones: [inscripcion], ejerciciosCustom: catalogo, categoriasEjercicio: ["Activación", "Running", "Equilibrio"] };
    else if (path === "/actividades-plan") body = ["Fuerza", "Running", "Movilidad"];
    else if (path === "/planes-modelo") body = [resumen];
    else if (path === `/planes-modelo/${modeloId}`) body = modelo;
    else if (path.endsWith("/planes-mensuales")) body = [plan];
    else if (path === "/auth/registro") body = { habilitado: true };
    else if (path === "/auth/solicitudes-alta") body = [{ id: id(95), nombre: "Martín Ejemplo", email: "martin@example.test", dni: "45222333", telefono: "" }];
    else if (path === "/agenda") body = { horarios: [horario], clases: [clase] };
    else if (path.includes("/seguimiento/")) body = { registro: { semana: 1, completado: false, sensacion: null, nota: "", fecha: null }, habilitado: true };
    else if (req.method() !== "GET") { status = 204; }
    else throw new Error(`Consulta sin fixture: ${path}`);
    await route.fulfill({ status, contentType: "application/json", ...(status === 204 ? {} : { body: JSON.stringify(body) }) });
  });
  return { page, ctx };
}
async function foto(page, nombre, marcas = [], modal = false) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.querySelectorAll("[data-manual-marca]").forEach(n => n.remove()));
  if (marcas.length) await marcas[0][0].scrollIntoViewIfNeeded();
  for (const [indice, [localizador, detalle]] of marcas.entries()) {
    const texto = marcas.length > 2 ? String(indice + 1) : detalle;
    await localizador.waitFor({ state: "visible" }); const caja = await localizador.boundingBox();
    await page.evaluate(({ caja: b, texto }) => {
      const marco = document.createElement("div"); marco.dataset.manualMarca = "1";
      Object.assign(marco.style, { position: "fixed", zIndex: "2147483646", left: `${b.x - 5}px`, top: `${b.y - 5}px`, width: `${b.width + 10}px`, height: `${b.height + 10}px`, border: "3px solid #59e3ee", borderRadius: "10px", boxShadow: "0 0 0 3px #07141b", pointerEvents: "none" });
      const etiqueta = document.createElement("span"); etiqueta.textContent = texto;
      Object.assign(etiqueta.style, { position: "absolute", left: "0", ...(b.y < 42 ? { top: "100%" } : { bottom: "calc(100% + 6px)" }), padding: "4px 9px", borderRadius: "6px", background: "#59e3ee", color: "#061116", font: "bold 15px system-ui", whiteSpace: "nowrap" });
      marco.append(etiqueta); document.body.append(marco);
    }, { caja, texto });
  }
  if (marcas.length > 2) await page.evaluate(texto => { const leyenda=document.createElement("div");leyenda.dataset.manualMarca="1";leyenda.textContent=texto;Object.assign(leyenda.style,{position:"fixed",bottom:"16px",left:"50%",transform:"translateX(-50%)",zIndex:"2147483647",padding:"12px 20px",borderRadius:"10px",background:"#59e3ee",color:"#061116",font:"bold 16px system-ui",maxWidth:"90vw"});document.body.append(leyenda); }, marcas.map(([,texto])=>texto).join("     ·     "));
  let clip;
  if (modal) { const b = await page.getByRole("dialog").boundingBox(); clip = { x: Math.max(0, Math.floor(b.x - 24)), y: Math.max(0, Math.floor(b.y - 40)), width: Math.min(1280 - Math.max(0, Math.floor(b.x - 24)), Math.ceil(b.width + 48)), height: Math.min(900 - Math.max(0, Math.floor(b.y - 40)), Math.ceil(b.height + 64)) }; }
  await page.screenshot({ path: join(salida, `${nombre}.png`), ...(clip ? { clip } : {}) });
  capturas[nombre] = { src: `/manual/${nombre}.png`, ancho: clip?.width ?? page.viewportSize().width, alto: clip?.height ?? page.viewportSize().height };
  await writeFile(archivo, JSON.stringify(capturas, null, 2) + "\n");
  await page.evaluate(() => document.querySelectorAll("[data-manual-marca]").forEach(n => n.remove()));
  console.log(`Captura: ${nombre}`);
}
const boton = (p, n) => p.getByRole(["Activar plan","Desactivar plan"].includes(n)?"switch":"button", { name: n, exact: true });
async function abrirRutinas(p){const resumen=p.getByText("Ver más planes",{exact:true});await resumen.waitFor();if(!await resumen.evaluate(e=>e.parentElement.open))await resumen.click();await boton(p,"Organizar rutinas").click();}
async function cerrar(p) { const id=await p.getByRole("dialog").last().getAttribute("id"); const d=p.locator(`[id="${id}"]`); const cancelar = d.getByRole("button", { name: "Cancelar", exact: true }); if (await cancelar.count()) await cancelar.last().click(); else await d.getByRole("button", { name: "Close", exact: true }).click(); await d.waitFor({ state: "hidden" }); }
async function grupo(nombre, hacer, rol) {
  if (process.argv[2] && process.argv[2] !== nombre) return;
  const { page, ctx } = await pagina(rol);
  try { await hacer(page); } catch (e) { console.error((await page.locator("body").innerText()).slice(-6000)); throw e; } finally { await ctx.close(); }
}
try {
  await grupo("publico", async p => {
    await p.goto(`${base}/login`); await foto(p, "login", [[p.getByRole("link", { name: "¿Sos nuevo? Registrate en Aktiv", exact: true }), "1 · Registrate"]]);
    await p.goto(`${base}/registro`); await p.getByLabel("Nombre completo", { exact: true }).fill("Martín Ejemplo"); await p.getByLabel("Email", { exact: true }).fill("martin@example.test"); await p.getByLabel("DNI", { exact: true }).fill("45222333"); await foto(p, "registro", [[boton(p, "Solicitar mi alta"), "2 · Solicitar el alta"]]);
    await p.goto(`${base}/recuperar-clave`); await foto(p, "recuperar", [[p.getByRole("textbox").first(), "1 · Email de la cuenta"]]);
  }, null);
  await grupo("planes", async p => {
    await p.goto(`${base}/planes`); await boton(p, "Nuevo plan").waitFor(); await foto(p, "modelos-lista", [[boton(p, "Nuevo plan"), "1 · Crear modelo"], [boton(p, `Duplicar ${modelo.nombre}`), "2 · Duplicar"], [boton(p, `Editar ${modelo.nombre}`), "3 · Editar"], [boton(p, `Eliminar ${modelo.nombre}`), "4 · Eliminar"]]);
    await boton(p, "Nuevo plan").click(); await foto(p, "modelo-nuevo", [[p.getByRole("dialog"), "Completá el formulario"]], true); await cerrar(p);
    for (const [accion, captura] of [["Duplicar", "modelo-duplicar"], ["Editar", "modelo-editar"], ["Eliminar", "modelo-eliminar"]]) { await boton(p, `${accion} ${modelo.nombre}`).click(); await foto(p, captura, [], true); await cerrar(p); }
    await boton(p, "Asignar").click(); await foto(p, "modelo-asignar", [[p.getByRole("combobox").first(), "1 · Buscar alumno"]], true); await cerrar(p);
    await p.goto(`${base}/planes?modelo=${modeloId}`); await boton(p,"Editor de rutinas").click(); await boton(p, "Crear bloque").waitFor(); await foto(p, "modelo-editor", [[boton(p, "Asignar a alumno"), "Asignar una copia al alumno"]]);
    await foto(p, "editor-movilidad", [[boton(p, "Agregar ejercicio de movilidad"), "1 · Agregar movilidad"], [boton(p, "Agregar ejercicio de activación"), "2 · Agregar activación"]]);
    await foto(p, "editor-bloques", [[boton(p, "Crear bloque"), "1 · Nuevo bloque"], [p.getByRole("region", { name: "Bloque 1", exact: true }).getByRole("button", { name: "Agregar ejercicio", exact: true }), "2 · Agregar al bloque"]]);
    const entrada = p.getByRole("region", { name: "Bloque 1", exact: true }).getByRole("combobox", { name: "Ejercicio", exact: true }).first();
    await entrada.fill("Sent"); await foto(p, "ejercicio-buscar-en-plan", [[entrada, "Escribí para buscar en el catálogo"]]);
    await entrada.fill("Sentadilla con apoyo"); await foto(p, "ejercicio-crear-en-plan", [[boton(p, "Crear ejercicio en Fuerza"), "Crear y usar este ejercicio"]]); await p.keyboard.press("Escape");
    await foto(p, "editor-vuelta-calma", [[p.getByRole("textbox").last(), "Indicaciones finales"]]);
  });
  await grupo("alumnos", async p => {
    await p.goto(`${base}/alumnos`); await boton(p, "Nuevo alumno").waitFor(); await foto(p, "alumnos-lista", [[boton(p, "Nuevo alumno"), "1 · Alta manual"]]);
    await boton(p, "Nuevo alumno").click(); await foto(p, "alumno-nuevo", [], true); await cerrar(p);
    await p.goto(`${base}/alumnos/${alumnoId}`); await p.getByRole("heading", { name: alumno.nombre, exact: true }).waitFor(); await foto(p, "alumno-resumen", [[p.getByRole("button",{name:"Editar plan de entrenamiento",exact:true}), "Plan seleccionado"]]);
    await boton(p,"Información del alumno").click(); await foto(p,"alumno-informacion",[],true); await boton(p, "Restablecer acceso").click(); await foto(p, "alumno-acceso", [], true); await cerrar(p); await cerrar(p);
    await abrirRutinas(p); await boton(p, "Nuevo plan").waitFor(); await foto(p, "alumno-planes", [[boton(p, "Nuevo plan"), "1 · Crear plan"], [boton(p, "Duplicar plan de entrenamiento"), "2 · Duplicar"], [boton(p, "Editar plan de entrenamiento"), "3 · Editar"], [boton(p, "Eliminar plan de entrenamiento"), "4 · Eliminar"]]);
    await boton(p, "Nuevo plan").click(); await foto(p, "plan-nuevo", [], true); await cerrar(p);
    for (const [accion, captura] of [["Duplicar plan de entrenamiento", "plan-duplicar"], ["Editar plan de entrenamiento", "plan-editar"], ["Eliminar plan de entrenamiento", "plan-eliminar"], ["Guardar como modelo", "plan-guardar-modelo"]]) { await boton(p, accion).click(); await foto(p, captura, [], true); await cerrar(p); }
    await foto(p, "plan-activar", [[boton(p, "Desactivar plan"), "Ocultar sin borrar el plan"]]);
    const editarDia = p.getByRole("button", { name: /Editar entrenamiento/ }).first(); await editarDia.click(); await foto(p, "dia-editar", [], true); await cerrar(p);
    const duplicarDia = p.getByRole("button", { name: /Duplicar día de entrenamiento/ }).first(); await duplicarDia.click(); await foto(p, "dia-duplicar", [], true); await cerrar(p);
    await p.getByRole("tab", { name: /^Ficha/ }).click(); await foto(p, "ficha-medica", [[p.locator("input[type=date]").first(), "Datos médicos del alumno"]]);
    await foto(p, "certificado-subir", [[boton(p, "Subir certificado médico"), "Elegir archivo del dispositivo"]]);
    await p.getByRole("tab", { name: "Marcas", exact: true }).click(); await foto(p, "marcas-lista", [[boton(p, "Nueva marca"), "Registrar un tiempo"]]); await boton(p, "Nueva marca").click(); await foto(p, "marca-nueva", [], true); await cerrar(p);
    await p.getByRole("tab", { name: "Carreras", exact: true }).click(); await foto(p, "alumno-carreras");
  });
  await grupo("catalogo", async p => {
    await p.goto(`${base}/ejercicios`); await boton(p, "Nuevo ejercicio").waitFor(); await foto(p, "ejercicios-lista", [[p.getByRole("textbox", { name: "Buscar ejercicio", exact: true }), "1 · Buscar"], [boton(p, "Nuevo ejercicio"), "2 · Crear ejercicio"]]);
    await boton(p, "Nuevo ejercicio").click(); await foto(p, "ejercicio-nuevo", [], true); await cerrar(p);
    await boton(p, "Editar Sentadilla").click(); await foto(p, "ejercicio-editar", [[p.getByRole("combobox", { name: "Categoría", exact: true }), "Cambiar la categoría"]], true); await cerrar(p);
    await boton(p, "Eliminar Sentadilla").click(); await foto(p, "ejercicio-eliminar", [], true); await cerrar(p);
    await boton(p, "Nueva categoría").click(); await foto(p, "categoria-nueva", [], true); await cerrar(p);
  });
  await grupo("clases", async p => {
    await p.goto(`${base}/agenda`); await boton(p, "Nuevo horario").waitFor(); await foto(p, "clases-semana", [[boton(p, "Nuevo horario"), "1 · Horario semanal"], [p.getByRole("button", { name: /^Editar bloque/ }).first(), "2 · Editar bloque"]]);
    await foto(p, "clases-asistentes", [[p.getByText("17:30", { exact: false }).first(), "Hora de llegada informada"]]);
    await boton(p, "Nuevo horario").click(); await foto(p, "horario-nuevo", [], true); await cerrar(p);
    await p.getByRole("button", { name: /^Editar bloque/ }).first().click(); await foto(p, "horario-editar", [], true); await cerrar(p);
    await boton(p, "Cancelar entrenamiento").first().click(); await foto(p, "clase-cancelar", [], true); await cerrar(p);
  });
  await grupo("carreras", async p => {
    await p.goto(`${base}/carreras`); await boton(p, "Nueva carrera").waitFor(); await foto(p, "carreras-lista", [[boton(p, "Nueva carrera"), "Crear una carrera"], [boton(p, `Editar ${carrera.nombre}`), "Editar datos y distancias"]]);
    await boton(p, "Nueva carrera").click(); await foto(p, "carrera-nueva", [], true); await cerrar(p);
    await boton(p, `Editar ${carrera.nombre}`).click(); await foto(p, "carrera-editar", [], true); await cerrar(p);
    await boton(p, `Eliminar ${carrera.nombre}`).click(); await foto(p, "carrera-eliminar", [], true); await cerrar(p);
  });
  await grupo("perfil", async p => {
    await p.goto(`${base}/dashboard`); await foto(p, "dashboard");
    await boton(p, "Mi perfil").click(); await foto(p, "perfil-menu", [[p.getByRole("menuitem", { name: "Manual de uso", exact: true }), "Abrir este manual"]]);
    await p.getByRole("menuitem", { name: "Cambiar contraseña", exact: true }).click(); await foto(p, "clave-cambiar", [], true); await cerrar(p);
    await p.goto(`${base}/certificados`); await foto(p, "certificados-lista");
  });
  await grupo("dias", async p=>{
    await p.goto(base+"/alumnos/"+alumnoId);await abrirRutinas(p);await boton(p,"Asignar días de la semana").click();await p.getByRole("checkbox",{name:"Miércoles",exact:true}).check();await foto(p,"dias-asignar",[[p.getByRole("checkbox",{name:"Lunes",exact:true}),"Marcá todos los días de esta rutina"]]);
    await boton(p,"Listo").click();await boton(p,"Editar entrenamiento").click();await foto(p,"dia-editar",[],true);await cerrar(p);await boton(p,"Duplicar día de entrenamiento").click();await foto(p,"dia-duplicar",[],true);
  });
  await grupo("solicitudes", async p => {
    await p.goto(base+"/dashboard");await boton(p,"Aprobar todos").waitFor();await foto(p,"dashboard");await foto(p,"dashboard-solicitudes",[[boton(p,"Copiar enlace de registro"),"Compartí el registro"],[boton(p,"Aprobar todos"),"Aprobá las solicitudes"]]);
    await p.goto(base+"/alumnos");await boton(p,"Nuevo alumno").waitFor();await foto(p,"alumnos-lista",[[boton(p,"Nuevo alumno"),"1 · Alta manual"]]);
  });
  await grupo("alumno", async p => {
    await p.goto(`${base}/mi-plan`); await p.getByRole("heading", { name: "Plan de entrenamiento", exact: true }).waitFor(); await foto(p, "alumno-mi-plan");
    await p.goto(`${base}/agenda`); await foto(p, "alumno-asistencia");
  }, "alumno");
  await grupo("running-tipos",async p=>{
    plan.running={"1":{lunes:"GYM",martes:"Rodaje suave",miercoles:"GYM",viernes:"Descanso",sabado:"Técnica",domingo:"Fondo suave"}};
    await p.goto(base+"/alumnos/"+alumnoId);await abrirRutinas(p);await boton(p,"Running").click();
    await foto(p,"running-tipo-dia",[[p.getByLabel("Actividad de Lunes, semana 1",{exact:true}),"Elegí Running, GYM o Descanso"]]);
  });
  await grupo("running", async p=>{
    plan.running={"1":{lunes:"Gimnasio",martes:"10 min suaves + 4 × 200 m + afloje",miercoles:"Descanso",jueves:"Rodaje suave",viernes:"Descanso",sabado:"Técnica y progresivos",domingo:"Fondo suave",volumen:"25,5",sugerencias:"Datos ficticios para explicar la carga."},"2":{martes:"Rodaje progresivo",volumen:"28"}};
    await p.goto(base+"/alumnos/"+alumnoId);await abrirRutinas(p);await boton(p,"Running").click();
    await foto(p,"running-grilla",[[p.getByRole("textbox",{name:"Martes, semana 1",exact:true}),"Escribí la sesión completa"]]);
    await foto(p,"running-volumen",[[p.getByRole("textbox",{name:"Volumen semanal, semana 1",exact:true}),"Kilómetros de la semana"],[p.getByRole("textbox",{name:"Sugerencias, semana 1",exact:true}),"Indicaciones generales"]]);
    await boton(p,"Copiar semana").click();await foto(p,"running-copiar",[],true);await cerrar(p);
    await p.setViewportSize({width:390,height:900});await foto(p,"running-movil",[[p.getByRole("textbox",{name:"Martes, semana 1",exact:true}),"Día y semana seleccionados"]]);
    const alumnoDemo=await pagina("alumno");await alumnoDemo.page.goto(base+"/mi-plan");await boton(alumnoDemo.page,"Vista diaria").click();await foto(alumnoDemo.page,"running-alumno",[[alumnoDemo.page.getByRole("region",{name:"Planilla de Running",exact:true}),"Lectura del alumno"]]);await alumnoDemo.ctx.close();
  });
  await grupo("extras", async p => {
 await p.goto(base+"/planes"); await boton(p,"Nuevo plan").click(); await boton(p,"Agregar actividad").click(); await p.getByRole("textbox",{name:"Nombre de la actividad"}).fill("Recuperación"); await foto(p,"actividad-crear",[[boton(p,"Crear actividad"),"Crear una actividad propia"]],true); await cerrar(p);
 await p.goto(base+"/alumnos/"+alumnoId); await p.getByRole("tab",{name:/^Ficha/}).click(); await foto(p,"ficha-contacto",[[p.locator("#contacto-nombre"),"Contacto de emergencia"]]);
 ficha.certificado={nombre:"Certificado de ejemplo.png",tipo:"image/png",tamano:1024,subidoEn:"2026-11-01",vencimiento:"2027-11-01",ruta:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="};
 await p.reload(); await p.getByRole("tab",{name:/^Ficha/}).click(); await foto(p,"certificado-cargado",[[boton(p,"Reemplazar"),"Actualizar el archivo"]]);
 await p.getByRole("tab",{name:"Marcas",exact:true}).click(); await foto(p,"marcas-lista",[[boton(p,"Nueva marca"),"Cargar un tiempo"]]); await p.getByRole("button",{name:/Editar marca/}).first().click(); await foto(p,"marca-editar",[],true); await cerrar(p);
 await p.getByRole("tab",{name:"Carreras",exact:true}).click(); await boton(p,"Asignar a una carrera").click(); await foto(p,"carrera-asignar",[],true); await cerrar(p);
 await p.getByRole("button",{name:"Editar inscripción a "+carrera.nombre,exact:true}).click(); await foto(p,"carrera-inscripcion-editar",[],true); await cerrar(p);
 carrera.fecha="2026-11-01"; await p.reload(); await p.getByRole("tab",{name:"Carreras",exact:true}).click(); await boton(p,"Anotar resultado").click(); await foto(p,"carrera-resultado",[],true); await cerrar(p);
 await boton(p,"Eliminar alumno").click(); await foto(p,"alumno-eliminar",[],true); await cerrar(p);
 });
  await grupo("unificada",async p=>{
    plan.sesiones=[sesion(30,"Fuerza",null),sesion(32,"Fuerza",null),sesion(40,"Running",null)];
    plan.distribucion={base:{1:[{tipo:"Running"}],2:[{tipo:"Fuerza",sesionId:id(30)}],3:[{tipo:"Running"}],4:[{tipo:"Fuerza",sesionId:id(32)}],5:[{tipo:"Descanso"}],6:[{tipo:"Running"}],7:[{tipo:"Running"}]}};
    plan.running={"1":{lunes:"Rodaje suave de ejemplo",miercoles:"Entrada suave + pasadas + afloje",sabado:"Técnica y progresivos",domingo:"Fondo suave",volumen:"25,5",sugerencias:"Indicaciones ficticias para explicar la planificación."},"2":{lunes:"Rodaje progresivo"}};
    await p.goto(base+"/alumnos/"+alumnoId);const grilla=p.getByRole("region",{name:"Planificación unificada",exact:true});await grilla.waitFor();
    await foto(p,"planificacion-ficha",[[p.getByRole("heading",{name:alumno.nombre,exact:true}),"La planificación abre en Resumen"]]);
    await foto(p,"planificacion-actividades",[[grilla.getByRole("button",{name:"Fuerza de Martes",exact:true}),"Elegí la actividad para cada día"]]);
    await foto(p,"planificacion-rutina",[[grilla.getByLabel("Rutina de Fuerza para Martes",{exact:true}),"Vinculá Fuerza · Día 1 o Día 2"]]);
    await foto(p,"planificacion-grilla",[[grilla.getByLabel("Lunes, semana 1",{exact:true}),"Texto de Running para esta semana"]]);
    await boton(p,"Crear rutina").click();await foto(p,"planificacion-crear",[],true);await cerrar(p);
    await grilla.getByRole("button",{name:"Abrir Fuerza · Día 1, Martes, semana 1",exact:true}).click();await p.getByRole("dialog").getByLabel("Sentadilla, semana 1",{exact:true}).waitFor();await foto(p,"planificacion-modal-profe",[],true);await boton(p,"Listo").click();
    await grilla.getByRole("button",{name:"Cambiar Viernes, semana 1",exact:true}).click();await foto(p,"planificacion-excepcion",[],true);await boton(p,"Listo").click();
    await boton(p,"Duplicar semana").click();await foto(p,"planificacion-copiar",[],true);await cerrar(p);
    await p.setViewportSize({width:390,height:900});await foto(p,"planificacion-movil",[[grilla.getByLabel("Semana de planificación",{exact:true}),"Una semana a la vez"]]);
    const demo=await pagina("alumno");await demo.page.goto(base+"/mi-plan");await demo.page.getByRole("button",{name:"Abrir Fuerza · Día 1, Martes, semana 1",exact:true}).click();await foto(demo.page,"planificacion-modal-alumno",[],true);await demo.ctx.close();
  });
} finally { await browser.close(); }
