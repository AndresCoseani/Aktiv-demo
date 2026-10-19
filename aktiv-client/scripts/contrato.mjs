#!/usr/bin/env node
/**
 * El contrato de datos (esquemas Zod, DTOs y tipos) NACE en el repo aktiv-api
 * (contrato/src). Este frontend usa una copia en src/contrato, que NO se edita a mano.
 *
 *   npm run contrato:sync    copia el contrato desde ../aktiv-api
 *   npm run contrato:check   falla si la copia no coincide con la de aktiv-api
 *
 * Si aktiv-api no está en ../aktiv-api, indicá dónde con AKTIV_API_DIR.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const origen = resolve(process.env.AKTIV_API_DIR ?? "../aktiv-api", "contrato/src");
const destino = resolve("src/contrato");
const verificar = process.argv.includes("--check");

if (!existsSync(origen)) {
  console.error(`✖ No encuentro el contrato en ${origen}. Clonaste aktiv-api al lado de este repo? (o usá AKTIV_API_DIR)`);
  process.exit(1);
}

const archivos = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")) : []);
const nuevos = archivos(origen);
const actuales = archivos(destino);
const diferencias = [];

for (const f of nuevos) {
  const igual = existsSync(join(destino, f)) && readFileSync(join(origen, f), "utf8") === readFileSync(join(destino, f), "utf8");
  if (!igual) diferencias.push(f);
}
for (const f of actuales) if (!nuevos.includes(f)) diferencias.push(f + " (sobra)");

if (verificar) {
  if (diferencias.length) {
    console.error("✖ El contrato de src/contrato no coincide con aktiv-api:\n  - " + diferencias.join("\n  - ") + "\n  Corré: npm run contrato:sync");
    process.exit(1);
  }
  console.log(`✔ El contrato coincide con aktiv-api (${nuevos.length} archivos)`);
} else {
  for (const f of nuevos) copyFileSync(join(origen, f), join(destino, f));
  for (const f of actuales) if (!nuevos.includes(f)) rmSync(join(destino, f));
  console.log(diferencias.length ? `✔ Contrato actualizado: ${diferencias.join(", ")}` : "✔ El contrato ya estaba al día");
}
