// Flujo UI con API simulada; no escribe en Supabase ni envía mensajes reales.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.MENSUAL_URL ?? "http://localhost:3101";
const salida = join(process.env.TEMP, "aktiv-lucas-capturas"); await mkdir(salida, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
const id = (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const alumnoId = id(10), usuario = id(1), coachId = id(2), planId = id(20);
const alumno = { id: alumnoId, userId: null, coachId, nombre: "Ana Pérez", email: "ana@example.test", dni: "", telefono: "", objetivo: "10K", nivel: "Intermedio", activo: true, proximoPago: null, altaEn: "2026-11-01", planes: [], semana: Array.from({length:7},()=>({correr:false,fuerza:false})), ficha: { fechaNacimiento: null, lugarNacimiento: "", enfermedades: "", lesiones: [], certificado: null, contacto: { nombre: "", parentesco: "", telefono: "" } }, marcas: [], notasProfe: "", notasAlumno: "", acceso: { estado: "sin_cuenta", expiraEn: null } };
const alumnos = [alumno];
const horarios = [], canceladas = [], confirmadas = [], cambios = [];
const planes = [{ id: planId, nombre: "Preparación 10K", inicio: "2026-11-02", semanas: 6, activo: true, orden: 0, sesiones: [
  ...["Fuerza", "Running", "Fuerza"].map((tipo, i) => ({ id: id(30+i), dia: 2, tipo, franja: i === 0 ? "Mañana" : i === 1 ? "Tarde" : "Noche", nombre: `Entrenamiento ${i+1}`, orden: i, calentamiento: "Una serie", activacion: [], enfriamiento: "Movilidad suave", bloques: [1], ejercicios: [{ id: id(40+i), nombre: tipo === "Running" ? "Rodaje" : "Zumo", grupo: 1, orden: 0, descanso: "60 s", semanas: Array.from({length:6},(_,s)=>({semana:s+1,prescripcion:s===0?"4x8":"",peso:null,pesoFecha:null})) }] })),
]}];
let errorImportar = true, errorConfirmar = true, errorDatosAcceso = true, fallarDia = null, errorPeso = true, errorCambio = true;
const errores = [], entregas = [], importaciones = [];
async function pagina(rol, ancho=390) {
  const ctx = await browser.newContext({ viewport:{width:ancho,height:1000}, timezoneId:"America/Argentina/Buenos_Aires" });
  const page = await ctx.newPage(); await page.clock.install({time:new Date("2026-11-03T18:00:00Z")});
  page.on("pageerror",(e)=>errores.push(e.message));
  const session={username:rol==="coach"?"lucas@example.test":alumno.email,role:rol,nombre:rol==="coach"?"Lucas":alumno.nombre,userId:rol==="coach"?coachId:usuario,...(rol==="alumno"?{alumnoId}:{})};
  await page.route("**/api/**",async(route)=>{
    const req=route.request(), url=new URL(req.url()), path=url.pathname.slice(4), metodo=req.method();
    let body={}, status=200;
    const dto=()=>req.postDataJSON();
    if(path==="/auth/me") body={session};
    else if(path==="/datos") body={session,alumnos:rol==="coach"?alumnos:[alumno],carreras:[],inscripciones:[],ejerciciosCustom:[]};
    else if(path.endsWith("/planes-mensuales")) body=planes;
    else if(path===`/alumnos/${alumnoId}` && metodo==="PATCH") {
      if(errorDatosAcceso){errorDatosAcceso=false;status=503;body={codigo:"fallo_prueba",mensaje:"Fallo controlado de datos de acceso"};}
      else {Object.assign(alumno,dto()); body={id:alumnoId};}
    }
    else if(path.endsWith("/credenciales")) {
      entregas.push(dto()); alumno.userId=usuario; alumno.acceso={estado:"activo",expiraEn:null}; body={email:alumno.email,clave:alumno.dni};
    }
    else if(path==="/alumnos/importar") {
      if(errorImportar) {errorImportar=false; status=503; body={codigo:"fallo_prueba",mensaje:"Fallo controlado de importación"};}
      else {importaciones.push(dto()); for(const a of dto().alumnos) alumnos.push({...structuredClone(alumno),...a,userId:null,acceso:{estado:"sin_cuenta",expiraEn:null}}); body={cantidad:dto().alumnos.length};}
    }
    else if(path.startsWith("/sesion-ejercicios/") && metodo==="PATCH") {
      if(errorPeso){errorPeso=false;status=503;body={mensaje:"Fallo controlado de peso"};}
      else {
        const partes=path.split('/'), ejercicio=planes.flatMap(p=>p.sesiones.flatMap(s=>s.ejercicios)).find(e=>e.id===partes[2]);
        Object.assign(ejercicio.semanas.find(c=>c.semana===Number(partes[4])),dto());body={id:ejercicio.id};
      }
    }
    else if(path==="/agenda" && metodo==="GET") {
      const clases=[];
      for(let f=url.searchParams.get("desde"); f<=url.searchParams.get("hasta");) {
        const fecha=new Date(`${f}T12:00:00Z`), dia=(fecha.getUTCDay()+6)%7+1;
        for(const h of horarios.filter((h)=>h.activo&&h.dia===dia&&(!h.desde||h.desde<=f))) {
          const puntual=cambios.find(c=>c.horarioId===h.id&&c.alcance==='solo_fecha'&&c.fecha===f);
          const habitual=cambios.filter(c=>c.horarioId===h.id&&c.alcance==='habitual'&&c.fecha<=f).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
          const v=puntual??habitual??h;
          clases.push({horarioId:h.id,fecha:f,titulo:v.titulo,hora:v.hora,fin:v.fin,lugar:v.lugar,personalizada:Boolean(puntual),cancelada:canceladas.some((c)=>c.horarioId===h.id&&c.fecha===f),asistire:rol==="alumno"&&confirmadas.some((c)=>c.horarioId===h.id&&c.fecha===f),horaLlegada:rol==="alumno"?confirmadas.find(c=>c.horarioId===h.id&&c.fecha===f)?.horaLlegada??null:null,confirmados:rol==="coach"?confirmadas.filter((c)=>c.horarioId===h.id&&c.fecha===f).map(c=>({alumnoId,nombre:alumno.nombre,horaLlegada:c.horaLlegada??null})):[]});
        }
        fecha.setUTCDate(fecha.getUTCDate()+1); f=fecha.toISOString().slice(0,10);
      }
      body={horarios,clases};
    }
    else if(path==="/agenda/horarios" && metodo==="POST") {
      if(dto().dia===fallarDia){fallarDia=null;status=503;body={mensaje:"Fallo controlado de horario"};}
      else {horarios.push({...dto(),activo:true});body={id:dto().id};}
    }
    else if(path.endsWith('/cambios') && metodo==='POST') {
      if(errorCambio){errorCambio=false;status=503;body={mensaje:'Fallo controlado de edición'};}
      else {
        const horarioId=path.split('/')[3]; const c={...dto(),horarioId};
        const anterior=cambios.findIndex(x=>x.horarioId===horarioId&&x.fecha===c.fecha&&x.alcance===c.alcance);
        if(anterior>=0)cambios.splice(anterior,1);cambios.push(c);
        for(let i=confirmadas.length-1;i>=0;i--)if(confirmadas[i].horarioId===horarioId && (c.alcance==='solo_fecha'?confirmadas[i].fecha===c.fecha:confirmadas[i].fecha>=c.fecha))confirmadas.splice(i,1);
        body={id:horarioId};
      }
    }
    else if(path.startsWith("/agenda/horarios/") && metodo==="PATCH") {Object.assign(horarios.find((h)=>path.endsWith(h.id)),dto());body={id:path.split("/").at(-1)};}
    else if(path==="/agenda/confirmaciones") {
      if(metodo==="POST"&&errorConfirmar){errorConfirmar=false;status=503;body={codigo:"fallo_prueba",mensaje:"No se pudo confirmar. Reintentá."};}
      else {if(metodo==="POST") {const anterior=confirmadas.find(c=>c.horarioId===dto().horarioId&&c.fecha===dto().fecha);if(anterior)Object.assign(anterior,dto());else confirmadas.push(dto());}else confirmadas.splice(confirmadas.findIndex((c)=>c.horarioId===dto().horarioId&&c.fecha===dto().fecha),1);status=204;}
    }
    else if(path==="/agenda/cancelaciones") {if(metodo==="POST")canceladas.push(dto());else canceladas.splice(canceladas.findIndex((c)=>c.horarioId===dto().horarioId&&c.fecha===dto().fecha),1);status=204;}
    else throw new Error(`Ruta no simulada: ${metodo} ${path}`);
    await route.fulfill({status,contentType:"application/json",body:status===204?"":JSON.stringify(body)});
  });
  return {page,ctx};
}
try {
  const coach=await pagina("coach",1440);
  await coach.page.goto(`${base}/alumnos/${alumnoId}`);
  await coach.page.getByRole("button",{name:"Preparar acceso con DNI",exact:true}).click();
  await coach.page.getByLabel("DNI del alumno",{exact:true}).fill("12.345.678");
  await coach.page.getByRole("button",{name:"Crear acceso",exact:true}).click();
  await coach.page.getByRole("alert").filter({hasText:"Fallo controlado de datos de acceso"}).waitFor();
  assert.equal(entregas.length,0);
  await coach.page.getByRole("button",{name:"Crear acceso",exact:true}).click();
  await coach.page.getByText("12345678",{exact:true}).waitFor();
  assert.equal(alumno.dni,"12345678"); assert.deepEqual(entregas,[{restablecer:false}]);
  await coach.page.getByRole("button",{name:"Listo",exact:true}).click();
  await coach.page.getByRole("button",{name:"Restablecer acceso",exact:true}).click();
  await coach.page.getByRole("button",{name:"Restablecer contraseña",exact:true}).click();
  await coach.page.getByRole("alert").filter({hasText:"Confirmá"}).waitFor(); assert.equal(entregas.length,1);
  await coach.page.getByRole("button",{name:"Cancelar",exact:true}).click();
  await coach.page.goto(`${base}/alumnos`);
  await coach.page.getByRole("button",{name:"Importar CSV",exact:true}).click();
  await coach.page.getByLabel("Archivo CSV").setInputFiles({name:"alumnos.csv",mimeType:"text/csv",buffer:Buffer.from("Nombre;Apellido;Email;DNI\nAna;Pérez;ana@example.test;12345678\nSol;García;sol@example.test;23456780\nSol;Duplicada;SOL@example.test;23456781")});
  await coach.page.getByText("1 alumno seleccionado · 2 filas para revisar",{exact:true}).waitFor();
  await coach.page.getByRole("button",{name:"Importar 1 alumno",exact:true}).click();
  await coach.page.getByRole("alert").filter({hasText:"Fallo controlado de importación"}).waitFor();
  await coach.page.getByRole("button",{name:"Importar 1 alumno",exact:true}).click();
  await coach.page.getByRole("dialog").waitFor({state:"hidden"});
  assert.equal(importaciones.length,1);assert.equal(importaciones[0].alumnos[0].dni,"23456780");assert.equal(entregas.length,1);
  await coach.page.goto(`${base}/agenda`);
  await coach.page.getByRole("button",{name:"Nuevo horario",exact:true}).click();
  await coach.page.getByLabel("Horario común actividad",{exact:true}).fill("Fuerza grupal");
  await coach.page.getByRole("checkbox",{name:"Martes",exact:true}).check();
  await elegirHora(coach.page, "Horario común inicio", "18", "00");
  await coach.page.getByRole("textbox",{name:"Horario común inicio",exact:true}).fill("1830");
  await coach.page.getByRole("textbox",{name:"Horario común inicio",exact:true}).press("Tab");
  assert.equal(await coach.page.getByRole("textbox",{name:"Horario común inicio",exact:true}).inputValue(),"18:30");
  await coach.page.getByRole("textbox",{name:"Horario común inicio",exact:true}).fill("18:00");
  await elegirHora(coach.page, "Horario común fin", "19", "00");
  await coach.page.getByLabel("Horario común lugar",{exact:true}).fill("Parque");
  await coach.page.getByRole("button",{name:"Guardar horario",exact:true}).click();
  await coach.page.getByText("18:00–19:00 · Fuerza grupal",{exact:true}).waitFor();
  const estudiante=await pagina("alumno");
  await estudiante.page.goto(`${base}/mi-plan`);
  await estudiante.page.getByRole("heading",{name:"Hoy te toca",exact:true}).waitFor();
  const semanas=estudiante.page.getByRole("group",{name:"Semana del plan",exact:true});
  const diasSemana=estudiante.page.getByRole("group",{name:"Días de la semana",exact:true});
  assert.ok((await semanas.boundingBox()).y < (await diasSemana.boundingBox()).y);
  await semanas.getByRole("button",{name:"Semana 2",exact:true}).click();
  assert.equal(await semanas.getByRole("button",{name:"Semana 2",exact:true}).getAttribute("aria-pressed"),"true");
  assert.ok((await semanas.getByRole("button",{name:"Semana 2",exact:true}).getAttribute("class")).includes("bg-primary"));
  assert.equal(await semanas.getByRole("button",{name:"Semana 2",exact:true}).locator("svg").count(),1);
  assert.equal(await estudiante.page.getByRole("button",{name:"Guardar peso",exact:true}).count(),0);
  assert.equal(await estudiante.page.getByText("Ejercicios juntos",{exact:true}).count(),0);
  const peso=estudiante.page.getByLabel("Peso de Zumo, semana 2",{exact:true}).first();
  await peso.fill("50");
  await estudiante.page.getByRole("alert").filter({hasText:"Fallo controlado de peso"}).waitFor();
  assert.equal(await peso.inputValue(),"50");
  await estudiante.page.getByRole("button",{name:"Reintentar",exact:true}).click();
  await estudiante.page.getByText("Guardado",{exact:true}).first().waitFor();
  await peso.fill("55");
  await estudiante.page.waitForResponse(r=>r.request().method()==="PATCH" && r.url().includes('/semanas/2') && r.status()===200);
  assert.equal(planes[0].sesiones[0].ejercicios[0].semanas[1].peso,"55");
  assert.equal(planes[0].sesiones[0].ejercicios[0].semanas[0].peso,null);
  await estudiante.page.reload();
  await estudiante.page.getByRole("group",{name:"Semana del plan",exact:true}).getByRole("button",{name:"Semana 2",exact:true}).click();
  assert.equal(await estudiante.page.getByLabel("Peso de Zumo, semana 2",{exact:true}).first().inputValue(),"55");
  for(let i=1;i<=3;i++)await estudiante.page.getByRole("heading",{name:`Entrenamiento ${i}`,exact:true}).waitFor();
  assert.equal(await estudiante.page.getByRole("region",{name:"Bloque 1",exact:true}).count(),3);
  await estudiante.page.screenshot({path:join(salida,"hoy-doble-entrenamiento.png"),fullPage:true});
  await estudiante.page.goto(`${base}/agenda`);
  await estudiante.page.getByRole("button",{name:"Avisar que voy",exact:true}).click();
  await estudiante.page.getByLabel("Hora estimada de llegada",{exact:true}).fill("18:30");
  await estudiante.page.getByRole("button",{name:"Confirmar llegada",exact:true}).click();
  await estudiante.page.getByText("No se pudo confirmar. Reintentá.",{exact:true}).waitFor(); assert.equal(confirmadas.length,0);
  await estudiante.page.getByRole("button",{name:"Confirmar llegada",exact:true}).click();
  await estudiante.page.getByText("Vas a las 18:30",{exact:true}).waitFor();
  await estudiante.page.reload(); await estudiante.page.getByText("Vas a las 18:30",{exact:true}).waitFor();
  await estudiante.page.getByRole('button',{name:'Cambiar hora',exact:true}).click();
  await estudiante.page.getByLabel('Hora estimada de llegada',{exact:true}).fill('23:00');
  await estudiante.page.getByRole('button',{name:'Confirmar llegada',exact:true}).click();
  await estudiante.page.getByRole('alert').filter({hasText:'Eleg'}).waitFor();
  assert.equal(confirmadas[0].horaLlegada,'18:30');
  await estudiante.page.getByLabel('Hora estimada de llegada',{exact:true}).fill('18:45');
  await estudiante.page.getByRole('button',{name:'Confirmar llegada',exact:true}).click();
  await estudiante.page.getByText('Vas a las 18:45',{exact:true}).waitFor();
  assert.equal(confirmadas.length,1);
  assert.equal(await estudiante.page.getByText("Ana Pérez",{exact:true}).count(),0);
  assert.equal(await estudiante.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await estudiante.page.screenshot({path:join(salida,"clase-alumno.png"),fullPage:true});
  await coach.page.reload(); await coach.page.getByText("1 confirmaciones",{exact:true}).waitFor();
  await coach.page.getByText("Ana Pérez",{exact:true}).waitFor();
  await coach.page.getByRole("button",{name:"Cancelar entrenamiento",exact:true}).click();
  await coach.page.getByRole("button",{name:"Confirmar",exact:true}).click();
  await coach.page.getByText("Clase cancelada",{exact:true}).waitFor();
  await estudiante.page.reload(); await estudiante.page.getByText("Clase cancelada",{exact:true}).waitFor();
  await estudiante.page.getByRole("button",{name:"Cancelar mi confirmación",exact:true}).click();
  await estudiante.page.getByRole("button",{name:"Avisar que voy",exact:true}).waitFor();assert.equal(confirmadas.length,0);
  await coach.page.getByRole("button",{name:"Reabrir entrenamiento",exact:true}).click();
  await coach.page.getByRole("button",{name:"Confirmar",exact:true}).click();
  await coach.page.getByText("Clase cancelada",{exact:true}).waitFor({state:"hidden"});
  await coach.page.getByRole("heading",{name:"Horarios semanales",exact:true}).waitFor();
  await coach.page.getByRole("button",{name:"Desactivar",exact:true}).click();
  await coach.page.getByRole("button",{name:"Confirmar",exact:true}).click();
  await coach.page.getByText("No hay clases esta semana.",{exact:true}).waitFor();
  await estudiante.page.reload();await estudiante.page.getByText("No hay clases esta semana.",{exact:true}).waitFor();
  // Semana calendario, carga común con excepción, error parcial y reintento sin duplicar.
  await coach.page.getByRole("button",{name:"Nuevo horario",exact:true}).click();
  const modal = coach.page.getByRole("dialog",{name:"Nuevo horario semanal",exact:true});
  await modal.getByLabel("Horario común actividad",{exact:true}).fill("Running");
  await elegirHora(coach.page, "Horario común inicio", "18", "00");
  await elegirHora(coach.page, "Horario común fin", "19", "00");
  await modal.getByLabel("Horario común lugar",{exact:true}).fill("Pista");
  for(const dia of ["Lunes","Miércoles","Viernes"])await modal.getByRole("checkbox",{name:dia,exact:true}).check();
  assert.equal(await modal.getByRole("button",{name:"Personalizar",exact:true}).count(),0);
  for(const width of [320,390,768,1440]) {
    await coach.page.setViewportSize({width,height:900});
    await coach.page.waitForFunction(({width}) => window.innerWidth === width && (width < 1440 || document.querySelector('[role="dialog"]').getBoundingClientRect().width >= 850), {width});
    const limites=await modal.boundingBox();
    assert.ok(limites.x>=0 && limites.x+limites.width<=width+1);
    assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true,JSON.stringify(await modal.evaluate(el=>({ancho:el.clientWidth,scroll:el.scrollWidth,fuera:[...el.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>el.getBoundingClientRect().right).map(n=>({tag:n.tagName,clase:n.className,texto:n.textContent?.slice(0,40)}))}))));
    if(width===1440) assert.ok(limites.width>=850,JSON.stringify(await modal.evaluate(el=>({ancho:getComputedStyle(el).width,maximo:getComputedStyle(el).maxWidth,transform:getComputedStyle(el).transform,clases:el.className}))));
    await coach.page.screenshot({path:join(salida,`horario-fijo-${width}.png`),fullPage:false});
    if(width===320 || width===1440) {
      await modal.getByRole("button",{name:"Elegir horario común inicio",exact:true}).click();
      const panel=coach.page.getByLabel("Seleccionar horario común inicio",{exact:true});
      await panel.waitFor();
      const posicion=await panel.boundingBox();
      assert.ok(posicion.x>=0 && posicion.x+posicion.width<=width+1);
      await coach.page.screenshot({path:join(salida,`selector-hora-${width}.png`),fullPage:false});
      await coach.page.keyboard.press("Escape");
    }
  }
  await modal.getByRole("button",{name:"Elegir horario común inicio",exact:true}).click();
  await coach.page.getByRole("button",{name:"Hora 20",exact:true}).click();
  await coach.page.keyboard.press("Escape");
  assert.equal(await modal.getByRole("textbox",{name:"Horario común inicio",exact:true}).inputValue(),"18:00");
  fallarDia=3;
  await modal.getByRole("button",{name:"Guardar horario",exact:true}).click();
  await modal.getByRole("alert").waitFor();
  assert.equal(horarios.filter(h=>h.titulo==="Running").length,1);
  await modal.getByRole("button",{name:"Completar pendientes",exact:true}).click();
  await modal.waitFor({state:"hidden"});
  assert.equal(horarios.filter(h=>h.titulo==="Running").length,3);
  for(const dia of [1,3])assert.deepEqual(horarios.filter(h=>h.dia===dia).map(h=>[h.hora,h.lugar]),[["18:00","Pista"]]);
  assert.deepEqual(horarios.filter(h=>h.dia===5).map(h=>[h.hora,h.lugar]),[["18:00","Pista"]]);
  await coach.page.getByRole("button",{name:"Nuevo horario",exact:true}).click();
  await modal.getByRole("checkbox",{name:"Domingo",exact:true}).check();
  await modal.getByLabel("Horario común actividad",{exact:true}).fill("Running");
  await modal.getByLabel("Horario común lugar",{exact:true}).fill("Parque");
  await elegirHora(coach.page,"Horario común inicio","09","00");
  await elegirHora(coach.page,"Horario común fin","10","30");
  await modal.getByRole("button",{name:"Guardar horario",exact:true}).click();
  await modal.waitFor({state:"hidden"});
  assert.deepEqual(horarios.filter(h=>h.dia===7).map(h=>[h.hora,h.fin,h.lugar]),[["09:00","10:30","Parque"]]);
  await coach.page.reload();
  await coach.page.getByRole("heading",{name:/Lunes/}).waitFor();
  assert.equal(await coach.page.getByLabel("Clases de la semana").locator('section').count(),7);
  const tarjetas=await coach.page.getByLabel("Clases de la semana").locator('section').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {y:r.y,ancho:r.width,alto:r.height};}));
  assert.ok(tarjetas.every(t=>Math.abs(t.ancho-tarjetas[0].ancho)<1 && t.alto===tarjetas[0].alto));
  assert.equal(await coach.page.locator('details').count(),0);
  assert.equal(await coach.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await coach.page.getByRole("button",{name:"Semana siguiente",exact:true}).click();
  await coach.page.getByRole("heading",{name:/Lunes/}).waitFor();
  await coach.page.getByRole("button",{name:"Hoy",exact:true}).click();
  await coach.page.screenshot({path:join(salida,"clases-semana-mobile.png"),fullPage:true});
  // Segundo bloque del mismo día, edición puntual y habitual sin reescribir el pasado.
  await coach.page.setViewportSize({width:1440,height:1000});
  await coach.page.waitForFunction(()=>document.querySelector('[aria-label="Clases de la semana"] section').getBoundingClientRect().width>200);
  const medidas=await coach.page.getByLabel('Clases de la semana').locator('section').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width};}));
  assert.ok(medidas.slice(0,4).every(r=>Math.abs(r.y-medidas[0].y)<1));
  assert.ok(medidas.slice(4).every(r=>Math.abs(r.y-medidas[4].y)<1 && r.y>medidas[0].y));
  assert.ok(Math.abs((medidas[0].x+medidas[3].x+medidas[3].w)/2-(medidas[4].x+medidas[6].x+medidas[6].w)/2)<1);
  await coach.page.getByLabel('Clases de la semana').locator('section').nth(2).getByRole('button',{name:'Agregar bloque',exact:true}).click();
  const alta=coach.page.getByRole('dialog',{name:'Nuevo horario semanal',exact:true});
  assert.equal(await alta.getByRole('checkbox',{name:'Miércoles',exact:true}).isChecked(),true);
  await alta.getByLabel('Horario común actividad',{exact:true}).fill('Fuerza tarde');
  await alta.getByLabel('Horario común lugar',{exact:true}).fill('Palmar');
  await elegirHora(coach.page,'Horario común inicio','15','00');
  await elegirHora(coach.page,'Horario común fin','18','00');
  await alta.getByRole('button',{name:'Guardar horario',exact:true}).click(); await alta.waitFor({state:'hidden'});
  const abrirEdicion=()=>coach.page.getByRole('button',{name:/Editar bloque Fuerza tarde/}).click();
  await abrirEdicion();
  let edicion=coach.page.getByRole('dialog',{name:'Editar bloque horario',exact:true});
  await edicion.getByLabel('Editar horario lugar',{exact:true}).fill('No guardar');
  await edicion.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(cambios.length,0);
  await abrirEdicion();
  await edicion.getByRole('button',{name:'Solo esta fecha',exact:true}).click();
  await edicion.getByLabel('Editar horario lugar',{exact:true}).fill('Pista');
  await edicion.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await edicion.getByRole('alert').waitFor();assert.equal(cambios.length,0);
  await edicion.getByRole('button',{name:'Guardar cambios',exact:true}).click();await edicion.waitFor({state:'hidden'});
  await coach.page.getByText('Solo esta fecha',{exact:true}).waitFor();
  await coach.page.getByRole('button',{name:'Semana siguiente',exact:true}).click();
  const bloque=coach.page.locator('article').filter({hasText:'Fuerza tarde'});
  await bloque.getByText('Palmar',{exact:true}).waitFor();
  await abrirEdicion();
  await edicion.getByLabel('Editar horario lugar',{exact:true}).fill('Centro');
  await edicion.getByRole('button',{name:'Guardar cambios',exact:true}).click();await edicion.waitFor({state:'hidden'});
  await bloque.getByText('Centro',{exact:true}).waitFor();
  await coach.page.getByRole('button',{name:'Semana siguiente',exact:true}).click();
  await bloque.getByText('Centro',{exact:true}).waitFor();
  await coach.page.getByRole('button',{name:'Hoy',exact:true}).click();
  await bloque.getByText('Pista',{exact:true}).waitFor();
  await estudiante.page.clock.setFixedTime(new Date('2026-11-04T15:00:00Z'));
  await estudiante.page.goto(`${base}/mi-plan`);
  const hoyCard=estudiante.page.getByRole('region',{name:'Clases de hoy',exact:true});
  const turno=hoyCard.getByRole('listitem').filter({hasText:'Fuerza tarde'});
  await turno.getByText('Pista',{exact:true}).waitFor();
  await turno.getByRole('button',{name:'Avisar que voy',exact:true}).click();
  await estudiante.page.getByLabel('Hora estimada de llegada',{exact:true}).fill('15:30');
  await estudiante.page.getByRole('button',{name:'Confirmar llegada',exact:true}).click();
  await turno.getByRole('button',{name:'Cancelar mi confirmación',exact:true}).waitFor();
  await coach.page.getByRole('button',{name:'Actualizar',exact:true}).click();
  await coach.page.getByLabel('Alumnos confirmados, 2026-11-04, 15:00',{exact:true}).getByText('Ana Pérez',{exact:true}).waitFor();
  await coach.page.screenshot({path:join(salida,'agenda-bloques-confirmados.png'),fullPage:true});
  await estudiante.page.screenshot({path:join(salida,'hoy-lugar-asistire.png'),fullPage:true});
  // Un lunes ya pasado permite crear el habitual para los próximos lunes.
  const lunes=coach.page.getByLabel('Clases de la semana').locator('section').first();
  assert.equal(await lunes.getByRole('button',{name:'Agregar bloque',exact:true}).isEnabled(),true);
  await lunes.getByRole('button',{name:'Agregar bloque',exact:true}).click();
  await alta.getByLabel('Horario común actividad',{exact:true}).fill('Lunes habitual');
  await alta.getByLabel('Horario común lugar',{exact:true}).fill('Palmar');
  await elegirHora(coach.page,'Horario común inicio','06','00');
  await elegirHora(coach.page,'Horario común fin','12','00');
  await alta.getByRole('button',{name:'Guardar horario',exact:true}).click();await alta.waitFor({state:'hidden'});
  await coach.page.getByText('06:00–12:00 · Lunes habitual',{exact:true}).waitFor();
  assert.equal(horarios.find(h=>h.titulo==='Lunes habitual').desde,'2026-11-09');
  await coach.page.getByRole('button',{name:'Semana siguiente',exact:true}).click();
  await coach.page.getByText('06:00–12:00 · Lunes habitual',{exact:true}).waitFor();
  await coach.page.getByRole('button',{name:'Hoy',exact:true}).click();
  assert.equal(await coach.page.getByText('06:00–12:00 · Lunes habitual',{exact:true}).count(),0);
  assert.deepEqual(errores,[]);
  await coach.ctx.close(); await estudiante.ctx.close();
  console.log("OK: acceso con DNI sin reset implícito, CSV revisable/error/reintento, tres sesiones por día, agenda coach/alumno, confirmar/cancelar/reabrir/archivar y persistencia.");
} catch(e) {
  console.error(e);
  for (const ctx of browser.contexts()) for(const p of ctx.pages()) { await p.screenshot({path:join(salida,"fallo.png"),fullPage:true,timeout:5000}).catch(()=>{}); console.log((await p.locator("body").innerText()).slice(-2500)); }
  throw e;
} finally {await browser.close();}

async function elegirHora(page, etiqueta, hora, minuto) {
  await page.getByRole("button",{name:`Elegir ${etiqueta.toLowerCase()}`,exact:true}).click();
  const panel=page.getByRole("dialog",{name:`Seleccionar ${etiqueta.toLowerCase()}`,exact:true});
  await panel.getByRole("button",{name:`Hora ${hora}`,exact:true}).click();
  await panel.getByRole("button",{name:`Minutos ${minuto}`,exact:true}).click();
  await panel.getByRole("button",{name:"Listo",exact:true}).click();
  await panel.waitFor({state:"hidden"});
}
