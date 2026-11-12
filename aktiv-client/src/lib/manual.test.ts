import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { guias, normalizarBusqueda, textoGuia } from "./manual";
import archivos from "./manual-capturas.json";
const capturas:Record<string,{src:string;ancho:number;alto:number}>=archivos;
describe("Manual ilustrado",()=>{
 it("conserva todas las tareas y sus enlaces sin identificadores repetidos",()=>{
 expect(new Set(guias.map(g=>g.id)).size).toBe(guias.length);
 for(const id of ["registro-alumnos","crear-alumno","modelos","crear-plan","bloques","ejercicio-desde-plan","duplicar-plan","duplicar-modelo","desactivar-plan","carreras","certificados"]) expect(guias.some(g=>g.id===id)).toBe(true);
 for(const guia of guias){expect(guia.pasos.length).toBeGreaterThanOrEqual(3);expect(guia.destino.startsWith("/")).toBe(true);expect(guia.pasos.some(p=>p.imagen)).toBe(true);}
 });
 it("cada imagen referenciada existe y coincide con sus dimensiones PNG",()=>{
 for(const guia of guias) for(const paso of guia.pasos) if(paso.imagen){
 const captura=capturas[paso.imagen];expect(captura,paso.imagen).toBeDefined();
 const archivo=join(process.cwd(),"public",captura.src);expect(existsSync(archivo),archivo).toBe(true);
 const png=readFileSync(archivo);expect(png.readUInt32BE(16)).toBe(captura.ancho);expect(png.readUInt32BE(20)).toBe(captura.alto);
 }
 });
 it("busca también dentro de los pasos y los campos, ignorando tildes",()=>{
 const guia=guias.find(g=>g.id==="registro-alumnos")!;
 expect(normalizarBusqueda(textoGuia(guia))).toContain("dni");
 expect(normalizarBusqueda("Activación")).toBe("activacion");
 });
});
