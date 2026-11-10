import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??"chromium",headless:true});
const base=process.env.MENSUAL_URL??"http://localhost:3101";
try{
 for(const role of ["coach","alumno"]) for(const width of [320,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});
 const session={username:"prueba@example.test",role,nombre:"Lucas",userId:"prueba"};
 await page.route("**/api/**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(new URL(route.request().url()).pathname==="/api/auth/me"?{session}:{session,alumnos:[],carreras:[],inscripciones:[],ejerciciosCustom:[]})}));
 await page.goto(base+"/manual");
 if(role==="alumno"){
 await page.waitForURL("**/mi-plan");assert.equal(await page.getByRole("heading",{name:"Manual de uso",exact:true}).count(),0);
 await page.getByRole("button",{name:"Mi perfil",exact:true}).click();assert.equal(await page.getByRole("menuitem",{name:"Manual de uso"}).count(),0);
 }else{
 await page.getByRole("textbox",{name:"Buscar en el manual"}).fill("crear alumno");
 await page.getByRole("link").filter({has:page.getByRole("heading",{name:"Crear un alumno manualmente",exact:true})}).click();
 await page.getByRole("heading",{name:"Crear un alumno manualmente",exact:true}).waitFor();
 await page.locator('ol[aria-label="Instrucciones detalladas"] > li').first().waitFor(); assert.equal(await page.locator('ol[aria-label="Instrucciones detalladas"] > li').count(),6);
 const imagen=page.getByRole("button",{name:/^Ampliar imagen:/}).first();await imagen.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const img=document.querySelector("article img");return img?.complete&&img.naturalWidth>0;});
 await imagen.click();await page.getByRole("dialog").waitFor();await page.getByRole("button",{name:"Close",exact:true}).click();await page.getByRole("dialog").waitFor({state:"hidden"});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.reload();await page.getByRole("heading",{name:"Crear un alumno manualmente",exact:true}).waitFor();
 await page.getByRole("link",{name:"Todas las guías",exact:true}).click();
 await page.getByRole("textbox",{name:"Buscar en el manual"}).fill("zzzninguna");await page.getByText("No encontramos esa tarea.").waitFor();
 await page.getByRole("button",{name:"Ver todas las guías",exact:true}).click();await page.getByRole("button",{name:"Clases",exact:true}).click();assert.equal(await page.locator("h2").count(),4);
 if(width===1440){
 const contenido=await readFile("src/lib/manual-detallado.ts","utf8");const ids=[...contenido.matchAll(/g\("([a-z-]+)"/g)].map(m=>m[1]);
 for(const id of ids){await page.goto(base+"/manual?guia="+id);await page.locator("article").waitFor();assert.ok(await page.locator("article img").count()>0,id);}
 await page.goto(base+"/manual?guia=bloques");await page.locator("article").waitFor();await page.screenshot({path:join(tmpdir(),"aktiv-manual-desktop.png"),fullPage:false});
 }else{await page.goto(base+"/manual?guia=bloques");await page.screenshot({path:join(tmpdir(),"aktiv-manual-mobile.png"),fullPage:false});}
 }
 await page.close();
 }
 console.log("OK: todas las guías, imágenes, zoom, búsqueda, filtros, recarga, móvil y acceso exclusivo del profesor.");
}finally{await browser.close();}
