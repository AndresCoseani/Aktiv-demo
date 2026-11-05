// Smoke de interfaz con API controlada: no sustituye los e2e con Supabase local.
// PLAYWRIGHT_MODULE apunta al index.mjs de Playwright instalado fuera del repo.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const baseUrl = process.env.MENSUAL_URL ?? "http://localhost:3101";
const destino = process.env.MENSUAL_ARTIFACTS ?? join(process.env.TEMP, "aktiv-mensual-capturas");
await mkdir(destino, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
const alumnoId = "a0000000-0000-4000-8000-000000000001";
const usuario = "a0000000-0000-4000-8000-000000000002";
const planId = "a0000000-0000-4000-8000-000000000003";
const sesionId = "a0000000-0000-4000-8000-000000000004";
const ejercicioId = "a0000000-0000-4000-8000-000000000005";
const planes = [{ id: planId, nombre: "Base 10K · Seis semanas", inicio: "2026-11-02", semanas: 6, activo: true, orden: 0, sesiones: [{
  id: sesionId, dia: 1, nombre: "Fuerza A", tipo: "Fuerza", bloques: [1], calentamiento: "1. Activación con rolo\n2. Movilidad de cadera", enfriamiento: "Estiramientos suaves", orden: 0,
  ejercicios: [{ id: ejercicioId, nombre: "Zumo", grupo: 1, orden: 0, descanso: "60 s", semanas: ["4×8", "", "5×8", "", "6×6", ""].map((prescripcion, i) => ({ semana: i + 1, prescripcion, peso: null, pesoFecha: null })) }],
}] }];
let fallar = false;
let demora = 0;
let sinPlanes = false;
let demoraLectura = 0;
let errorLectura = false;
let demoraAlta = 0;
let fallarAlta = false;
let ejerciciosCatalogo = [];
let lecturasPlanes = 0, parchesActivos = 0, maximoParalelo = 0;
const errores = [];
async function pagina(rol, ancho) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 1000 }, timezoneId: "America/Argentina/Buenos_Aires" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-11-02T18:00:00Z") });
  page.on("pageerror", (e) => errores.push(e.message));
  await page.route("**/api/**", async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname.slice(4);
    const session = { username: "prueba@test.local", role: rol, nombre: rol === "coach" ? "Lucas" : "Alumno de prueba", userId: usuario, ...(rol === "alumno" ? { alumnoId } : {}) };
    const datos = { session, alumnos: [{ id: alumnoId, userId: usuario, coachId: usuario, nombre: "Alumno Apellido Compuesto", email: "alumno.apellido.compuesto@entrenamiento.test", telefono: "+54 11 5555-0040", objetivo: "10K", nivel: "Intermedio", activo: true, proximoPago: "2026-11-19", altaEn: "2026-10-01", planes: [], semana: Array.from({ length: 7 }, () => ({ correr: false, fuerza: false })), ficha: { fechaNacimiento: null, lugarNacimiento: "", enfermedades: "", lesiones: [], certificado: null, contacto: { nombre: "", parentesco: "", telefono: "" } }, marcas: [], notasProfe: "Cuidar la carga del gemelo", notasAlumno: "", acceso: { estado: "activo", expiraEn: null } }], carreras: [], inscripciones: [], ejerciciosCustom: [] };
    if (process.argv.includes("--carga")) datos.alumnos[0].semana = Array.from({ length: 7 }, () => ({ correr: true, fuerza: true }));
    datos.ejerciciosCustom = ejerciciosCatalogo;
    let body; let status = 200;
    if (path === "/auth/me") body = { session };
    else if (path === "/datos") body = datos;
    else if (path === "/agenda") body = { horarios: [], clases: [] };
    else if (req.method() === "GET" && path.endsWith("/planes-mensuales")) {
      lecturasPlanes++;
      if (demoraLectura) await new Promise((resolve) => setTimeout(resolve, demoraLectura));
      if (errorLectura) { status = 503; body = { codigo: "fallo_prueba", mensaje: "Fallo controlado de lectura" }; }
      else body = sinPlanes ? [] : structuredClone(planes);
    }
    else if (req.method() === "PATCH" && /^\/planes-mensuales\/[^/]+$/.test(path)) {
      if (fallar) { fallar = false; status = 503; body = { codigo: "fallo_prueba", mensaje: "Fallo controlado al guardar" }; }
      else {
        const dto = req.postDataJSON(); const plan = planes.find((p) => path.endsWith(p.id));
        if (dto.semanas && dto.semanas > plan.semanas) {
          for (const ej of plan.sesiones.flatMap((s) => s.ejercicios)) {
            for (let semana = plan.semanas + 1; semana <= dto.semanas; semana++) ej.semanas.push({ semana, prescripcion: "", peso: null, pesoFecha: null });
          }
        }
        Object.assign(plan, dto); body = { id: plan.id };
      }
    }
    else if (req.method() === "PATCH" && path.includes("/semanas/")) {
      if (fallar) { fallar = false; status = 503; body = { codigo: "fallo_prueba", mensaje: "Fallo controlado al guardar" }; }
      else {
        const semana = Number(path.split("/").at(-1));
        const ej = planes.flatMap((p) => p.sesiones).flatMap((s) => s.ejercicios).find((e) => path.includes(e.id));
        Object.assign(ej.semanas.find((c) => c.semana === semana), req.postDataJSON()); body = { id: ej.id };
      }
    } else if (req.method() === "PATCH" && /^\/sesiones\/[^/]+$/.test(path)) {
      if (fallar) {
        fallar = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ codigo: "fallo_prueba", mensaje: "Fallo controlado al guardar" }) }); return;
      }
      const sesion = planes.flatMap((p) => p.sesiones).find((s) => path.endsWith(s.id));
      Object.assign(sesion, req.postDataJSON()); body = { id: sesion.id };
    } else if (req.method() === "PATCH" && /^\/sesion-ejercicios\/[^/]+$/.test(path)) {
      const ejercicio = planes.flatMap((p) => p.sesiones).flatMap((s) => s.ejercicios).find((e) => path.endsWith(e.id));
      Object.assign(ejercicio, req.postDataJSON()); body = { id: ejercicio.id };
    } else if (req.method() === "POST" && path.endsWith("/planes-mensuales")) {
      const { diasIniciales, ...dto } = req.postDataJSON();
      const sesiones = [];
      for (const [tipo, cantidad] of [["Fuerza", diasIniciales?.fuerza ?? 0], ["Running", diasIniciales?.running ?? 0]]) {
        for (let n = 1; n <= cantidad; n++) sesiones.push({ id: crypto.randomUUID(), tipo, nombre: `${tipo} · Día ${n}`, dia: null, orden: sesiones.length, calentamiento: "", enfriamiento: "", ejercicios: [] });
      }
      planes.push({ ...dto, orden: planes.length, sesiones }); status = 201; body = { id: dto.id };
    } else if (req.method() === "POST" && path.endsWith("/sesiones")) {
      const dto = req.postDataJSON(); const mes = planes.find((p) => path.includes(p.id));
      mes.sesiones.push({ ...dto, orden: mes.sesiones.length, ejercicios: [] }); status = 201; body = { id: dto.id };
    } else if (req.method() === "POST" && path.endsWith("/ejercicios")) {
      if (demoraAlta) await new Promise((resolve) => setTimeout(resolve, demoraAlta));
      if (fallarAlta) {
        fallarAlta = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ codigo: "fallo_prueba", mensaje: "No se pudo crear el ejercicio" }) });
        return;
      }
      const dto = req.postDataJSON(); const sesion = planes.flatMap((p) => p.sesiones).find((s) => path.includes(s.id));
      const mes = planes.find((p) => p.sesiones.includes(sesion));
      sesion.ejercicios.push({ ...dto, orden: sesion.ejercicios.length, semanas: Array.from({ length: mes.semanas }, (_, i) => ({ semana: i + 1, prescripcion: "", peso: null, pesoFecha: null })) }); status = 201; body = { id: dto.id };
    } else if (req.method() === "DELETE" && /^\/sesion-ejercicios\/[^/]+$/.test(path)) {
      for (const sesion of planes.flatMap((p) => p.sesiones)) sesion.ejercicios = sesion.ejercicios.filter((e) => !path.endsWith(e.id));
      await route.fulfill({ status: 204 }); return;
    } else throw new Error(`Pedido no esperado: ${req.method()} ${path}`);
    const parche = req.method() === "PATCH";
    if (parche) { parchesActivos++; maximoParalelo = Math.max(maximoParalelo, parchesActivos); }
    try {
      if (parche && demora) await new Promise((resolve) => setTimeout(resolve, demora));
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    } finally { if (parche) parchesActivos--; }
  });
  return { page, ctx };
}
try {
  if (process.argv.includes("--guardado-rapido")) {
    const { page, ctx } = await pagina("coach", 1440);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    await page.getByLabel("Zumo, semana 6", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Momento del día", { exact: true }).count(), 0);
    const lecturasAntes = lecturasPlanes;
    await page.clock.pauseAt(new Date("2026-11-02T18:10:00Z"));
    demora = 400;
    for (let s = 1; s <= 6; s++) await page.getByLabel(`Zumo, semana ${s}`, { exact: true }).fill(`${s + 3}x10`);
    await page.clock.runFor(301);
    await page.clock.resume();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert(maximoParalelo >= 2 && maximoParalelo <= 4, `Se esperaban parches paralelos acotados, hubo ${maximoParalelo}`);
    assert.equal(lecturasPlanes, lecturasAntes, "Guardar una sesión no debe descargar todos los planes");
    assert.deepEqual(planes[0].sesiones[0].ejercicios[0].semanas.map((s) => s.prescripcion), ["4x10", "5x10", "6x10", "7x10", "8x10", "9x10"]);
    await page.getByRole("button", { name: "Editar entrenamiento", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Día de la semana", { exact: true }).selectOption("2");
    await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(lecturasPlanes, lecturasAntes);
    assert.match(await page.getByRole("button", { name: "Día 1", exact: true }).innerText(), /Mar/);
    await page.reload();
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    assert.equal(await page.getByLabel("Zumo, semana 6", { exact: true }).inputValue(), "9x10");
    await page.getByRole("button", { name: "Editar entrenamiento", exact: true }).click();
    assert.equal(await page.getByRole("dialog").getByLabel("Día de la semana", { exact: true }).inputValue(), "2");
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.deepEqual(errores, []);
    await ctx.close();
    console.log(`OK: seis semanas guardadas con hasta ${maximoParalelo} pedidos simultáneos, sin recargar planes; selector actualizado y persistencia tras recargar.`);
  } else if (process.argv.includes("--calentamiento")) {
    ejerciciosCatalogo = [{ id: crypto.randomUUID(), nombre: "Rolo", categoria: "Movilidad" }, { id: crypto.randomUUID(), nombre: "Hip thrust", categoria: "Fuerza" }];
    const { page, ctx } = await pagina("coach", 390);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    const entrada = page.getByRole("region", { name: "Entrada en calor", exact: true });
    const texto = entrada.getByRole("textbox", { name: "Entrada en calor", exact: true });
    assert.match(await texto.inputValue(), /Activación con rolo/);
    await texto.fill("Una sola serie por ejercicio");
    await entrada.getByRole("button", { name: "Agregar ejercicio de entrada en calor", exact: true }).click();
    await entrada.getByRole("combobox", { name: "Ejercicio", exact: true }).fill("Rolo");
    await page.getByRole("option", { name: /^Rolo/ }).click();
    const posicionEjercicio = await entrada.getByRole("combobox", { name: "Ejercicio", exact: true }).boundingBox();
    const posicionAgregar = await entrada.getByRole("button", { name: "Agregar ejercicio de entrada en calor", exact: true }).boundingBox();
    const posicionTexto = await texto.boundingBox();
    assert(posicionEjercicio.y < posicionAgregar.y && posicionAgregar.y < posicionTexto.y, "Ejercicios y Agregar deben estar antes de las indicaciones generales");
    fallar = true;
    await entrada.getByLabel("Indicación de activación 1", { exact: true }).fill("1 min por grupo muscular");
    await page.getByRole("alert").filter({ hasText: "Fallo controlado" }).waitFor();
    assert.equal(await texto.inputValue(), "Una sola serie por ejercicio");
    await page.getByRole("button", { name: "Reintentar guardado", exact: true }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    await entrada.getByText("Filtro del catálogo", { exact: true }).click();
    await entrada.getByRole("checkbox", { name: "Solo movilidad y activación", exact: true }).uncheck();
    await entrada.getByRole("button", { name: "Agregar ejercicio de entrada en calor", exact: true }).click();
    await entrada.getByRole("combobox", { name: "Ejercicio", exact: true }).nth(1).fill("Hip thrust");
    await page.getByRole("option", { name: /^Hip thrust/ }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(planes[0].sesiones[0].activacion[1].nombre, "Hip thrust");
    assert.equal(await entrada.getByLabel("Indicación de activación 1", { exact: true }).getAttribute("placeholder"), "Opcional");
    await entrada.locator("[data-activacion-id]").first().evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
    const origen = await entrada.getByRole("button", { name: "Reordenar activación 2", exact: true }).boundingBox();
    const destinoFila = await entrada.locator("[data-activacion-id]").first().boundingBox();
    await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
    await page.mouse.down();
    await page.mouse.move(destinoFila.x + destinoFila.width / 2, destinoFila.y + 10, { steps: 8 });
    await page.mouse.up();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.deepEqual(planes[0].sesiones[0].activacion.map((e) => e.nombre), ["Hip thrust", "Rolo"]);
    await entrada.getByRole("button", { name: "Reordenar activación 1", exact: true }).press("ArrowDown");
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.deepEqual(planes[0].sesiones[0].activacion.map((e) => e.nombre), ["Rolo", "Hip thrust"]);
    const tactil = await ctx.newCDPSession(page);
    const agarreTactil = await entrada.getByRole("button", { name: "Reordenar activación 2", exact: true }).boundingBox();
    const filaTactil = await entrada.locator("[data-activacion-id]").first().boundingBox();
    await tactil.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: agarreTactil.x + agarreTactil.width / 2, y: agarreTactil.y + agarreTactil.height / 2 }] });
    await tactil.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: filaTactil.x + filaTactil.width / 2, y: filaTactil.y + 10 }] });
    await tactil.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.deepEqual(planes[0].sesiones[0].activacion.map((e) => e.nombre), ["Hip thrust", "Rolo"]);
    await page.reload();
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    assert.equal(await entrada.getByRole("combobox", { name: "Ejercicio", exact: true }).first().inputValue(), "Hip thrust");
    await entrada.getByRole("button", { name: "Reordenar activación 1", exact: true }).press("ArrowDown");
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    await entrada.getByRole("button", { name: "Quitar ejercicio de entrada en calor 2", exact: true }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    assert.equal(await texto.inputValue(), "Una sola serie por ejercicio");
    assert.equal(await entrada.getByLabel("Indicación de activación 1", { exact: true }).inputValue(), "1 min por grupo muscular");
    assert.equal(planes[0].sesiones[0].activacion.length, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: join(destino, "entrada-calor-mixta.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: join(destino, "plan-minimal-escritorio.png"), fullPage: true });
    await ctx.close();
    const alumno = await pagina("alumno", 390);
    await alumno.page.goto(`${baseUrl}/mi-plan`);
    await alumno.page.getByText("Una sola serie por ejercicio", { exact: true }).waitFor();
    const ejercicioLectura = alumno.page.getByText("1. Rolo", { exact: true });
    await ejercicioLectura.waitFor();
    await alumno.page.getByText("1 min por grupo muscular", { exact: true }).waitFor();
    const nombreLectura = await ejercicioLectura.boundingBox();
    const dosisLectura = await alumno.page.getByText("1 min por grupo muscular", { exact: true }).boundingBox();
    const generalesLectura = await alumno.page.getByText("Una sola serie por ejercicio", { exact: true }).boundingBox();
    assert(Math.abs(nombreLectura.y - dosisLectura.y) < 5, "La indicación debe estar al lado del ejercicio cuando entra");
    assert(generalesLectura.y > nombreLectura.y, "Las indicaciones generales deben estar al final");
    const bloqueAlumno = alumno.page.getByRole("region", { name: "Bloque 1", exact: true });
    assert.equal(await bloqueAlumno.getByRole("heading").innerText(), "Bloque 1");
    const fila = await bloqueAlumno.locator("li").first().boundingBox();
    const campoPeso = await bloqueAlumno.getByRole("textbox").first().boundingBox();
    assert(fila.height <= 144, "El ejercicio debe conservar una fila compacta en celular");
    assert(campoPeso.x >= fila.x && campoPeso.x + campoPeso.width <= fila.x + fila.width + 1 && campoPeso.y + campoPeso.height <= fila.y + fila.height, "El registro de peso debe quedar dentro de la fila sin recortarse");
    await alumno.ctx.close();
    assert.deepEqual(errores, []);
    console.log("OK: texto libre + catálogo de activación, dosis, error/reintento, otros tipos, quitar, recarga y lectura del alumno.");
  } else if (process.argv.includes("--catalogo")) {
    ejerciciosCatalogo = ["Hiptrust", "Hip Trust"].map((nombre) => ({ id: crypto.randomUUID(), nombre, categoria: "Fuerza" }));
    const { page, ctx } = await pagina("coach", 390);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    const buscador = page.getByRole("combobox", { name: "Ejercicio", exact: true });
    await buscador.fill("Hip");
    await page.getByRole("option", { name: /Hiptrust/ }).waitFor();
    assert.equal(await page.getByRole("option", { name: /Hip/i }).count(), 1);
    await buscador.fill("HIP_TRUST");
    await page.getByRole("option", { name: /Hiptrust/ }).waitFor();
    assert.equal(await page.getByText(/Crear .*HIP_TRUST/).count(), 0);
    await page.getByRole("option", { name: /Hiptrust/ }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(planes[0].sesiones[0].ejercicios[0].nombre, "Hiptrust");
    assert.deepEqual(errores, []);
    await ctx.close();
    console.log("OK: catálogo sin opciones equivalentes duplicadas, búsqueda con separadores y selección de nombre existente.");
  } else if (process.argv.includes("--semanas")) {
    const { page, ctx } = await pagina("coach", 1440);
    for (const total of [5, 12]) {
      planes[0].semanas = total;
      planes[0].sesiones[0].ejercicios[0].semanas = Array.from({ length: total }, (_, i) => ({ semana: i + 1, prescripcion: i ? "" : "4×8", peso: null, pesoFecha: null }));
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
      await page.getByRole("tab", { name: "Plan", exact: true }).click();
      await page.getByLabel("Zumo, semana 5", { exact: true }).waitFor();
      if (total === 5) assert.equal(await page.getByRole("textbox", { name: /^Zumo, semana/ }).count(), 5);
      await page.getByRole("button", { name: `Semana ${total}`, exact: true }).click();
      const ultima = page.getByLabel(`Zumo, semana ${total}`, { exact: true });
      await ultima.fill("3×8");
      await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
      for (const ancho of [1024, 390]) {
        await page.setViewportSize({ width: ancho, height: 1000 });
        await ultima.waitFor();
        if (ancho === 390) {
          await page.getByText(new RegExp(`^Editando semana ${total} de ${total}`)).waitFor();
          assert.equal(await page.getByRole("textbox", { name: /^Zumo, semana/ }).count(), 1);
        }
        assert.equal(await ultima.inputValue(), "3×8");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      }
      assert.equal(planes[0].sesiones[0].ejercicios[0].semanas[total - 1].prescripcion, "3×8");
    }
    await ctx.close();
    assert.deepEqual(errores, []);
    console.log("OK: cinco columnas en plan de cinco semanas, adaptación a anchos, semana 12 accesible, edición y guardado sin overflow.");
  } else if (process.argv.includes("--bloques-vacios")) {
    planes[0].sesiones[0].ejercicios = [];
    planes[0].sesiones[0].bloques = [];
    const { page, ctx } = await pagina("coach", 390);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    await page.getByRole("button", { name: "Crear bloque", exact: true }).click();
    await page.getByRole("button", { name: "Crear bloque", exact: true }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.deepEqual(planes[0].sesiones[0].bloques, [1, 2]);
    assert.equal(planes[0].sesiones[0].ejercicios.length, 0);
    await page.reload();
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    const primero = page.getByRole("region", { name: "Bloque 1", exact: true });
    const segundo = page.getByRole("region", { name: "Bloque 2", exact: true });
    await segundo.waitFor();
    await primero.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
    await primero.getByLabel("Ejercicio, semana 1", { exact: true }).waitFor();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    await primero.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
    await primero.getByLabel("Ejercicio, semana 1", { exact: true }).nth(1).waitFor();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.deepEqual(planes[0].sesiones[0].ejercicios.map((e) => e.grupo), [1, 1]);
    assert.equal(await page.getByRole("region", { name: "Bloque 3", exact: true }).count(), 0);
    await segundo.getByRole("button", { name: "Eliminar bloque 2 vacío", exact: true }).click();
    await segundo.waitFor({ state: "hidden" });
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    await primero.getByText("2 ejercicios juntos", { exact: true }).waitFor();
    assert.deepEqual(planes[0].sesiones[0].bloques, [1]);
    assert.deepEqual(errores, []);
    await ctx.close();
    console.log("OK: crear bloques vacíos persistentes, agregar dos ejercicios dentro del mismo bloque y eliminar bloque vacío.");
  } else if (process.argv.includes("--alta")) {
    planes[0].sesiones[0].ejercicios[0].grupo = 7;
    planes[0].sesiones[0].bloques = [7];
    demoraAlta = 1800; fallarAlta = true;
    const { page, ctx } = await pagina("coach", 1440);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    await page.getByLabel("Zumo, semana 1", { exact: true }).fill("4×10");
    await page.getByRole("button", { name: "Crear bloque", exact: true }).click();
    await page.getByRole("region", { name: "Bloque 2", exact: true }).getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
    const nuevo = page.getByLabel("Ejercicio, semana 1", { exact: true });
    await nuevo.waitFor();
    assert.equal(planes[0].sesiones[0].ejercicios.length, 1, "La tarjeta debe aparecer antes de que responda el servidor");
    await page.getByRole("region", { name: "Bloque 1", exact: true }).getByLabel("Zumo, semana 1", { exact: true }).waitFor();
    await page.getByRole("region", { name: "Bloque 2", exact: true }).getByLabel("Ejercicio, semana 1", { exact: true }).waitFor();
    await nuevo.fill("3×12");
    await page.getByRole("alert").filter({ hasText: "No se pudo crear" }).waitFor();
    assert.equal(await nuevo.inputValue(), "3×12");
    assert.equal(await page.getByLabel("Zumo, semana 1", { exact: true }).inputValue(), "4×10");
    await page.getByRole("button", { name: "Reintentar guardado", exact: true }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(planes[0].sesiones[0].ejercicios.length, 2);
    assert.equal(planes[0].sesiones[0].ejercicios[1].semanas[0].prescripcion, "3×12");
    await page.reload();
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    await page.getByRole("region", { name: "Bloque 1", exact: true }).getByLabel("Zumo, semana 1", { exact: true }).waitFor();
    await page.getByRole("region", { name: "Bloque 2", exact: true }).getByLabel("Ejercicio, semana 1", { exact: true }).waitFor();
    assert.equal(await nuevo.inputValue(), "3×12");
    await page.getByRole("button", { name: "Quitar ejercicio", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar", exact: true }).click();
    await nuevo.waitFor({ state: "hidden" });
    demora = 1200; demoraAlta = 1800;
    const guardando = page.waitForRequest((r) => r.method() === "PATCH" && r.url().includes("/semanas/1"));
    await page.getByLabel("Zumo, semana 1", { exact: true }).fill("4×12");
    await guardando;
    await page.getByRole("region", { name: "Bloque 2", exact: true }).getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
    await nuevo.waitFor();
    assert.equal(planes[0].sesiones[0].ejercicios.length, 1, "Debe poder agregar visualmente durante otro guardado");
    await nuevo.fill("2×15");
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(planes[0].sesiones[0].ejercicios[0].semanas[0].prescripcion, "4×12");
    assert.equal(planes[0].sesiones[0].ejercicios[1].semanas[0].prescripcion, "2×15");
    assert.deepEqual(errores, []);
    await ctx.close();
    console.log("OK: alta inmediata al final con números internos discontinuos, servidor lento, fallo/reintento, edición durante el alta y persistencia tras recarga.");
  } else if (process.argv.includes("--bloques")) {
    planes[0].sesiones[0].ejercicios.push({ ...structuredClone(planes[0].sesiones[0].ejercicios[0]), id: crypto.randomUUID(), nombre: "Hip thrust", grupo: 2, orden: 1 });
    const { page, ctx } = await pagina("coach", 1440);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    const bloque1 = page.getByRole("region", { name: "Bloque 1", exact: true });
    const bloque2 = page.getByRole("region", { name: "Bloque 2", exact: true });
    await bloque2.waitFor();
    // ResizeObserver adapta la tabla despu?s del primer render.
    await page.waitForFunction(() => {
      const descanso = document.querySelector('[aria-label="Descanso de Zumo"]')?.getBoundingClientRect();
      const semana = document.querySelector('[aria-label="Zumo, semana 4"]')?.getBoundingClientRect();
      return descanso && semana && descanso.x > semana.x && Math.abs(descanso.y - semana.y) < 2;
    });
    const descanso = await page.getByLabel("Descanso de Zumo", { exact: true }).boundingBox();
    const semana4 = await page.getByLabel("Zumo, semana 4", { exact: true }).boundingBox();
    assert(descanso.x > semana4.x && Math.abs(descanso.y - semana4.y) < 2, "Descanso fuera del final de la fila");
    const agregar = await page.getByRole("button", { name: "Crear bloque", exact: true }).boundingBox();
    const ultima = await bloque2.boundingBox();
    assert(agregar.y >= ultima.y + ultima.height, "Agregar debe quedar debajo de los bloques");
    await page.getByRole("button", { name: "Arrastrar Hip thrust a otro bloque", exact: true }).dragTo(bloque1);
    await page.getByText("2 ejercicios juntos", { exact: true }).waitFor();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(planes[0].sesiones[0].ejercicios[1].grupo, 1);
    await page.screenshot({ path: join(destino, "bloques-escritorio.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 900 });
    await bloque1.getByText("Mover a otro bloque", { exact: true }).nth(1).click();
    await page.getByRole("combobox", { name: "Mover Hip thrust a bloque", exact: true }).selectOption("2");
    await bloque2.waitFor();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    await bloque2.waitFor();
    assert.equal(planes[0].sesiones[0].ejercicios[1].grupo, 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: join(destino, "bloques-celular.png"), fullPage: true });
    await ctx.close();
    assert.deepEqual(errores, []);
    console.log("OK: arrastrar a bloque, separar con selector móvil, autoguardado/recarga, descanso al final y botón debajo.");
  } else if (process.argv.includes("--carga")) {
    demoraLectura = 1800;
    const { page, ctx } = await pagina("coach", 390);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByText("Cargando semana de entrenamiento…", { exact: true }).waitFor();
    assert.equal(await page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Vista del plan anterior", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Día de descanso", { exact: true }).count(), 0);
    await page.getByText("Base 10K · Seis semanas · Asignación opcional al calendario", { exact: true }).waitFor();
    errorLectura = true;
    await page.reload();
    await page.getByText("No pudimos consultar la semana de entrenamiento.", { exact: true }).waitFor();
    assert.equal(await page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Vista del plan anterior", { exact: true }).count(), 0);
    errorLectura = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByText("Base 10K · Seis semanas · Asignación opcional al calendario", { exact: true }).waitFor();
    await ctx.close();
    const estudiante = await pagina("alumno", 390);
    await estudiante.page.goto(`${baseUrl}/mi-plan`);
    await estudiante.page.getByText("Cargando planes…", { exact: true }).waitFor();
    assert.equal(await estudiante.page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    await estudiante.page.getByRole("button", { name: "Semana 2", exact: true }).waitFor();
    assert.equal(await estudiante.page.getByText("Mi semana", { exact: true }).count(), 0);
    await estudiante.ctx.close();
    assert.deepEqual(errores, []);
    console.log("OK: carga lenta de profesor/alumno y error/reintento sin mostrar distribución anterior ni leyendas prematuras.");
  } else if (process.argv.includes("--responsive")) {
    planes[0].semanas = 5;
    for (const ejercicio of planes[0].sesiones.flatMap((s) => s.ejercicios)) ejercicio.semanas = ejercicio.semanas.slice(0, 5);
    const { page, ctx } = await pagina("coach", 375);
    for (const vacio of [true, false]) {
      sinPlanes = vacio;
      for (const ancho of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width: ancho, height: 900 });
        await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
        await page.getByRole("tab", { name: "Plan", exact: true }).click();
        await page.getByRole("heading", { name: "Plan de entrenamiento", exact: true }).waitFor();
        if (vacio) await page.getByText("Creá un plan, elegí su duración y agregá las sesiones.", { exact: true }).waitFor();
        else {
          await page.getByLabel("Zumo, semana 1", { exact: true }).waitFor();
          assert.equal(await page.getByRole("group", { name: "Semana del plan", exact: true }).getByRole("button").count(), 5);
          await page.getByRole("button", { name: "Semana 5", exact: true }).click();
          await page.getByText("Semana 5 de 5", { exact: true }).waitFor();
          await page.getByRole("button", { name: "Semana 1", exact: true }).click();
        }
        const fuera = await page.evaluate(() => [...document.querySelectorAll("main, header, nav, section, h1, [role=tablist], [role=switch], input:not([type=hidden]), button")]
          .filter((e) => { if (e.hasAttribute("data-semana")) return false; const r = e.getBoundingClientRect(); return r.width > 1 && (r.right > window.innerWidth + 1 || r.left < -1); })
          .map((e) => ({ etiqueta: e.tagName, texto: (e.getAttribute("aria-label") || e.textContent || "").slice(0, 60), clase: e.className })));
        if (fuera.length) console.log(JSON.stringify({ ancho, vacio, fuera }));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Overflow en ${ancho}px, vacío=${vacio}`);
        assert.deepEqual(fuera, [], `Controles cortados en ${ancho}px, vacío=${vacio}`);
        if ([320, 375, 1440].includes(ancho)) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: join(destino, `responsive-${ancho}-${vacio ? "vacio" : "plan"}.png`), fullPage: true });
          if (!vacio) {
            await page.getByRole("button", { name: "Editar plan de entrenamiento", exact: true }).click();
            const modal = page.getByRole("dialog");
            await modal.getByRole("heading", { name: "Editar plan", exact: true }).waitFor();
            const caja = await modal.boundingBox();
            assert(caja.x >= 0 && caja.x + caja.width <= ancho, "Modal de edición fuera de pantalla");
            await page.screenshot({ path: join(destino, `editar-plan-${ancho}.png`), fullPage: true });
            await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
          }
        }
      }
    }
    planes[0].semanas = 12;
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByRole("tab", { name: "Plan", exact: true }).click();
    await page.getByRole("button", { name: "Semanas siguientes", exact: true }).click();
    await page.getByRole("button", { name: "Semana 12", exact: true }).click();
    await page.getByText("Semana 12 de 12", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await ctx.close();
    console.log(`OK: planes vacíos y cargados sin controles cortados en 320, 360, 375, 390, 430, 768, 1024 y 1440 px. Capturas: ${destino}`);
  } else {
  const { page, ctx } = await pagina("coach", 1440);
  await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByLabel("Zumo, semana 1", { exact: true }).waitFor();
  assert.equal(await page.getByText("Editar nombre, inicio y duración", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Editar plan de entrenamiento", exact: true }).click();
  let editar = page.getByRole("dialog");
  await editar.getByLabel("Nombre", { exact: true }).fill("Nombre descartado");
  await editar.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Editar plan de entrenamiento", exact: true }).click();
  editar = page.getByRole("dialog");
  assert.equal(await editar.getByLabel("Nombre", { exact: true }).inputValue(), "Base 10K · Seis semanas");
  await editar.getByLabel("Nombre", { exact: true }).fill("Base 10K editada");
  await editar.getByLabel("Fecha de inicio", { exact: true }).fill("03/11/2026");
  await editar.getByLabel("Duración en semanas", { exact: true }).fill("8");
  fallar = true;
  await editar.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await editar.getByRole("alert").filter({ hasText: "Fallo controlado" }).waitFor();
  assert.equal(await editar.getByLabel("Nombre", { exact: true }).inputValue(), "Base 10K editada");
  await editar.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await editar.waitFor({ state: "hidden" });
  assert.equal(planes[0].nombre, "Base 10K editada");
  assert.equal(planes[0].inicio, "2026-11-03");
  assert.equal(planes[0].semanas, 8);
  await page.screenshot({ path: join(destino, "profe-escritorio.png"), fullPage: true });
  assert.equal(await page.getByLabel("Zumo, semana 2", { exact: true }).getAttribute("placeholder"), "4×8");
  fallar = true;
  await page.getByLabel("Zumo, semana 1", { exact: true }).fill("4×10");
  await page.getByRole("button", { name: "Running", exact: true }).click();
  assert.equal(await page.getByLabel("Zumo, semana 1", { exact: true }).inputValue(), "4×10", "Cambiar de día perdió un borrador");
  await page.getByRole("alert").filter({ hasText: "Fallo controlado" }).waitFor();
  assert.equal(await page.getByLabel("Zumo, semana 1", { exact: true }).inputValue(), "4×10");
  await page.getByRole("button", { name: "Reintentar guardado", exact: true }).click();
  await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: /^Entrada en calor/ }).fill("1. Rolo\n2. Movilidad");
  await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
  assert.equal(planes[0].sesiones[0].calentamiento, "1. Rolo\n2. Movilidad");
  demora = 1200;
  const enCurso = page.waitForRequest((r) => r.method() === "PATCH" && r.url().endsWith(`/sesiones/${sesionId}`));
  const entrada = page.getByRole("textbox", { name: /^Entrada en calor/ });
  await entrada.fill("Primera edición");
  await enCurso;
  await entrada.fill("Segunda edición mientras se guarda");
  await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
  assert.equal(planes[0].sesiones[0].calentamiento, "Segunda edición mientras se guarda");
  assert.equal(await entrada.inputValue(), "Segunda edición mientras se guarda");
  assert.equal(await entrada.evaluate((e) => document.activeElement === e), true, "El autoguardado perdió el foco");
  demora = 0;
  await page.reload();
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  assert.equal(await page.getByLabel("Zumo, semana 1", { exact: true }).inputValue(), "4×10");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("button", { name: "Semana 2", exact: true }).click();
  assert.equal(await page.getByLabel("Zumo, semana 1", { exact: true }).isVisible(), false);
  assert.equal(await page.getByLabel("Zumo, semana 2", { exact: true }).isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Overflow horizontal en móvil");
  await page.screenshot({ path: join(destino, "profe-celular.png"), fullPage: true });
  await page.getByRole("button", { name: "Semana 6", exact: true }).click();
  assert.equal(await page.getByLabel("Zumo, semana 6", { exact: true }).getAttribute("placeholder"), "6×6");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole("button", { name: "Nuevo plan", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Nombre del plan", { exact: true }).fill("Preparación de ocho semanas");
  await page.getByRole("dialog").getByLabel("Duración en semanas", { exact: true }).fill("8");
  assert.equal(await page.getByRole("button", { name: "Crear plan", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Seleccionar tipos de entrenamiento", exact: true }).click();
  await page.getByRole("checkbox", { name: "Running", exact: true }).check();
  await page.getByRole("checkbox", { name: "Fuerza", exact: true }).check();
  await page.getByRole("checkbox", { name: "Running", exact: true }).uncheck();
  assert.equal(await page.getByLabel("Días de running", { exact: true }).count(), 0);
  await page.getByRole("checkbox", { name: "Running", exact: true }).check();
  await page.screenshot({ path: join(destino, "tipos-checklist.png"), fullPage: true });
  await page.getByRole("button", { name: "Seleccionar tipos de entrenamiento", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Días de fuerza", { exact: true }).fill("2");
  await page.getByRole("dialog").getByLabel("Días de running", { exact: true }).fill("1");
  const fechaInicio = page.getByRole("dialog").getByLabel("Fecha de inicio", { exact: true });
  assert.equal(await fechaInicio.inputValue(), "02/11/2026");
  await fechaInicio.fill("31/02/2026");
  await page.getByRole("button", { name: "Crear plan", exact: true }).click();
  assert.equal(planes.length, 1, "Se envió una fecha inexistente");
  await fechaInicio.fill("03/12/2026");
  await page.getByRole("dialog").locator('input[type="date"]').fill("2026-12-04");
  assert.equal(await fechaInicio.inputValue(), "04/12/2026");
  await page.screenshot({ path: join(destino, "fecha-espanol.png"), fullPage: true });
  await page.getByRole("button", { name: "Crear plan", exact: true }).click();
  await page.getByText("Creá un plan, elegí su duración y agregá las sesiones.", { exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Día 1", exact: true }).waitFor();
  assert.equal(planes.at(-1).sesiones.length, 3);
  assert.equal(planes.at(-1).sesiones[0].dia, null);
  await page.getByRole("button", { name: "Crear bloque", exact: true }).click();
  const ejercicioCreado = page.waitForResponse((respuesta) =>
    respuesta.request().method() === "POST" &&
    /\/sesiones\/[^/]+\/ejercicios$/.test(new URL(respuesta.url()).pathname) &&
    respuesta.status() === 201);
  await page.getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
  await page.getByLabel("Ejercicio, semana 1", { exact: true }).waitFor();
  await ejercicioCreado;
  assert.equal(planes.at(-1).sesiones[0].ejercicios[0].semanas.length, 8);
  assert.equal(planes.at(-1).inicio, "2026-12-04", "La fecha enviada debe conservar ISO");
  await page.getByRole("button", { name: "Crear Día 3", exact: true }).click();
  await page.getByRole("button", { name: "Día 2", exact: true }).waitFor();
  await page.getByRole("button", { name: "Running", exact: true }).click();
  await page.getByRole("button", { name: "Crear Día 2", exact: true }).click();
  await page.getByRole("button", { name: "Día 2", exact: true }).waitFor();
  await page.getByRole("button", { name: "Día 1", exact: true }).waitFor();
  assert.equal(planes.at(-1).sesiones.filter((s) => s.tipo === "Running").length, 2);
  assert(planes.at(-1).sesiones.every((s) => s.dia === null));
  await page.screenshot({ path: join(destino, "dias-numerados.png"), fullPage: true });
  for (const tipo of ["Running", "Fuerza"]) {
    await page.getByRole("button", { name: "Nuevo plan", exact: true }).click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Nombre del plan", { exact: true }).fill(`Solo ${tipo}`);
    await page.getByRole("button", { name: "Seleccionar tipos de entrenamiento", exact: true }).click();
    await page.getByRole("checkbox", { name: tipo, exact: true }).check();
    await page.getByRole("button", { name: "Seleccionar tipos de entrenamiento", exact: true }).click();
    const label = tipo === "Running" ? "Días de running" : "Días de fuerza";
    const otro = tipo === "Running" ? "Días de fuerza" : "Días de running";
    assert.equal(await modal.getByLabel(otro, { exact: true }).count(), 0);
    await modal.getByLabel(label, { exact: true }).fill("0");
    const antes = planes.length;
    await modal.getByRole("button", { name: "Crear plan", exact: true }).click();
    assert.equal(planes.length, antes, "Se permitió un tipo sin días");
    await modal.getByLabel(label, { exact: true }).fill("2");
    await page.screenshot({ path: join(destino, `nuevo-plan-${tipo}.png`), fullPage: true });
    await modal.getByRole("button", { name: "Crear plan", exact: true }).click();
    await modal.waitFor({ state: "hidden" });
    assert.equal(planes.at(-1).sesiones.length, 2);
    assert(planes.at(-1).sesiones.every((s) => s.tipo === tipo));
  }
  await ctx.close();
  const estudiante = await pagina("alumno", 390);
  await estudiante.page.goto(`${baseUrl}/mi-plan`);
  await estudiante.page.getByRole("button", { name: "Semana 2", exact: true }).click();
  await estudiante.page.getByText("4×10", { exact: true }).waitFor();
  await estudiante.page.getByRole("button", { name: "Semana 6", exact: true }).click();
  await estudiante.page.getByText("6×6", { exact: true }).waitFor();
  await estudiante.page.getByLabel("Peso de Zumo, semana 6", { exact: true }).fill("12,5");
  await estudiante.page.getByText("Guardado", { exact: true }).waitFor();
  assert.equal(planes[0].sesiones[0].ejercicios[0].semanas[5].peso, "12,5");
  assert.equal(planes[0].sesiones[0].ejercicios[0].semanas[1].peso, null);
  assert.equal(planes[0].sesiones[0].ejercicios[0].semanas[0].peso, null);
  await estudiante.page.evaluate(() => window.scrollTo(0, 0));
  await estudiante.page.screenshot({ path: join(destino, "alumno-celular.png"), fullPage: true });
  assert.equal(await estudiante.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Overflow en vista del alumno");
  assert.deepEqual(errores, []);
  await estudiante.ctx.close();
  console.log(`OK: autoguardado, error/reintento, edición durante pedidos lentos sin perder foco, días numerados independientes por tipo, modal de edición, planes de 6 y 8 semanas, escritorio, celular, altas, protección del borrador, herencia, recarga y peso semanal. Capturas: ${destino}`);
  }
} finally { await browser.close(); }
