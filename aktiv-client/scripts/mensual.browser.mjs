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
async function recargar(page) { await page.reload(); }
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
const alumnoId = "a0000000-0000-4000-8000-000000000001";
const otroAlumnoId = "a0000000-0000-4000-8000-000000000098";
const usuario = "a0000000-0000-4000-8000-000000000002";
const planId = "a0000000-0000-4000-8000-000000000003";
const sesionId = "a0000000-0000-4000-8000-000000000004";
const ejercicioId = "a0000000-0000-4000-8000-000000000005";
const planes = [{ id: planId, nombre: "Base 10K · Seis semanas", tipo: "Fuerza", inicio: "2026-11-02", semanas: 6, activo: true, orden: 0, sesiones: [{
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
let fallarCopia = false;
let ejerciciosCatalogo = [];
let categoriasCatalogo = [];
let carrerasCatalogo = [], inscripcionesCatalogo = [];
let modelosCatalogo = [], fallarAsignacionModelo = false, lecturasModelos = 0;
let actividadesCatalogo = ["Fuerza", "Running"];
let fallarCategoria = false;
let parchesActivos = 0, maximoParalelo = 0;
const seguimientos = new Map();
let fallarSeguimiento = false;
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
    datos.carreras = carrerasCatalogo; datos.inscripciones = inscripcionesCatalogo;
    datos.categoriasEjercicio = categoriasCatalogo;
    if (process.argv.includes("--duplicar-plan")) datos.alumnos.push({ ...structuredClone(datos.alumnos[0]), id: otroAlumnoId, userId: null, nombre: "Otro alumno", email: "otro@entrenamiento.test" });
    let body; let status = 200;
    if (path === "/auth/me") body = { session };
    else if (path === "/datos") body = datos;
    else if (path === "/actividades-plan") { if(req.method()==="GET") body=actividadesCatalogo; else { const nombre=req.postDataJSON().nombre;actividadesCatalogo=[...new Set([...actividadesCatalogo,nombre])];body={nombre}; } }
    else if (path === "/planes-modelo" && req.method() === "GET") { lecturasModelos++; body = modelosCatalogo.map((p)=>({id:p.id,nombre:p.nombre,semanas:p.semanas,dias:p.sesiones.length,tipos:[...new Set(p.sesiones.map((s)=>s.tipo))]})); }
    else if (/^\/planes-modelo\/desde-plan\/[^/]+$/.test(path)) {
      const dto=req.postDataJSON(),p=planes.find((p)=>path.endsWith(p.id));
      body={id:dto.id,nombre:dto.nombre,semanas:p.semanas,sesiones:structuredClone(p.sesiones),revision:0};modelosCatalogo.push(body);status=201;
    }
    else if (path === "/planes-modelo" && req.method() === "POST") {
      const dto=req.postDataJSON(); const sesiones=[];
      for(const [tipo,cantidad] of (Array.isArray(dto.diasIniciales)?dto.diasIniciales.map((a)=>[a.tipo,a.dias]):[["Fuerza",dto.diasIniciales.fuerza],["Running",dto.diasIniciales.running]])) for(let i=0;i<cantidad;i++) sesiones.push({id:crypto.randomUUID(),tipo,nombre:`${tipo} · Día ${i+1}`,dia:null,franja:"Sin definir",orden:sesiones.length,calentamiento:"",enfriamiento:"",bloques:[],activacion:[],ejercicios:[]});
      body={id:dto.id,nombre:dto.nombre,semanas:dto.semanas,sesiones,revision:0};modelosCatalogo.push(body);status=201;
    }
    else if (/^\/planes-modelo\/[^/]+$/.test(path) && req.method() === "GET") { lecturasModelos++; body = structuredClone(modelosCatalogo.find((p)=>path.endsWith(p.id))); }
    else if (/^\/planes-modelo\/[^/]+\/contenido$/.test(path)) {
      const p=modelosCatalogo.find((p)=>path.includes(p.id)),op=req.postDataJSON(),partes=op.ruta.split("/");
      if(partes[1]==="planes-mensuales"&&partes[3]==="running"){p.running??={};if(partes[4]==="copiar")p.running[op.datos.destino]=structuredClone(p.running[op.datos.origen]??{});else p.running[op.datos.semana]={...p.running[op.datos.semana],[op.datos.campo]:op.datos.texto};}
      else if(partes[1]==="planes-mensuales") p.sesiones.push({...op.datos,orden:p.sesiones.length,ejercicios:[]});
      else if(partes[1]==="sesiones") {
        const s=p.sesiones.find((s)=>s.id===partes[2]);
        if(op.metodo==="PATCH")Object.assign(s,op.datos);
        else s.ejercicios.push({...op.datos,orden:s.ejercicios.length,semanas:Array.from({length:p.semanas},(_,i)=>({semana:i+1,prescripcion:"",peso:null,pesoFecha:null}))});
      } else {
        const e=p.sesiones.flatMap((s)=>s.ejercicios).find((e)=>e.id===partes[2]);
        Object.assign(partes[3]==="semanas"?e.semanas.find((c)=>c.semana===Number(partes[4])):e,op.datos);
      }
      p.revision++;body={id:p.id};
    }
    else if (/^\/planes-modelo\/[^/]+\/asignar$/.test(path)) {
      if(fallarAsignacionModelo){fallarAsignacionModelo=false;status=503;body={codigo:"fallo_prueba",mensaje:"Fallo controlado de asignación"};}
      else { const p=modelosCatalogo.find((p)=>path.includes(p.id)),dto=req.postDataJSON();planes.push({...structuredClone(p),...dto,activo:false,orden:planes.length});body={id:dto.id};status=201; }
    }
    else if (/^\/planes-modelo\/[^/]+\/duplicar$/.test(path)) {
      const p=modelosCatalogo.find((p)=>path.includes(p.id)),dto=req.postDataJSON();body={...structuredClone(p),...dto,revision:0};modelosCatalogo.push(body);status=201;
    }
    else if (/^\/planes-modelo\/[^/]+$/.test(path) && req.method() === "DELETE") {
      modelosCatalogo=modelosCatalogo.filter((p)=>!path.endsWith(p.id));await route.fulfill({status:204});return;
    }
    else if (/^\/carreras\/[^/]+$/.test(path) && req.method() === "PATCH") {
      const c = carrerasCatalogo.find((c) => path.endsWith(c.id)); Object.assign(c, req.postDataJSON()); body = { id: c.id };
    }
    else if (/^\/inscripciones\/[^/]+$/.test(path) && req.method() === "PATCH") {
      const i = inscripcionesCatalogo.find((i) => path.endsWith(i.id)); Object.assign(i, req.postDataJSON()); body = { id: i.id };
    }
    else if (path === "/catalogo/categorias" && req.method() === "POST") {
      if (fallarCategoria) { fallarCategoria = false; status = 503; body = { codigo: "fallo_prueba", mensaje: "Fallo controlado al crear categoría" }; }
      else { const nombre = req.postDataJSON().nombre; categoriasCatalogo.push(nombre); body = { nombre }; }
    }
    else if (path === "/catalogo/ejercicios" && req.method() === "POST") {
      const dto = req.postDataJSON(); ejerciciosCatalogo.push(dto); status = 201; body = { id: dto.id };
    }
    else if (path === "/agenda") body = { horarios: [], clases: [] };
    else if (/^\/sesiones\/[^/]+\/seguimiento\/\d+$/.test(path)) {
      const semana = Number(path.split("/").at(-1));
      if (req.method() === "PATCH") {
        if (fallarSeguimiento) {
          fallarSeguimiento = false;
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ codigo: "fallo_prueba", mensaje: "No se pudo guardar el seguimiento" }) }); return;
        }
        const dto = req.postDataJSON();
        seguimientos.set(path, { semana, ...dto, fecha: dto.completado ? "2026-11-02T18:00:00Z" : null });
      }
      body = { registro: seguimientos.get(path) ?? { semana, completado: false, sensacion: null, nota: "", fecha: null }, habilitado: rol === "alumno" };
    }
    else if (req.method() === "GET" && path.endsWith("/planes-mensuales")) {

      if (demoraLectura) await new Promise((resolve) => setTimeout(resolve, demoraLectura));
      if (errorLectura) { status = 503; body = { codigo: "fallo_prueba", mensaje: "Fallo controlado de lectura" }; }
      else body = sinPlanes ? [] : structuredClone(planes.filter((p) => path.includes(p.alumnoId ?? alumnoId)));
    }
    else if(path.includes("/running") && req.method()!=="GET") {
      if(demora)await new Promise(resolve=>setTimeout(resolve,demora));
      if(fallar){fallar=false;status=503;body={mensaje:"Fallo controlado de Running",codigo:"fallo_prueba"};}
      else{const p=planes.find(p=>path.includes(p.id)),dto=req.postDataJSON();p.running??={};
        if(path.endsWith("/copiar"))p.running[dto.destino]=structuredClone(p.running[dto.origen]??{});
        else p.running[dto.semana]={...p.running[dto.semana],[dto.campo]:dto.texto};body={id:p.id};}
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
    } else if (req.method() === "POST" && /^\/planes-mensuales\/[^/]+\/duplicar$/.test(path)) {
      if (fallarCopia) {
        fallarCopia = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ codigo: "fallo_prueba", mensaje: "No se pudo duplicar el plan" }) }); return;
      }
      const dto = req.postDataJSON();
      const copia = structuredClone(planes.find((p) => path.includes(p.id)));
      Object.assign(copia, dto, { activo: false, orden: planes.length });
      copia.sesiones = copia.sesiones.map((s) => ({ ...s, id: crypto.randomUUID(),
        activacion: (s.activacion ?? []).map((a) => ({ ...a, id: crypto.randomUUID() })),
        ejercicios: s.ejercicios.map((e) => ({ ...e, id: crypto.randomUUID(), semanas: e.semanas.map((c) => ({ ...c, peso: null, pesoFecha: null })) })),
      }));
      planes.push(copia); status = 201; body = { id: dto.id };
    } else if (req.method() === "POST" && path.endsWith("/duplicar")) {
      if (fallarCopia) {
        fallarCopia = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ codigo: "fallo_prueba", mensaje: "No se pudo duplicar el día" }) }); return;
      }
      const dto = req.postDataJSON();
      const plan = planes.find((p) => p.sesiones.some((s) => path.includes(s.id)));
      const origen = plan.sesiones.find((s) => path.includes(s.id));
      const copia = structuredClone(origen);
      Object.assign(copia, dto, { orden: Math.max(...plan.sesiones.map((s) => s.orden)) + 1 });
      copia.activacion = (copia.activacion ?? []).map((e) => ({ ...e, id: crypto.randomUUID() }));
      copia.ejercicios = copia.ejercicios.map((e) => ({ ...e, id: crypto.randomUUID(), semanas: e.semanas.map((c) => ({ ...c, peso: null, pesoFecha: null })) }));
      plan.sesiones.push(copia); status = 201; body = { id: dto.id };
    } else if (req.method() === "POST" && path.endsWith("/planes-mensuales")) {
      const { diasIniciales, ...dto } = req.postDataJSON();
      const sesiones = [];
      for (const [tipo, cantidad] of (Array.isArray(diasIniciales)?diasIniciales.map((a)=>[a.tipo,a.dias]):[["Fuerza", diasIniciales?.fuerza ?? 0], ["Running", diasIniciales?.running ?? 0]])) {
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
// Los recorridos del editor retirado fueron reemplazados por planificacion.browser.mjs.
try {
  if (process.argv.includes("--calendario")) {
    const fuerza = structuredClone(planes[0].sesiones[0]);
    planes[0].sesiones.push({ ...structuredClone(fuerza), id: crypto.randomUUID(), tipo: "Running", nombre: "Running A", orden: 1, ejercicios: [] });
    planes[0].sesiones.push({ ...structuredClone(fuerza), id: crypto.randomUUID(), tipo: "Running", nombre: "Running B", dia: 4, orden: 2, ejercicios: [] });
    for (const ancho of [1440, 390]) {
      const { page, ctx } = await pagina("alumno", ancho);
      await page.goto(`${baseUrl}/mi-plan`);await page.getByRole("button",{name:"Vista diaria",exact:true}).click();
      const calendario = page.getByRole("group", { name: "Días de la semana", exact: true });
      const lunes = calendario.getByRole("button", { name: "Lunes", exact: true });
      assert.match(await lunes.innerText(), /Fuerza\s+Día 1/);
      assert.match(await lunes.innerText(), /Running\s+Día 1/);
      const jueves = calendario.getByRole("button", { name: "Jueves", exact: true });
      assert.match(await jueves.innerText(), /Running\s+Día 2/);
      const filas = await calendario.getByRole("button").evaluateAll((botones) => botones.map((b) => Math.round(b.getBoundingClientRect().top)));
      assert.equal(new Set(filas).size, ancho === 1440 ? 1 : 2);
      assert.equal(await calendario.evaluate((e) => e.scrollWidth <= e.clientWidth), true);
      await jueves.click();
      assert.equal(await jueves.getAttribute("aria-pressed"), "true");
      await page.getByText("Running B", { exact: true }).waitFor();
      await page.screenshot({ path: join(destino, `calendario-alumno-${ancho}.png`) });
      const domingo = calendario.getByRole("button", { name: "Domingo", exact: true });
      assert.match(await domingo.innerText(), /Descanso/);
      await domingo.click();
      await page.getByText("No hay entrenamientos asignados para este día.", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await ctx.close();
    }
    assert.deepEqual(errores, []);
    console.log("OK: calendario del alumno con días numerados por tipo, doble entrenamiento, selección y descanso en escritorio/móvil.");
  }
  else if (process.argv.includes("--duplicar-plan")) {
    for (const ancho of [1440, 390]) {
      const { page, ctx } = await pagina("coach", ancho);
      await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
      await page.getByRole("region",{name:"Planificación unificada",exact:true}).waitFor();
      const cantidad = planes.length;
      await page.getByRole("button", { name: "Duplicar plan de entrenamiento", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Planificación completa", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(planes.length, cantidad);
      await page.getByRole("button", { name: "Duplicar plan de entrenamiento", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Planificación completa", exact: true }).click();
      const modal = page.getByRole("dialog");
      const nombre = `Plan copiado ${ancho}`;
      await modal.getByLabel("Nombre del plan", { exact: true }).fill(nombre);
      fallarCopia = true;
      await modal.getByRole("button", { name: "Duplicar plan", exact: true }).click();
      await modal.getByRole("alert").waitFor();
      assert.equal(await modal.getByLabel("Nombre del plan", { exact: true }).inputValue(), nombre);
      assert.equal(planes.length, cantidad);
      await modal.getByRole("button", { name: "Duplicar plan", exact: true }).click();
      await modal.waitFor({ state: "hidden" });
      await page.getByRole("switch",{name:"Activar plan",exact:true}).waitFor();
      assert.equal(planes.at(-1).nombre, nombre);
      assert.equal(planes.at(-1).activo, false);
      assert.equal(planes[0].activo, true);
      assert.equal(planes.at(-1).semanas, 6);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.getByRole("button", { name: "Duplicar plan de entrenamiento", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Planificación completa", exact: true }).click();
      const alumno = modal.getByRole("combobox", { name: "Alumno de destino", exact: true });
      await alumno.fill("Otro alumno");
      await page.getByRole("option", { name: /Otro alumno/ }).waitFor({ state: "visible" });
      await alumno.press("ArrowDown");
      await alumno.press("Enter");
      assert.equal(planes.length, cantidad + 1);
      await modal.getByLabel("Nombre del plan", { exact: true }).waitFor({ state: "visible" });
      await modal.getByLabel("Nombre del plan", { exact: true }).fill(`Destino ${ancho}`);
      await modal.getByRole("button", { name: "Duplicar plan", exact: true }).click();
      await modal.waitFor({ state: "hidden" });
      assert.equal(planes.at(-1).alumnoId, otroAlumnoId);
      await page.getByRole("button", { name: "Ver alumno", exact: true }).click();
      await page.waitForURL(`**/alumnos/${otroAlumnoId}`);
      await page.getByRole("region",{name:"Planificación unificada",exact:true}).waitFor();
      await page.getByRole("button",{name:"Editar plan de entrenamiento",exact:true}).filter({ hasText: `Destino ${ancho}` }).waitFor();
      await ctx.close();
    }
    assert.deepEqual(errores, []);
    console.log("OK: duplicar plan en escritorio/móvil, cancelar, error/reintento, borrador y destino otro alumno.");
  }
  else if (process.argv.includes("--carga")) {
    demoraLectura = 1800;
    const { page, ctx } = await pagina("coach", 390);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await page.getByText("Cargando planes…", { exact: true }).waitFor();
    assert.equal(await page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Vista del plan anterior", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Día de descanso", { exact: true }).count(), 0);
    await page.getByRole("region",{name:"Planificación unificada",exact:true}).waitFor();
    errorLectura = true;
    await recargar(page);
    await page.getByText("Fallo controlado de lectura", { exact: true }).waitFor();
    assert.equal(await page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Vista del plan anterior", { exact: true }).count(), 0);
    errorLectura = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByRole("region",{name:"Planificación unificada",exact:true}).waitFor();
    await ctx.close();
    const estudiante = await pagina("alumno", 390);
    await estudiante.page.goto(`${baseUrl}/mi-plan`);
    await estudiante.page.getByText("Cargando planes…", { exact: true }).waitFor();
    assert.equal(await estudiante.page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    await estudiante.page.getByRole("region",{name:"Planificación unificada",exact:true}).waitFor();
    await estudiante.page.getByRole("button", { name: /^Semana siguiente de plan/ }).waitFor();
    assert.equal(await estudiante.page.getByText("Mi semana", { exact: true }).count(), 0);
    await estudiante.ctx.close();
    assert.deepEqual(errores, []);
    console.log("OK: carga lenta de profesor/alumno y error/reintento sin mostrar distribución anterior ni leyendas prematuras.");
  }
  else if (process.argv.includes("--carreras")) {
    for (const ancho of [390, 1440]) {
      const carrera = { id: crypto.randomUUID(), coachId: usuario, nombre: "Carrera Palmar", fecha: "2030-12-01", lugar: "Palmar", distanciasKm: [5, 10], notas: "" };
      const inscripcion = { id: crypto.randomUUID(), alumnoId, carreraId: carrera.id, distanciaKm: 5, objetivoSeg: 1800, resultadoSeg: null };
      carrerasCatalogo = [carrera]; inscripcionesCatalogo = [inscripcion];
      const { page, ctx } = await pagina("coach", ancho);
      await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
      await page.getByRole("tab", { name: "Carreras", exact: true }).click();
      await page.getByRole("button", { name: "Editar inscripción a Carrera Palmar", exact: true }).click();
      let dialogo = page.getByRole("dialog");
      assert.match(await dialogo.getByLabel("Objetivo", { exact: true }).inputValue(), /\d+:\d+/);
      await dialogo.getByLabel("Objetivo", { exact: true }).fill("Terminar cómodo y bajar de 50 min en 10K");
      await dialogo.getByRole("combobox", { name: "Distancia", exact: true }).click();
      await page.getByRole("option", { name: "10K", exact: true }).click();
      const guardado = page.waitForResponse((r) => r.url().endsWith(`/inscripciones/${inscripcion.id}`) && r.request().method() === "PATCH");
      await dialogo.getByRole("button", { name: "Guardar", exact: true }).click(); await guardado;
      await recargar(page); await page.getByRole("tab", { name: "Carreras", exact: true }).click();
      await page.getByText("Objetivo Terminar cómodo y bajar de 50 min en 10K", { exact: true }).waitFor();
      assert.equal(inscripcion.distanciaKm, 10); assert.equal(inscripcion.objetivoSeg, null);
      await page.goto(`${baseUrl}/carreras`);
      await page.getByRole("button", { name: "Editar Carrera Palmar", exact: true }).click();
      dialogo = page.getByRole("dialog");
      await dialogo.getByLabel("Otra distancia en kilómetros", { exact: true }).fill("7,5");
      await dialogo.getByRole("button", { name: "Agregar", exact: true }).click();
      const cambio = page.waitForResponse((r) => r.url().endsWith(`/carreras/${carrera.id}`) && r.request().method() === "PATCH");
      await dialogo.getByRole("button", { name: "Guardar", exact: true }).click(); await cambio;
      assert(carrera.distanciasKm.includes(7.5));
      await page.getByRole("button", { name: "Editar Carrera Palmar", exact: true }).click();
      await dialogo.getByRole("button", { name: "10K", exact: true }).click();
      await dialogo.getByRole("button", { name: "Guardar", exact: true }).click();
      await dialogo.getByRole("alert").filter({ hasText: "Cambiá su inscripción" }).waitFor();
      assert(carrera.distanciasKm.includes(10));
      await dialogo.getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await ctx.close();
    }
    assert.deepEqual(errores, []);
    console.log("OK: objetivo libre conserva tiempos anteriores, texto mixto y cambio de distancia persistentes; edición de distancias de carrera y protección de inscriptos.");
  }
  else if (process.argv.includes("--modelos")) {
    ejerciciosCatalogo=[{id:crypto.randomUUID(),nombre:"Sentadilla",categoria:"Fuerza"}];
    const {page,ctx}=await pagina("coach",390);
    await page.goto(`${baseUrl}/planes`);
    await page.getByText("Creá tu primer plan modelo",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Nuevo plan",exact:true}).click();
    let dialogo=page.getByRole("dialog");
    await dialogo.getByLabel("Nombre",{exact:true}).fill("Base principiantes");
    await dialogo.getByLabel("Días de fuerza",{exact:true}).first().fill("1");
    await dialogo.getByRole("checkbox",{name:"Running",exact:true}).check();
    await dialogo.getByLabel("Días de running",{exact:true}).fill("1");
    await dialogo.getByRole("button",{name:"Crear modelo",exact:true}).click();
    await page.getByRole("heading",{name:"Base principiantes",exact:true}).waitFor();
    const modelo=modelosCatalogo[0];assert.equal(modelo.sesiones.length,2);await page.getByRole("button",{name:"Editor de rutinas",exact:true}).click();
    assert.equal(await page.getByText(/Este plan .*terminó/).count(),0);
    await page.getByRole("button",{name:"Crear bloque",exact:true}).click();
    await page.getByText("Guardado automáticamente",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Agregar ejercicio",exact:true}).click();
    const combo=page.getByRole("combobox",{name:"Ejercicio",exact:true});await combo.fill("Sentadilla");
    await page.getByRole("option",{name:/^Sentadilla/}).click();
    await page.getByRole("textbox",{name:"Sentadilla, semana 1",exact:true}).fill("4x8");
    await page.getByText("Guardado automáticamente",{exact:true}).waitFor();
    assert.equal(modelo.sesiones[0].ejercicios[0].semanas[0].prescripcion,"4x8");
    assert.equal(await page.getByRole("region",{name:/Seguimiento de semana/}).count(),0);
    await page.getByRole("group",{name:"Tipo de entrenamiento",exact:true}).getByRole("button",{name:"Running",exact:true}).click();
    await page.getByRole("region",{name:"Planilla de Running",exact:true}).waitFor();
    assert.equal(modelo.sesiones.length,2);
    await page.getByRole("button",{name:"Asignar a alumno",exact:true}).click();dialogo=page.getByRole("dialog");
    await dialogo.getByRole("combobox",{name:"Alumno",exact:true}).fill("Alumno");
    await page.getByRole("option",{name:/Alumno Apellido/}).click();
    fallarAsignacionModelo=true;
    await dialogo.getByRole("button",{name:"Asignar como borrador",exact:true}).click();
    await dialogo.getByRole("alert").filter({hasText:"Fallo controlado"}).waitFor();
    assert.equal(await dialogo.getByLabel("Nombre",{exact:true}).inputValue(),"Base principiantes");
    await dialogo.getByRole("button",{name:"Asignar como borrador",exact:true}).click();
    await dialogo.waitFor({state:"hidden"});
    const copia=planes.at(-1);assert.equal(copia.activo,false);assert.equal(planes[0].activo,true);
    await page.getByRole("group",{name:"Tipo de entrenamiento",exact:true}).getByRole("button",{name:"Fuerza",exact:true}).click();
    await page.getByRole("textbox",{name:"Sentadilla, semana 1",exact:true}).fill("6x8");
    await page.getByText("Guardado automáticamente",{exact:true}).waitFor();
    assert.equal(copia.sesiones[0].ejercicios[0].semanas[0].prescripcion,"4x8");
    await recargar(page);await page.getByRole("button",{name:"Editor de rutinas",exact:true}).click();await page.getByRole("textbox",{name:"Sentadilla, semana 1",exact:true}).waitFor();
    assert.equal(await page.getByRole("textbox",{name:"Sentadilla, semana 1",exact:true}).inputValue(),"6x8");
    await page.waitForLoadState("networkidle");const lecturasAntes=lecturasModelos;
    await page.getByRole("textbox",{name:"Sentadilla, semana 1",exact:true}).fill("7x8");
    await page.getByText("Guardado automáticamente",{exact:true}).waitFor();assert.equal(lecturasModelos,lecturasAntes);
    await page.getByRole("button",{name:"Todos los modelos",exact:true}).click();
    await page.getByRole("button",{name:"Mixto",exact:true}).click();
    await page.getByRole("heading",{name:"Base principiantes",exact:true}).waitFor();
    await page.getByRole("button",{name:"Duplicar Base principiantes",exact:true}).click();
    await page.getByRole("dialog").getByRole("button",{name:"Duplicar modelo",exact:true}).click();
    await page.getByRole("heading",{name:"Base principiantes (copia)",exact:true}).waitFor();
    for(const width of [320,390,1024,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if([390,1440].includes(width))await page.screenshot({path:join(destino,`modelo-editor-${width}.png`),fullPage:true});}
    await page.goto(baseUrl+"/planes");
    for(const width of [320,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
    await page.getByRole("button",{name:"Eliminar Base principiantes (copia)",exact:true}).click();
    await page.getByRole("dialog").getByRole("button",{name:"Eliminar modelo",exact:true}).click();await page.getByRole("dialog").waitFor({state:"hidden"});
    assert.equal(copia.sesiones[0].ejercicios[0].semanas[0].prescripcion,"4x8");
    await ctx.close();assert.deepEqual(errores,[]);
    console.log("OK: biblioteca vacía, crear modelo, editor y autoguardado, agregar running, asignar/error/reintento sin cambiar activo, independencia, recarga, filtros, duplicado y responsive.");
  }
  else throw new Error("Usá --calendario, --duplicar-plan, --carga, --carreras o --modelos. Para la ficha actual: planificacion.browser.mjs");
} catch (error) {
  const modo = process.argv.find(arg => arg.startsWith("--"))?.slice(2) ?? "principal";
  let numero = 0;
  for (const contexto of browser.contexts()) for (const page of contexto.pages()) {
    const prefijo = join(destino, "fallo-" + modo + "-" + (++numero));
    try {
      await page.screenshot({path: prefijo + ".png", fullPage: true, timeout: 5000});
      await import("node:fs/promises").then(fs => fs.writeFile(prefijo + ".txt", page.url() + "\n" + (error.stack ?? String(error))));
    } catch (diagnostico) { console.error("No se pudo capturar el diagnóstico:", diagnostico.message); }
  }
  throw error;
} finally { await browser.close(); }
