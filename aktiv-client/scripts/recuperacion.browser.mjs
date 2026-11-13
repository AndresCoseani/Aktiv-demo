// Interfaz controlada; la verificación real de tokens vive en recuperacion.e2e-spec.ts.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
const base = process.env.MENSUAL_URL ?? "http://localhost:3101";
let paginaActual;
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    paginaActual = page;
    const errores = []; page.on("pageerror", (e) => errores.push(e.message));
    let pedidos = 0, cambios = 0;
    // Simular descarga lenta del JS: nunca escribir en un formulario sin hidratar.
    await page.route("**/_next/static/chunks/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await route.continue();
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/me") return route.fulfill({ status: 401, contentType: "application/json", body: '{"codigo":"sin_sesion","mensaje":"Sin sesión"}' });
      if (path === "/api/auth/refresh") return route.fulfill({ status: 401, contentType: "application/json", body: '{}' });
      if (path === "/api/auth/recuperar-clave") { pedidos++; assert.equal(route.request().postDataJSON().email, "alumno@example.test"); return route.fulfill({ status: 204 }); }
      if (path === "/api/auth/restablecer-clave") { cambios++; assert.equal(route.request().postDataJSON().token, "token-ficticio-recuperacion-123456789"); return route.fulfill({ status: 204 }); }
      throw Error(`Pedido inesperado: ${path}`);
    });
    await page.goto(`${base}/login`);
    const claveIngreso = page.locator("#clave");
    await claveIngreso.fill("Clave-de-prueba");
    await page.getByRole("button", { name: "Mostrar contraseña", exact: true }).click();
    assert.equal(await claveIngreso.getAttribute("type"), "text");
    await page.getByRole("button", { name: "Ocultar contraseña", exact: true }).click();
    assert.equal(await claveIngreso.getAttribute("type"), "password");
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await page.waitForURL(`${base}/recuperar-clave`);
    await page.getByRole("heading", { name: "Recuperar contraseña", exact: true }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByLabel("Email", { exact: true }).fill("alumno@example.test");
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await page.getByRole("status").filter({ hasText: "Si ese email" }).waitFor();
    assert.equal(pedidos, 1);
    await page.goto(`${base}/restablecer-clave`);
    await page.getByRole("link", { name: "Pedir otro enlace" }).waitFor();
    await page.goto(`${base}/login`);
    await page.goto(`${base}/restablecer-clave#type=recovery&access_token=token-ficticio-recuperacion-123456789&refresh_token=privado`);
    await page.getByLabel("Contraseña nueva", { exact: true }).fill("Nueva-Segura-2026!");
    await page.getByRole("button", { name: "Mostrar contraseña", exact: true }).first().click();
    assert.equal(await page.locator("#clave-nueva").getAttribute("type"), "text");
    assert.equal(await page.locator("#clave-repetida").getAttribute("type"), "password");
    assert.equal(new URL(page.url()).hash, "");
    await page.getByLabel("Repetí la contraseña", { exact: true }).fill("Distinta-Segura!");
    await page.getByRole("button", { name: "Cambiar contraseña", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "no coinciden" }).waitFor();
    assert.equal(cambios, 0);
    await page.getByLabel("Repetí la contraseña", { exact: true }).fill("Nueva-Segura-2026!");
    await page.getByRole("button", { name: "Cambiar contraseña", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Tu contraseña se cambió" }).waitFor();
    assert.equal(cambios, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errores, []);
    await page.close();
  }
  console.log("OK: recuperación en escritorio/móvil, enlace inválido, fragmento eliminado, confirmación y contraseña nueva.");
} catch (e) {
  if (paginaActual && !paginaActual.isClosed()) console.error("Estado de recuperación al fallar:", await paginaActual.evaluate(() => ({
    ruta: location.pathname,
    texto: document.body.innerText,
    emailValido: document.querySelector('input[type="email"]')?.checkValidity(),
    email: document.querySelector('input[type="email"]')?.value,
    validacion: document.querySelector('input[type="email"]')?.validationMessage,
  })));
  throw e;
} finally { await browser.close(); }
