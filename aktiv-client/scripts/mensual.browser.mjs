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
// Las pruebas del calendario anterior vuelven a esa vista explícitamente tras recargar.
async function abrirRutinas(page) {
 const resumen=page.getByText("Ver más planes",{exact:true});await resumen.waitFor();
 if(!await resumen.evaluate(e=>e.parentElement.open))await resumen.click();
 await page.getByRole("button",{name:"Organizar rutinas",exact:true}).click();
}
async function recargar(page) { const diaria=await page.getByRole("button",{name:"Ver grilla semanal",exact:true}).count()>0;await page.reload();if(diaria)await page.getByRole("button",{name:"Vista diaria",exact:true}).click(); }
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
const alumnoId = "a0000000-0000-4000-8000-000000000001";
const otroAlumnoId = "a0000000-0000-4000-8000-000000000098";
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
let fallarCopia = false;
let ejerciciosCatalogo = [];
let categoriasCatalogo = [];
let carrerasCatalogo = [], inscripcionesCatalogo = [];
let modelosCatalogo = [], fallarAsignacionModelo = false, lecturasModelos = 0;
let actividadesCatalogo = ["Fuerza", "Running"];
let fallarCategoria = false;
let lecturasPlanes = 0, parchesActivos = 0, maximoParalelo = 0;
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
      lecturasPlanes++;
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
try {
  if(process.argv.includes("--running-tipos")) {
    planes[0].semanas=4;
    for(const ancho of [1440,390]) {
      const {page,ctx}=await pagina("coach",ancho);await page.goto(baseUrl+"/alumnos/"+alumnoId);await abrirRutinas(page);await page.getByRole("button",{name:"Running",exact:true}).click();
      assert.equal(await page.getByLabel("Semana de Running",{exact:true}).isVisible(),ancho<768);
      const actividad=page.getByLabel("Actividad de Martes, semana 1",{exact:true}),texto=page.getByLabel("Martes, semana 1",{exact:true});
      await texto.fill("Rodaje que se conserva");await page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));
      fallar=true;await actividad.selectOption("GYM");await page.getByRole("alert").filter({hasText:"Fallo controlado de Running"}).waitFor();assert.equal(await texto.count(),0);await page.getByRole("button",{name:"Reintentar guardado",exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('[role="alert"]')&&!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));assert.equal(planes[0].running[1].martes,"Rodaje que se conserva");
      await recargar(page);await abrirRutinas(page);await page.getByRole("button",{name:"Running",exact:true}).click();assert.equal(await actividad.inputValue(),"GYM");assert.equal(await texto.count(),0);
      await actividad.selectOption("Running");assert.equal(await texto.inputValue(),"Rodaje que se conserva");await page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));
      await actividad.selectOption("Descanso");await page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));assert.equal(await texto.count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await ctx.close();
      // Restore editable mode for the next viewport.
      planes[0].running[1].martes_tipo="Running";
    }
    planes[0].running[1].martes_tipo="GYM";const {page,ctx}=await pagina("alumno",390);await page.goto(baseUrl+"/mi-plan");await page.getByRole("button",{name:"Vista diaria",exact:true}).click();await page.getByRole("button",{name:"Martes",exact:true}).click();await page.getByText("GYM",{exact:true}).first().waitFor();assert.equal(await page.getByText("Rodaje que se conserva",{exact:true}).count(),0);await ctx.close();
    assert.deepEqual(errores,[]);console.log("OK: Running/GYM/Descanso, borrador preservado, error/reintento, recarga, navegación responsive y lectura del alumno.");
  } else
  if(process.argv.includes("--dias")) {
    for(const ancho of [1440,390]) {
      const {page,ctx}=await pagina("coach",ancho);await page.goto(baseUrl+"/alumnos/"+alumnoId);await abrirRutinas(page);
      const selector=page.getByRole("button",{name:"Asignar días de la semana",exact:true});await selector.click();
      await page.getByRole("checkbox",{name:"Lunes",exact:true}).check();await page.getByRole("checkbox",{name:"Miércoles",exact:true}).check();await page.getByRole("checkbox",{name:"Viernes",exact:true}).check();
      await page.getByRole("button",{name:"Listo",exact:true}).click();await page.getByText("Guardado automáticamente",{exact:true}).waitFor();
      assert.deepEqual(planes[0].sesiones[0].dias,[1,3,5]);assert.equal(planes[0].sesiones.length,1);
      await recargar(page);await abrirRutinas(page);await selector.click();for(const dia of ["Lunes","Miércoles","Viernes"])assert.equal(await page.getByRole("checkbox",{name:dia,exact:true}).isChecked(),true);
      await page.getByRole("button",{name:"Sin asignar",exact:true}).click();await page.getByRole("button",{name:"Listo",exact:true}).click();await page.getByText("Guardado automáticamente",{exact:true}).waitFor();assert.deepEqual(planes[0].sesiones[0].dias,[]);
      await selector.click();await page.getByRole("checkbox",{name:"Lunes",exact:true}).check();await page.getByRole("checkbox",{name:"Miércoles",exact:true}).check();await page.getByRole("button",{name:"Listo",exact:true}).click();await page.getByText("Guardado automáticamente",{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await ctx.close();
    }
    const {page,ctx}=await pagina("alumno",390);await page.goto(baseUrl+"/mi-plan");await page.getByRole("button",{name:"Vista diaria",exact:true}).click();
    for(const dia of ["Lunes","Miércoles"]) {await page.getByRole("button",{name:dia,exact:true}).click();await page.getByText("Zumo",{exact:true}).waitFor();}
    await ctx.close();assert.deepEqual(errores,[]);console.log("OK: checklist multiselección, limpiar, recarga y misma sesión en varios días del alumno, móvil/escritorio.");
  } else
  if(process.argv.includes("--running")) {
    const fuerzaAntes=structuredClone(planes[0].sesiones);
    for(const ancho of [1440,390]){
      const {page,ctx}=await pagina("coach",ancho);await page.goto(baseUrl+"/alumnos/"+alumnoId);await abrirRutinas(page);await page.getByRole("button",{name:"Running",exact:true}).click();
      const actividades=page.getByRole("group",{name:"Tipo de entrenamiento",exact:true});
      await actividades.getByRole("button",{name:"Agregar actividad",exact:true}).waitFor();
      if(ancho===1440){const running=await actividades.getByRole("button",{name:"Running",exact:true}).boundingBox();const agregar=await actividades.getByRole("button",{name:"Agregar actividad",exact:true}).boundingBox();assert.ok(agregar.x>=running.x+running.width&&Math.abs(agregar.y-running.y)<5);}
      const etiqueta=page.getByRole("region",{name:"Planilla de Running",exact:true}).getByText("Sugerencias",{exact:true});
      assert.ok(await etiqueta.evaluate(el=>el.scrollWidth<=el.clientWidth),"Sugerencias debe caber dentro de su columna");
      await page.getByRole("textbox",{name:"Lunes, semana 1",exact:true}).fill("Rodaje de ejemplo");
      const campo=page.getByRole("textbox",{name:"Martes, semana 1",exact:true});await campo.fill("10 min suaves + 4 × 200 m + afloje");
      await page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));
      if(ancho===1440){demora=900;const enCurso=page.waitForRequest(r=>r.method()==="PATCH"&&r.url().endsWith("/running"));await campo.fill("Borrador anterior");await enCurso;await campo.fill("Edición durante el guardado");await page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));assert.equal(planes[0].running[1].martes,"Edición durante el guardado");demora=0;}
      fallar=true;await campo.fill("15 min suaves + 4 × 200 m + afloje");await page.getByRole("alert").filter({hasText:"Fallo controlado de Running"}).waitFor();assert.equal(await campo.inputValue(),"15 min suaves + 4 × 200 m + afloje");
      await page.getByRole("button",{name:"Reintentar guardado",exact:true}).click();
      await page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…")&&!document.querySelector('[role="alert"]'));
      assert.equal(planes[0].running[1].martes,"15 min suaves + 4 × 200 m + afloje");
      await page.getByRole("button",{name:"Fuerza",exact:true}).click();await page.getByRole("button",{name:"Running",exact:true}).click();assert.equal(await campo.inputValue(),"15 min suaves + 4 × 200 m + afloje");
      await page.getByRole("textbox",{name:"Volumen semanal, semana 1",exact:true}).fill("25,5");await page.getByRole("textbox",{name:"Sugerencias, semana 1",exact:true}).fill("Ejemplo: regular el esfuerzo");
      await page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));
      if(ancho===1440){await page.getByLabel("Grupo de semanas de Running",{exact:true}).selectOption("5");const ultima=page.getByRole("textbox",{name:"Martes, semana 5",exact:true});await ultima.fill("Descanso");await page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));assert.equal(planes[0].running[5].martes,"Descanso");assert.equal(planes[0].running[4],undefined);await page.getByLabel("Grupo de semanas de Running",{exact:true}).selectOption("1");}
      await page.getByRole("button",{name:"Copiar semana",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Cancelar",exact:true}).click();assert.equal(planes[0].running[2],undefined);
      await page.getByRole("button",{name:"Copiar semana",exact:true}).click();await page.getByRole("button",{name:"Reemplazar semana de destino",exact:true}).click();await page.getByRole("dialog").waitFor({state:"hidden"});
      assert.deepEqual(planes[0].running[2],planes[0].running[1]);
      await page.getByRole("tab",{name:"Resumen",exact:true}).click();await page.getByRole("region",{name:"Resumen del alumno",exact:true}).getByText("Rodaje de ejemplo",{exact:true}).waitFor();
      await recargar(page);await abrirRutinas(page);await page.getByRole("button",{name:"Running",exact:true}).click();await campo.waitFor();assert.equal(await campo.inputValue(),"15 min suaves + 4 × 200 m + afloje");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(planes[0].sesiones,fuerzaAntes);await page.getByRole("tab",{name:"Resumen",exact:true}).click();await page.getByRole("region",{name:"Resumen del alumno",exact:true}).getByText("Rodaje de ejemplo",{exact:true}).waitFor();await ctx.close();
      delete planes[0].running[2];
    }
    const alumno=await pagina("alumno",390);await alumno.page.goto(baseUrl+"/mi-plan");await alumno.page.getByRole("button",{name:"Vista diaria",exact:true}).click();const grilla=alumno.page.getByRole("region",{name:"Planilla de Running",exact:true});await grilla.waitFor();await grilla.getByText("15 min suaves + 4 × 200 m + afloje",{exact:true}).waitFor();assert.equal(await grilla.getByRole("textbox").count(),0);await alumno.ctx.close();const m={id:crypto.randomUUID(),nombre:"Modelo Running de prueba",semanas:6,revision:0,running:{},sesiones:structuredClone(fuerzaAntes)};modelosCatalogo.push(m);
    const biblioteca=await pagina("coach",390);await biblioteca.page.goto(baseUrl+"/planes?modelo="+m.id);await biblioteca.page.getByRole("button",{name:"Editor de rutinas",exact:true}).click();await biblioteca.page.getByRole("button",{name:"Running",exact:true}).click();const campoModelo=biblioteca.page.getByRole("textbox",{name:"Martes, semana 1",exact:true});await campoModelo.fill("Texto del modelo Running");await biblioteca.page.waitForFunction(()=>!document.body.innerText.includes("Cambios pendientes")&&!document.body.innerText.includes("Guardando…"));assert.equal(m.running[1].martes,"Texto del modelo Running");assert.equal(m.sesiones.length,fuerzaAntes.length);await biblioteca.page.getByRole("button",{name:"Fuerza",exact:true}).click();await biblioteca.page.getByRole("button",{name:"Running",exact:true}).click();assert.equal(await campoModelo.inputValue(),"Texto del modelo Running");await recargar(biblioteca.page);await biblioteca.page.getByRole("button",{name:"Editor de rutinas",exact:true}).click();await biblioteca.page.getByRole("button",{name:"Running",exact:true}).click();assert.equal(await campoModelo.inputValue(),"Texto del modelo Running");await biblioteca.ctx.close();
    assert.deepEqual(errores,[]);console.log("OK: Running texto libre, guardado, error/reintento, volumen/sugerencias, copia/cancelación, recarga, alumno y Fuerza intacta.");
  } else
  if (process.argv.includes("--simultaneos")) {
    const segundo = structuredClone(planes[0]); segundo.id=crypto.randomUUID();segundo.nombre="Running independiente";segundo.inicio="2026-10-26";
    segundo.sesiones=[{...structuredClone(segundo.sesiones[0]),id:crypto.randomUUID(),tipo:"Running",nombre:"Rodaje independiente",ejercicios:[]}];
    planes.push(segundo);
    const futuro=structuredClone(segundo);futuro.id=crypto.randomUUID();futuro.nombre="Plan futuro";futuro.inicio="2026-12-01";futuro.sesiones[0].id=crypto.randomUUID();futuro.sesiones[0].nombre="No debe aparecer hoy";planes.push(futuro);
    for(const ancho of [320,390,1440]) {
      const {page,ctx}=await pagina("alumno",ancho);await page.goto(`${baseUrl}/mi-plan`);await page.getByRole("button",{name:"Vista diaria",exact:true}).click();
      await page.getByText("Fuerza A",{exact:true}).waitFor();await page.getByText("Rodaje independiente",{exact:true}).waitFor();
      await page.getByText("Running independiente · Semana 2 de 6",{exact:true}).waitFor();
      assert.equal(await page.getByText("No debe aparecer hoy",{exact:true}).count(),0);
      demora=2000;
      const guardandoPeso=page.waitForRequest((r)=>r.method()==="PATCH"&&r.url().includes("/semanas/1"));
      await page.getByLabel("Peso de Zumo, semana 1",{exact:true}).fill(String(30+[320,390,1440].indexOf(ancho)));
      await guardandoPeso;
      await page.getByRole("button",{name:"Semana siguiente",exact:true}).click();
      await page.getByText("Running independiente · Semana 2 de 6",{exact:true}).waitFor();
      await page.getByText("Guardado",{exact:true}).waitFor();
      demora=0;
      await page.getByRole("group",{name:"Filtrar actividades",exact:true}).getByRole("button",{name:"Running",exact:true}).click();
      assert.equal(await page.getByText("Fuerza A",{exact:true}).count(),0);
      await page.getByRole("button",{name:"Semana siguiente",exact:true}).click();
      await page.getByText("Running independiente · Semana 3 de 6",{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:join(destino,`simultaneos-${ancho}.png`),fullPage:true});await ctx.close();
    }
    const {page,ctx}=await pagina("coach",390);await page.goto(`${baseUrl}/alumnos/${alumnoId}`);await abrirRutinas(page);
    await page.getByRole("switch",{name:"Desactivar plan",exact:true}).click();await page.getByRole("switch",{name:"Activar plan",exact:true}).waitFor();
    assert.equal(planes[0].activo,false);assert.equal(planes[1].activo,true);
    await page.getByRole("switch",{name:"Activar plan",exact:true}).click();await page.getByRole("switch",{name:"Desactivar plan",exact:true}).waitFor();assert.equal(planes[1].activo,true);
    await page.getByRole("button",{name:"Agregar actividad",exact:true}).click();await page.getByRole("textbox",{name:"Nombre de la actividad",exact:true}).fill("Movilidad");await page.getByRole("button",{name:"Crear actividad",exact:true}).click();
    await page.getByRole("button",{name:"Crear Día 1",exact:true}).click();await page.getByText("Movilidad · Día 1",{exact:true}).waitFor();
    assert.equal(planes[0].sesiones.at(-1).tipo,"Movilidad");await recargar(page);await abrirRutinas(page);
    await page.getByRole("group",{name:"Tipo de entrenamiento",exact:true}).getByRole("button",{name:"Movilidad",exact:true}).waitFor();await ctx.close();
    assert.deepEqual(errores,[]);console.log("OK: varios activos, semanas independientes por fecha, futuro oculto, filtros, desactivar/reactivar sin afectar otros, actividad propia persistente y responsive.");
  } else
  if (process.argv.includes("--modelos")) {
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
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);await abrirRutinas(page);
    await page.getByRole("button",{name:"Guardar como modelo",exact:true}).click();
    dialogo=page.getByRole("dialog");await dialogo.getByLabel("Nombre",{exact:true}).fill("Modelo desde alumno");
    await dialogo.getByRole("button",{name:"Guardar modelo",exact:true}).click();await dialogo.waitFor({state:"hidden"});
    assert(modelosCatalogo.some((p)=>p.nombre==="Modelo desde alumno"));
    await page.goto(`${baseUrl}/planes`);await page.getByRole("heading",{name:"Modelo desde alumno",exact:true}).waitFor();
    for(const width of [320,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(destino,`modelos-lista-${width}.png`),fullPage:true});}
    await page.getByRole("button",{name:"Eliminar Modelo desde alumno",exact:true}).click();
    await page.getByRole("dialog").getByRole("button",{name:"Eliminar modelo",exact:true}).click();await page.getByRole("dialog").waitFor({state:"hidden"});
    assert.equal(copia.sesiones[0].ejercicios[0].semanas[0].prescripcion,"4x8");
    await ctx.close();assert.deepEqual(errores,[]);
    console.log("OK: biblioteca vacía, crear modelo, editor y autoguardado, agregar running, asignar/error/reintento sin cambiar activo, independencia, recarga, filtros, duplicado y responsive.");
  } else
  if (process.argv.includes("--carreras")) {
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
  } else
  if (process.argv.includes("--movilidad")) {
    const idMovilidad = crypto.randomUUID(), idActivacion = crypto.randomUUID();
    planes[0].sesiones[0].activacion = [{ id: idMovilidad, nombre: "Movilidad de tobillo", indicacion: "10 rep", fase: "Movilidad" }, { id: idActivacion, nombre: "Puente", indicacion: "2x10", fase: "Activación" }, { id: crypto.randomUUID(), nombre: "Activación anterior", indicacion: "1 min" }];
    const { page, ctx } = await pagina("coach", 390);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`); await abrirRutinas(page);
    const movilidad = page.getByRole("region", { name: "Movilidad", exact: true }), activacion = page.getByRole("region", { name: "Activación", exact: true });
    await movilidad.waitFor(); await activacion.waitFor();
    const primero = await movilidad.boundingBox(), segundo = await activacion.boundingBox(); assert(primero.y < segundo.y);
    await activacion.getByRole("button", { name: "Pasar a movilidad", exact: true }).first().click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(planes[0].sesiones[0].activacion.find((e) => e.id === idActivacion).fase, "Movilidad");
    await recargar(page); await abrirRutinas(page);
    const ejerciciosMovilidad = movilidad.getByRole("combobox", { name: "Ejercicio", exact: true });
    await ejerciciosMovilidad.nth(1).waitFor();
    assert.equal(await ejerciciosMovilidad.count(), 2);
    await ctx.close();
    const alumno = await pagina("alumno", 390); await alumno.page.goto(`${baseUrl}/mi-plan`);await alumno.page.getByRole("button",{name:"Vista diaria",exact:true}).click();
    await alumno.page.getByText("1. Movilidad de tobillo", { exact: true }).waitFor();
    const m = await alumno.page.getByRole("region", { name: "Movilidad", exact: true }).boundingBox();
    const a = await alumno.page.getByRole("region", { name: "Activación", exact: true }).boundingBox(); assert(m.y < a.y);
    await alumno.ctx.close(); assert.deepEqual(errores, []);
    console.log("OK: movilidad antes de activación, traslado entre fases, autoguardado/recarga y lectura del alumno sin alterar ejercicios anteriores.");
  } else
  if (process.argv.includes("--seguimiento")) {
    for (const ancho of [1440, 390]) {
      const { page, ctx } = await pagina("alumno", ancho);
      await page.goto(`${baseUrl}/mi-plan`);await page.getByRole("button",{name:"Vista diaria",exact:true}).click();
      const seguimiento = page.getByRole("region", { name: "Seguimiento de semana 1", exact: true });
      await seguimiento.getByRole("button", { name: "Marcar como completado", exact: true }).click();
      await seguimiento.getByRole("group", { name: "Cómo te sentiste" }).getByRole("button", { name: "Bien", exact: true }).click();
      fallarSeguimiento = true;
      await seguimiento.getByLabel("Comentario para Lucas").fill(`Comentario ${ancho}`);
      await seguimiento.getByRole("alert").waitFor();
      assert.equal(await seguimiento.getByLabel("Comentario para Lucas").inputValue(), `Comentario ${ancho}`);
      await seguimiento.getByRole("button", { name: "Reintentar seguimiento" }).click();
      await seguimiento.getByRole("status").filter({ hasText: "Guardado automáticamente" }).waitFor();
      await recargar(page);
      assert.equal(await seguimiento.getByRole("button", { name: "Completado", exact: true }).getAttribute("aria-pressed"), "true");
      assert.equal(await seguimiento.getByLabel("Comentario para Lucas").inputValue(), `Comentario ${ancho}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await ctx.close();
      const profe = await pagina("coach", ancho);
      await profe.page.goto(`${baseUrl}/alumnos/${alumnoId}`);
      await abrirRutinas(profe.page);
      await profe.page.getByText(`Comentario ${ancho}`, { exact: true }).waitFor();
      assert.equal(await profe.page.getByRole("button", { name: "Marcar como completado", exact: true }).count(), 0);
      await profe.ctx.close();
      seguimientos.clear();
    }
    assert.deepEqual(errores, []);
    console.log("OK: seguimiento alumno/profe escritorio/móvil, completado, sensación, autoguardado, error/reintento y recarga.");
  } else
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
  } else
  if (process.argv.includes("--duplicar-plan")) {
    for (const ancho of [1440, 390]) {
      const { page, ctx } = await pagina("coach", ancho);
      await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
      await abrirRutinas(page);
      const cantidad = planes.length;
      await page.getByRole("button", { name: "Duplicar plan de entrenamiento", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(planes.length, cantidad);
      await page.getByRole("button", { name: "Duplicar plan de entrenamiento", exact: true }).click();
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
      const alumno = modal.getByRole("combobox", { name: "Alumno de destino", exact: true });
      await alumno.fill("Otro alumno");
      await page.getByRole("option", { name: /Otro alumno/ }).click();
      await modal.getByLabel("Nombre del plan", { exact: true }).fill(`Destino ${ancho}`);
      await modal.getByRole("button", { name: "Duplicar plan", exact: true }).click();
      await modal.waitFor({ state: "hidden" });
      assert.equal(planes.at(-1).alumnoId, otroAlumnoId);
      await page.getByRole("button", { name: "Ver alumno", exact: true }).click();
      await page.waitForURL(`**/alumnos/${otroAlumnoId}`);
      await abrirRutinas(page);
      await page.getByRole("button",{name:"Editar plan de entrenamiento",exact:true}).filter({ hasText: `Destino ${ancho}` }).waitFor();
      await ctx.close();
    }
    assert.deepEqual(errores, []);
    console.log("OK: duplicar plan en escritorio/móvil, cancelar, error/reintento, borrador y destino otro alumno.");
  } else
  if (process.argv.includes("--duplicar")) {
    for (const ancho of [1440, 390]) {
      const { page, ctx } = await pagina("coach", ancho);
      await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
      await abrirRutinas(page);
      const cantidad = planes[0].sesiones.length;
      await page.getByRole("button", { name: "Duplicar día de entrenamiento", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.equal(planes[0].sesiones.length, cantidad);
      await page.getByRole("button", { name: "Duplicar día de entrenamiento", exact: true }).click();
      const modal = page.getByRole("dialog");
      const nombre = `Copia ${ancho}`;
      await modal.getByLabel("Nombre del día", { exact: true }).fill(nombre);
      await modal.getByRole("button",{name:"Asignar días de la semana",exact:true}).click();await page.getByRole("checkbox",{name:"Miércoles",exact:true}).check();await page.getByRole("button",{name:"Listo",exact:true}).click();
      fallarCopia = true;
      await modal.getByRole("button", { name: "Duplicar día", exact: true }).click();
      await modal.getByRole("alert").waitFor();
      assert.equal(await modal.getByLabel("Nombre del día", { exact: true }).inputValue(), nombre);
      assert.equal(planes[0].sesiones.length, cantidad);
      await modal.getByRole("button", { name: "Duplicar día", exact: true }).click();
      await modal.waitFor({ state: "hidden" });
      await page.getByText(nombre, { exact: true }).waitFor();
      const copia = planes[0].sesiones.at(-1);
      assert.equal(copia.dia, 3);
      assert.equal(planes[0].sesiones.length, cantidad + 1);
      assert.notEqual(copia.ejercicios[0].id, ejercicioId);
      assert(copia.ejercicios[0].semanas.every((c) => c.peso === null && c.pesoFecha === null));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await recargar(page);
      await abrirRutinas(page);
      await page.getByRole("button", { name: `Día ${cantidad + 1}`, exact: true }).click();
      await page.getByText(nombre, { exact: true }).waitFor();
      await ctx.close();
    }
    assert.deepEqual(errores, []);
    console.log("OK: duplicar día en escritorio/móvil, cancelar, error/reintento sin perder datos, selección de copia y recarga.");
  } else
  if (process.argv.includes("--guardado-rapido")) {
    const { page, ctx } = await pagina("coach", 1440);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await abrirRutinas(page);
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
    await page.getByRole("dialog").getByRole("button",{name:"Asignar días de la semana",exact:true}).click();await page.getByRole("checkbox",{name:"Lunes",exact:true}).uncheck();await page.getByRole("checkbox",{name:"Martes",exact:true}).check();await page.getByRole("button",{name:"Listo",exact:true}).click();
    await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(lecturasPlanes, lecturasAntes);
    assert.match(await page.getByRole("button", { name: "Día 1", exact: true }).innerText(), /Mar/);
    await recargar(page);
    await abrirRutinas(page);
    assert.equal(await page.getByLabel("Zumo, semana 6", { exact: true }).inputValue(), "9x10");
    await page.getByRole("button", { name: "Editar entrenamiento", exact: true }).click();
    await page.getByRole("dialog").getByRole("button",{name:"Asignar días de la semana",exact:true}).click();assert.equal(await page.getByRole("checkbox",{name:"Martes",exact:true}).isChecked(),true);await page.getByRole("button",{name:"Listo",exact:true}).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.deepEqual(errores, []);
    await ctx.close();
    console.log(`OK: seis semanas guardadas con hasta ${maximoParalelo} pedidos simultáneos, sin recargar planes; selector actualizado y persistencia tras recargar.`);
  } else if (process.argv.includes("--calentamiento")) {
    ejerciciosCatalogo = [{ id: crypto.randomUUID(), nombre: "Rolo", categoria: "Movilidad" }, { id: crypto.randomUUID(), nombre: "Hip thrust", categoria: "Fuerza" }];
    const { page, ctx } = await pagina("coach", 390);
    await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
    await abrirRutinas(page);
    const entrada = page.getByRole("region", { name: "Entrada en calor", exact: true });
    const texto = entrada.getByRole("textbox", { name: "Entrada en calor", exact: true });
    assert.match(await texto.inputValue(), /Activación con rolo/);
    await texto.fill("Una sola serie por ejercicio");
    await entrada.getByRole("button", { name: "Agregar ejercicio de activación", exact: true }).click();
    await entrada.getByRole("combobox", { name: "Ejercicio", exact: true }).fill("Rolo");
    await page.getByRole("option", { name: /^Rolo/ }).click();
    const posicionEjercicio = await entrada.getByRole("combobox", { name: "Ejercicio", exact: true }).boundingBox();
    const posicionAgregar = await entrada.getByRole("button", { name: "Agregar ejercicio de activación", exact: true }).boundingBox();
    const posicionTexto = await texto.boundingBox();
    assert(posicionEjercicio.y < posicionAgregar.y && posicionAgregar.y < posicionTexto.y, "Ejercicios y Agregar deben estar antes de las indicaciones generales");
    fallar = true;
    await entrada.getByLabel("Indicación de activación 1", { exact: true }).fill("1 min por grupo muscular");
    await page.getByRole("alert").filter({ hasText: "Fallo controlado" }).waitFor();
    assert.equal(await texto.inputValue(), "Una sola serie por ejercicio");
    await page.getByRole("button", { name: "Reintentar guardado", exact: true }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(await entrada.getByRole("checkbox", { name: "Solo movilidad y activación", exact: true }).count(), 0);
    await entrada.getByRole("button", { name: "Agregar ejercicio de activación", exact: true }).click();
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
    await recargar(page);
    await abrirRutinas(page);
    assert.equal(await entrada.getByRole("combobox", { name: "Ejercicio", exact: true }).first().inputValue(), "Hip thrust");
    await entrada.getByRole("button", { name: "Reordenar activación 1", exact: true }).press("ArrowDown");
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    await entrada.getByRole("button", { name: "Quitar ejercicio de entrada en calor 2", exact: true }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    await recargar(page);
    await abrirRutinas(page);
    assert.equal(await texto.inputValue(), "Una sola serie por ejercicio");
    assert.equal(await entrada.getByLabel("Indicación de activación 1", { exact: true }).inputValue(), "1 min por grupo muscular");
    assert.equal(planes[0].sesiones[0].activacion.length, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: join(destino, "entrada-calor-mixta.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({ path: join(destino, "plan-minimal-escritorio.png"), fullPage: true });
    await ctx.close();
    const alumno = await pagina("alumno", 390);
    await alumno.page.goto(`${baseUrl}/mi-plan`);await alumno.page.getByRole("button",{name:"Vista diaria",exact:true}).click();
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
    await abrirRutinas(page);
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
    // Las categorías vacías también se conservan y aparecen en el plan.
    await buscador.fill("Ejercicio de equilibrio");
    await page.getByRole("button", { name: "Nueva categoría", exact: true }).click();
    await page.getByRole("textbox", { name: "Nombre de categoría", exact: true }).fill("Equilibrio");
    await page.getByRole("button", { name: "Crear categoría", exact: true }).click();
    const catalogoGuardado = page.waitForResponse((r) => r.url().endsWith("/api/catalogo/ejercicios") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Crear ejercicio en Equilibrio", exact: true }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(planes[0].sesiones[0].ejercicios[0].nombre, "Ejercicio de equilibrio");
    await catalogoGuardado;
    assert.equal(ejerciciosCatalogo.at(-1).categoria, "Equilibrio");
    await recargar(page);
    await abrirRutinas(page);
    const entrada = page.getByRole("region", { name: "Entrada en calor", exact: true });
    await entrada.getByRole("button", { name: "Agregar ejercicio de activación", exact: true }).click();
    await entrada.getByRole("combobox", { name: "Ejercicio", exact: true }).fill("Ejercicio de equilibrio");
    await page.getByRole("option", { name: /^Ejercicio de equilibrio/ }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.equal(planes[0].sesiones[0].activacion[0].nombre, "Ejercicio de equilibrio");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(`${baseUrl}/ejercicios`);
    await page.getByRole("button", { name: "Nueva categoría", exact: true }).click();
    const dialogoCategoria = page.getByRole("dialog");
    await dialogoCategoria.getByRole("textbox", { name: "Nombre", exact: true }).fill("Agilidad");
    fallarCategoria = true;
    await dialogoCategoria.getByRole("button", { name: "Crear categoría", exact: true }).click();
    await dialogoCategoria.getByRole("alert").waitFor();
    assert.equal(await dialogoCategoria.getByRole("textbox", { name: "Nombre", exact: true }).inputValue(), "Agilidad");
    await dialogoCategoria.getByRole("button", { name: "Crear categoría", exact: true }).click();
    await dialogoCategoria.waitFor({ state: "hidden" });
    await recargar(page);
    const filtroAgilidad = page.getByRole("group", { name: "Filtrar por categoría", exact: true }).getByRole("button", { name: /^Agilidad(?:\s|\d|$)/ });
    await filtroAgilidad.waitFor();
    await filtroAgilidad.click();
    assert.equal(await filtroAgilidad.getAttribute("aria-pressed"), "true");
    await page.getByText("Todavía no hay ejercicios en esta categoría.", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.scrollBehavior), "smooth");
    assert.deepEqual(errores, []);
    await ctx.close();
    console.log("OK: catálogo normalizado, categorías nuevas persistentes en entrenamiento y calentamiento, alta independiente, error/reintento y responsive.");
  } else if (process.argv.includes("--semanas")) {
    const { page, ctx } = await pagina("coach", 1440);
    for (const total of [5, 12]) {
      planes[0].semanas = total;
      planes[0].sesiones[0].ejercicios[0].semanas = Array.from({ length: total }, (_, i) => ({ semana: i + 1, prescripcion: i ? "" : "4×8", peso: null, pesoFecha: null }));
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
      await abrirRutinas(page);
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
    await abrirRutinas(page);
    await page.getByRole("button", { name: "Crear bloque", exact: true }).click();
    await page.getByRole("button", { name: "Crear bloque", exact: true }).click();
    await page.getByText("Guardado automáticamente", { exact: true }).waitFor();
    assert.deepEqual(planes[0].sesiones[0].bloques, [1, 2]);
    assert.equal(planes[0].sesiones[0].ejercicios.length, 0);
    await recargar(page);
    await abrirRutinas(page);
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
    await recargar(page);
    await abrirRutinas(page);
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
    await abrirRutinas(page);
    await page.getByLabel("Zumo, semana 1", { exact: true }).fill("4×10");
    await page.getByRole("button", { name: "Crear bloque", exact: true }).click();
    await page.getByRole("region", { name: "Bloque 2", exact: true }).getByRole("button", { name: "Agregar ejercicio", exact: true }).click();
    const nuevo = page.getByLabel("Ejercicio, semana 1", { exact: true });
    await nuevo.waitFor();
    assert.equal(await nuevo.inputValue(), "3×8");
    assert.equal(await page.getByLabel("Descanso de ejercicio", { exact: true }).inputValue(), "60 s");
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
    assert.equal(planes[0].sesiones[0].ejercicios[1].descanso, "60 s");
    assert.ok(planes[0].sesiones[0].ejercicios[1].semanas.slice(1).every(c=>c.prescripcion==="3×8"));
    await recargar(page);
    await abrirRutinas(page);
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
    await abrirRutinas(page);
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
    await recargar(page);
    await abrirRutinas(page);
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
    await page.getByText("Cargando planes…", { exact: true }).waitFor();
    assert.equal(await page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Vista del plan anterior", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Día de descanso", { exact: true }).count(), 0);
    await page.getByRole("heading",{name:"Actividades de la semana",exact:true}).waitFor();
    errorLectura = true;
    await recargar(page);
    await page.getByText("Fallo controlado de lectura", { exact: true }).waitFor();
    assert.equal(await page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Vista del plan anterior", { exact: true }).count(), 0);
    errorLectura = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByRole("heading",{name:"Actividades de la semana",exact:true}).waitFor();
    await ctx.close();
    const estudiante = await pagina("alumno", 390);
    await estudiante.page.goto(`${baseUrl}/mi-plan`);
    await estudiante.page.getByText("Cargando planes…", { exact: true }).waitFor();
    assert.equal(await estudiante.page.getByText("7 días de running · 7 de fuerza", { exact: true }).count(), 0);
    await estudiante.page.getByRole("button",{name:"Vista diaria",exact:true}).click();
    await estudiante.page.getByRole("button", { name: "Semana siguiente", exact: true }).waitFor();
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
        if (!vacio) await abrirRutinas(page);
        await page.getByRole("tabpanel",{name:"Resumen",exact:true}).getByRole("heading", { name: "Plan de entrenamiento", exact: true }).waitFor();
        if (vacio) await page.getByRole("tabpanel",{name:"Resumen",exact:true}).getByText("Creá un plan, elegí su duración y agregá las sesiones.", { exact: true }).waitFor();
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
    await abrirRutinas(page);
    await page.getByRole("button", { name: "Semanas siguientes", exact: true }).click();
    await page.getByRole("button", { name: "Semana 12", exact: true }).click();
    await page.getByText("Semana 12 de 12", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await ctx.close();
    console.log(`OK: planes vacíos y cargados sin controles cortados en 320, 360, 375, 390, 430, 768, 1024 y 1440 px. Capturas: ${destino}`);
  } else {
  const { page, ctx } = await pagina("coach", 1440);
  await page.goto(`${baseUrl}/alumnos/${alumnoId}`);
  await abrirRutinas(page);
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
  await recargar(page);
  await abrirRutinas(page);
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
  await page.getByRole("checkbox", { name: "Fuerza", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Running", exact: true }).check();
  await page.getByRole("checkbox", { name: "Fuerza", exact: true }).check();
  await page.getByRole("checkbox", { name: "Running", exact: true }).uncheck();
  assert.equal(await page.getByLabel("Días de running", { exact: true }).count(), 0);
  await page.getByRole("checkbox", { name: "Running", exact: true }).check();
  await page.screenshot({ path: join(destino, "tipos-checklist.png"), fullPage: true });
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
  await page.getByRole("button", { name: "Crear Día 4", exact: true }).waitFor();
  await page.getByText("Guardado automáticamente",{exact:true}).waitFor();
  await page.getByRole("button", { name: "Día 2", exact: true }).waitFor();
  await page.getByRole("button", { name: "Running", exact: true }).click();
  await page.getByRole("button", { name: "Ver sesiones anteriores de Running", exact: true }).click();
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
      if (tipo === "Running") await page.getByRole("checkbox", { name: "Fuerza", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: tipo, exact: true }).check();
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
  await estudiante.page.goto(`${baseUrl}/mi-plan`);await estudiante.page.getByRole("button",{name:"Vista diaria",exact:true}).click();
  for (let i=0;i<2;i++) await estudiante.page.getByRole("button", { name: "Semana siguiente", exact: true }).click();
  await estudiante.page.getByText("4×10", { exact: true }).waitFor();
  for (let i=0;i<4;i++) await estudiante.page.getByRole("button", { name: "Semana siguiente", exact: true }).click();
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
