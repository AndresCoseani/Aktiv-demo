import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??"msedge",headless:true});
const base=process.env.MENSUAL_URL??"http://localhost:3101";
try{for(const width of [320,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});let rol=null,solicitudes=[{id:"a0000000-0000-4000-8000-000000000049",nombre:"Alumno nuevo",email:"nuevo@example.test",dni:"45111222",telefono:"3511234567"}],fallar=true,aprobadas=0;
 const session=()=>({username:"lucas@example.test",nombre:"Lucas",userId:"a0000000-0000-4000-8000-000000000001",role:"coach"});
 await page.route("**/api/**",async route=>{const path=new URL(route.request().url()).pathname;let body={},status=200;
  if(path==="/api/auth/me"){if(!rol)status=401;else body={session:session()};}
  else if(path==="/api/auth/refresh")status=401;
  else if(path==="/api/auth/registro"&&route.request().method()==="GET")body={habilitado:true};
  else if(path==="/api/auth/registro"){assert.deepEqual(route.request().postDataJSON(),{nombre:"Alumno nuevo",dni:"45111222",email:"nuevo@example.test",telefono:"3511234567"});status=204;}
  else if(path==="/api/auth/confirmar-registro")status=204;
  else if(path==="/api/auth/solicitudes-alta")body=solicitudes;
  else if(path.endsWith("/aprobar")){if(fallar){fallar=false;status=503;body={mensaje:"Fallo controlado",codigo:"temporal"};}else{solicitudes=[];aprobadas++;body={id:"a0000000-0000-4000-8000-000000000050"};}}
  else if(path==="/api/datos")body={session:session(),alumnos:[],carreras:[],inscripciones:[],ejerciciosCustom:[]};
  else throw Error(`Ruta inesperada ${path}`);
  await route.fulfill({status,contentType:"application/json",...(status===204?{}:{body:JSON.stringify(body)})});
 });
 await page.goto(`${base}/login`);await page.getByRole("link",{name:"¿Sos nuevo? Registrate en Aktiv",exact:true}).click();
 await page.getByLabel("Nombre completo",{exact:true}).fill("Alumno nuevo");await page.getByLabel("DNI",{exact:true}).fill("45.111.222");await page.getByLabel("Email",{exact:true}).fill("nuevo@example.test");await page.getByLabel("Teléfono (opcional)",{exact:true}).fill("3511234567");
 assert.equal(await page.getByText("Objetivo",{exact:true}).count(),0);await page.getByRole("button",{name:"Solicitar mi alta",exact:true}).click();await page.getByText(/Revisá tu email/).waitFor();
 await page.goto(`${base}/confirmar-registro#access_token=token-ficticio-de-confirmacion-1234`);await page.getByText(/Tu email está confirmado/).waitFor();assert.equal(new URL(page.url()).hash,"");
 rol="coach";await page.goto(`${base}/alumnos`);const lista=page.getByRole("region",{name:"Solicitudes de alta",exact:true});await lista.getByText("Alumno nuevo",{exact:true}).waitFor();assert.equal(await lista.getByRole("button",{name:/rechazar|eliminar/i}).count(),0);
 await lista.getByRole("button",{name:"Aprobar a Alumno nuevo",exact:true}).click();await page.getByText("Fallo controlado",{exact:true}).waitFor();assert.equal(solicitudes.length,1);
 await lista.getByRole("button",{name:"Aprobar a Alumno nuevo",exact:true}).click();await lista.getByText("No hay altas pendientes con email confirmado.",{exact:true}).waitFor();assert.equal(aprobadas,1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.close();
}console.log("OK: registro personal sin datos de entrenamiento, confirmación, aprobación sin rechazo/vencimiento, error/reintento y responsive.");}finally{await browser.close();}
