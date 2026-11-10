import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
const base = process.env.MENSUAL_URL ?? "http://localhost:3101";
try {
  for (const role of ["coach", "alumno"]) for (const width of [320, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const session = { username: "prueba@example.test", role, nombre: "Lucas", userId: "prueba" };
    await page.route("**/api/**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(new URL(route.request().url()).pathname === "/api/auth/me" ? { session } : { session, alumnos: [], carreras: [], inscripciones: [], ejerciciosCustom: [] }) }));
    await page.goto(`${base}/manual`);
    if (role === "alumno") {
      await page.waitForURL("**/mi-plan");
      assert.equal(await page.getByRole("heading", { name: "Manual de uso", exact: true }).count(), 0);
      await page.getByRole("button", { name: "Mi perfil", exact: true }).click();
      assert.equal(await page.getByRole("menuitem", { name: "Manual de uso" }).count(), 0);
    } else {
      await page.getByRole("heading", { name: "Manual de uso", exact: true }).waitFor();
      await page.getByRole("textbox", { name: "Buscar en el manual" }).fill("crear alumno");
      await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Crear un alumno", exact: true }) }).click();
      await page.waitForURL("**/manual?guia=crear-alumno");
      await page.locator("ol li").first().waitFor();
      await page.getByRole("heading", { name: "Crear un alumno", exact: true }).waitFor();
      assert.equal(await page.locator("ol li").count(), 5);
      await page.reload();
      await page.getByRole("heading", { name: "Crear un alumno", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole("button", { name: "Mi perfil", exact: true }).click();
      await page.getByRole("menuitem", { name: "Manual de uso" }).click();
      await page.getByRole("textbox", { name: "Buscar en el manual" }).fill("zzzninguna");
      await page.getByText("No encontramos esa tarea.").waitFor();
      await page.getByRole("button", { name: "Ver todas las guías" }).click();
      await page.getByRole("button", { name: "Clases", exact: true }).click();
      await page.getByRole("heading", { name: "Crear horarios y bloques de clase", exact: true }).waitFor();
      assert.equal(await page.locator("h2").count(), 3);
    }
    await page.close();
  }
  console.log("OK: manual, búsqueda, guías, enlace desde perfil, recarga, filtros, sin resultados, responsive y acceso de alumno bloqueado.");
} finally { await browser.close(); }
