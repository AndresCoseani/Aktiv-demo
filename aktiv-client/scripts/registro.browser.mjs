import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??"msedge",headless:true});
const base=process.env.MENSUAL_URL??"http://localhost:3101";
try{for(const width of [320,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});let rol=null,solicitudes=[{id:"a0000000-0000-4000-8000-000000000049",nombre:"Alumno nuevo",email:"nuevo@example.test",dni:"45111222",telefono:"3511234567"}],fallar=true,aprobadas=0,fallarId=null;
 const session=()=>({username:"lucas@example.test",nombre:"Lucas",userId:"a0000000-0000-4000-8000-000000000001",role:"coach"});
 await page.route("**/api/**",async route=>{const path=new URL(route.request().url()).pathname;let body={},status=200;
  if(path==="/api/auth/me"){if(!rol)status=401;else body={session:session()};}
  else if(path==="/api/auth/refresh")status=401;
  else if(path==="/api/auth/registro"&&route.request().method()==="GET")body={habilitado:true};
  else if(path==="/api/auth/registro"){assert.deepEqual(route.request().postDataJSON(),{nombre:"Alumno nuevo",dni:"45111222",email:"nuevo@example.test",telefono:""});status=204;}
  else if(path==="/api/auth/confirmar-registro")status=204;
  else if(path==="/api/auth/solicitudes-alta")body=solicitudes;
  else if(path.endsWith("/aprobar")){if(fallar||path.includes(fallarId??"imposible")){fallar=false;fallarId=null;status=503;body={mensaje:"Fallo controlado",codigo:"temporal"};}else{solicitudes=solicitudes.filter((s)=>!path.includes(s.id));aprobadas++;body={id:"a0000000-0000-4000-8000-000000000050"};}}
  else if(path==="/api/datos")body={session:session(),alumnos:[],carreras:[],inscripciones:[],ejerciciosCustom:[]};
  else throw Error(`Ruta inesperada ${path}`);
  await route.fulfill({status,contentType:"application/json",...(status===204?{}:{body:JSON.stringify(body)})});
 });
 await page.goto(`${base}/login`);await page.getByRole("link",{name:"¿Sos nuevo? Registrate en Aktiv",exact:true}).click();
 await page.getByLabel("Nombre completo",{exact:true}).fill("Alumno nuevo");await page.getByLabel("DNI",{exact:true}).fill("45.111.222");await page.getByLabel("Email",{exact:true}).fill("nuevo@example.test");
 assert.equal(await page.getByText("Objetivo",{exact:true}).count(),0);await page.getByRole("button",{name:"Solicitar mi alta",exact:true}).click();await page.getByText(/Tu solicitud ya está enviada/).waitFor();assert.equal(await page.getByLabel("Teléfono (opcional)",{exact:true}).count(),0);
 rol="coach";await page.goto(`${base}/dashboard`);const lista=page.getByRole("region",{name:"Solicitudes de alta",exact:true});await lista.getByText("Alumno nuevo",{exact:true}).waitFor();assert.equal(await lista.getByRole("button",{name:/rechazar|eliminar/i}).count(),0);
 await lista.getByRole("button",{name:"Aprobar a Alumno nuevo",exact:true}).click();await page.getByText("Fallo controlado",{exact:true}).waitFor();assert.equal(solicitudes.length,1);
 await lista.getByRole("button",{name:"Aprobar a Alumno nuevo",exact:true}).click();await lista.getByText("No hay altas pendientes.",{exact:true}).waitFor();assert.equal(aprobadas,1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 solicitudes=[1,2,3].map((n)=>({id:`a0000000-0000-4000-8000-00000000005${n}`,nombre:`Alumno ${n}`,email:`alumno${n}@example.test`,dni:`4511122${n}`,telefono:""}));fallarId=solicitudes[1].id;
 await lista.getByRole("button",{name:"Actualizar",exact:true}).click();await lista.getByText("Alumno 3",{exact:true}).waitFor();
 await lista.getByRole("button",{name:"Aprobar todos",exact:true}).click();await lista.getByRole("alert").filter({hasText:"2 altas aprobadas"}).waitFor();assert.equal(aprobadas,3);assert.equal(solicitudes.length,1);await lista.getByText("Alumno 2",{exact:true}).waitFor();
 await lista.getByRole("button",{name:"Aprobar todos",exact:true}).click();await lista.getByRole("status").filter({hasText:"1 alta aprobada"}).waitFor();assert.equal(aprobadas,4);assert.equal(solicitudes.length,0);assert.equal(await lista.getByRole("button",{name:"Aprobar todos",exact:true}).isDisabled(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const saludo=await page.getByRole("heading",{name:"Hola, Lucas!",exact:true}).boundingBox();const altas=await lista.boundingBox();const metricas=await page.getByRole("region",{name:"Métricas",exact:true}).boundingBox();assert.ok(saludo.y+saludo.height<=altas.y);assert.ok(altas.y+altas.height<=metricas.y);
 await page.goto(`${base}/alumnos`);await page.getByRole("heading",{name:"Alumnos",exact:true}).waitFor();assert.equal(await page.getByRole("region",{name:"Solicitudes de alta",exact:true}).count(),0);
 await page.close();
}console.log("OK: registro personal sin datos de entrenamiento ni confirmación de correo, aprobación sin rechazo/vencimiento, error/reintento y responsive.");}finally{await browser.close();}
