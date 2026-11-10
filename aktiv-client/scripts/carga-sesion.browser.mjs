// Una caída de datos no debe producir polling, logout ni bucles de navegación.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
const base = process.env.MENSUAL_URL ?? "http://localhost:3101";
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const session = { username: "prueba@example.test", role: "coach", nombre: "Profe", userId: "profe" };
    let datos = 0, logout = 0, navegacionesLogin = 0, fallar = true;
    page.on("request", (r) => { if (r.isNavigationRequest() && new URL(r.url()).pathname === "/login") navegacionesLogin++; });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body, status = 200;
      if (path === "/api/auth/me") body = { session };
      else if (path === "/api/datos") {
        datos++;
        await new Promise((r) => setTimeout(r, 200));
        if (fallar) { status = 503; body = { codigo: "db_no_disponible", mensaje: "Base temporalmente no disponible" }; }
        else body = { session, alumnos: [], carreras: [], inscripciones: [], ejerciciosCustom: [] };
      } else if (path === "/api/auth/logout") { logout++; body = {}; }
      else throw Error(`Pedido inesperado: ${path}`);
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(`${base}/login`);
    await page.getByRole("heading", { name: "No pudimos cargar tus datos", exact: true }).waitFor();
    await page.evaluate(() => { for (let i = 0; i < 30; i++) document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(700);
    assert.equal(datos, 1); assert.equal(logout, 0); assert.equal(navegacionesLogin, 1);
    fallar = false;
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await page.getByRole("heading", { name: "Hola, Profe!", exact: true }).waitFor();
    assert.equal(datos, 2); assert.equal(logout, 0);
    await page.evaluate(() => { for (let i = 0; i < 30; i++) document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(700); assert.equal(datos, 2);
    await page.close();
  }
  console.log("OK: caída de datos sin logout, polling ni bucle de login; reintento manual y recuperación en móvil/escritorio.");
} finally { await browser.close(); }
