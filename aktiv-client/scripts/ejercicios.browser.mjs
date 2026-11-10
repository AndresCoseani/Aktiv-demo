import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
try {
  for (const width of [320, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const session = { username: "lucas@example.test", role: "coach", nombre: "Lucas", userId: "a0000000-0000-4000-8000-000000000001" };
    const ejercicios = [["Zumo", "Fuerza"], ["Tobillo", "Movilidad"], ["Elevación", "Fuerza"], ["Zigzag", "Agilidad"], ["Abdomen", "Fuerza"]].map(([nombre, categoria], i) => ({ id: `a0000000-0000-4000-8000-00000000001${i}`, nombre, categoria }));
    let cambios = 0;
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname; let body;
      if (path === "/api/auth/me") body = { session };
      else if (path === "/api/datos") body = { session, alumnos: [], carreras: [], inscripciones: [], ejerciciosCustom: ejercicios, categoriasEjercicio: ["Agilidad", "Equilibrio"] };
      else if (path.startsWith("/api/catalogo/ejercicios/") && route.request().method() === "PATCH") {
        const ejercicio = ejercicios.find(e => path.endsWith(e.id)); assert.ok(ejercicio);
        assert.deepEqual(route.request().postDataJSON(), { categoria: "Fuerza" });
        Object.assign(ejercicio, route.request().postDataJSON()); cambios++;
        await route.fulfill({ status: 204 }); return;
      } else throw Error(`Ruta inesperada: ${path}`);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(`${process.env.MENSUAL_URL ?? "http://localhost:3101"}/ejercicios`);
    await page.getByRole("button", { name: "Editar Tobillo", exact: true }).waitFor();
    assert.deepEqual(await page.locator("section[aria-label]").filter({ has: page.locator("h2") }).evaluateAll(nodes => nodes.map(n => n.getAttribute("aria-label"))), ["Agilidad", "Fuerza", "Movilidad"]);
    assert.deepEqual(await page.getByRole("region", { name: "Fuerza", exact: true }).locator("button[aria-label^='Editar ']").evaluateAll(nodes => nodes.map(n => n.getAttribute("aria-label"))), ["Editar Abdomen", "Editar Elevación", "Editar Zumo"]);
    await page.getByRole("textbox", { name: "Buscar ejercicio", exact: true }).fill("FUERZA elevacion");
    await page.getByRole("status").filter({ hasText: "1 de 5 ejercicios" }).waitFor();
    await page.getByRole("button", { name: "Editar Elevación", exact: true }).waitFor();
    await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
    await page.getByRole("group", { name: "Filtrar por categoría", exact: true }).getByRole("button", { name: /^Movilidad/ }).click();
    await page.getByRole("button", { name: "Editar Tobillo", exact: true }).click();
    const modal = page.getByRole("dialog");
    await modal.getByRole("combobox", { name: "Categoría", exact: true }).click();
    await page.getByRole("option", { name: "Fuerza", exact: true }).click();
    const guardado = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().includes("/catalogo/ejercicios/"));
    await modal.getByRole("button", { name: "Guardar", exact: true }).click();
    await guardado;
    assert.equal(cambios, 1);
    await page.reload();
    await page.getByRole("region", { name: "Fuerza", exact: true }).getByText("Tobillo", { exact: true }).waitFor();
    assert.equal(await page.getByRole("region", { name: "Movilidad", exact: true }).count(), 0);
    await page.getByRole("textbox", { name: "Buscar ejercicio", exact: true }).fill("zzzinexistente");
    await page.getByText(/No hay ejercicios que coincidan/).waitFor();
    await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "5 de 5 ejercicios" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.close();
  }
  console.log("OK: categorías y ejercicios ordenados, búsqueda combinada sin tildes, filtros, reasignación persistida y móvil/escritorio.");
} finally { await browser.close(); }
