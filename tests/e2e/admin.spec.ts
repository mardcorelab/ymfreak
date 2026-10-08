import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

async function login(page: Page) {
  await page.goto("/dashboard/login");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tu panel" })).toBeVisible();
}

/** Public pages are cached; after a save they refresh on the next visits. */
async function eventually(page: Page, url: string, check: () => Promise<void>) {
  await expect(async () => {
    await page.goto(url);
    await check();
  }).toPass({ timeout: 30_000, intervals: [500, 1000, 2000] });
}

test.describe.configure({ mode: "serial" });

test("the dashboard is closed without a session", async ({ page, request }) => {
  await page.goto("/dashboard/services");
  await expect(page).toHaveURL(/\/dashboard\/login$/);

  // Server actions and pages re-check the session even if the middleware is bypassed.
  const res = await request.get("/dashboard", { maxRedirects: 0 });
  expect([302, 307, 308]).toContain(res.status());
});

test("wrong credentials are refused with a clear message", async ({ page }) => {
  await page.goto("/dashboard/login");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Entrar" }).click();
  // (Next.js also renders an empty route-announcer alert, so match by text.)
  await expect(page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/login$/);
});

test("a price changed in the dashboard shows on the public site", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Servicios y precios" }).first().click();
  await page.getByRole("link", { name: /^Mastering/ }).click();

  const price = page.getByLabel("Precio (USD)");
  await expect(price).toHaveValue("70");
  await price.fill("75");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/ })).toContainText("Cambios guardados");

  await eventually(page, "/es/services", () =>
    expect(page.getByRole("listitem").filter({ hasText: "Master final de una canción" })).toContainText("$75", { timeout: 2000 }),
  );

  // Invalid input is explained, not saved.
  await page.goto("/dashboard/services");
  await page.getByRole("link", { name: /^Mastering/ }).click();
  await page.getByLabel("Precio (USD)").fill("setenta");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Precio: escribe un monto válido" })).toBeVisible();

  // Restore.
  await page.getByLabel("Precio (USD)").fill("70");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/ })).toContainText("Cambios guardados");
  await eventually(page, "/es/services", () =>
    expect(page.getByRole("listitem").filter({ hasText: "Master final de una canción" })).toContainText("$70", { timeout: 2000 }),
  );
});

test("an FAQ entry can be added, shown in both languages and removed", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/knowledge/new");
  await page.getByLabel("Pregunta (español)").fill("¿Pregunta de prueba E2E?");
  await page.getByLabel("Pregunta (inglés)").fill("E2E test question?");
  await page.getByLabel("Respuesta (español)").fill("Respuesta de prueba.");
  await page.getByLabel("Respuesta (inglés)").fill("Test answer.");
  await page.getByRole("button", { name: "Añadir pregunta" }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/ })).toContainText("Pregunta añadida");

  await eventually(page, "/es/faq", () => expect(page.getByText("¿Pregunta de prueba E2E?")).toBeVisible({ timeout: 2000 }));
  await eventually(page, "/en/faq", () => expect(page.getByText("E2E test question?")).toBeVisible({ timeout: 2000 }));

  await page.goto("/dashboard/knowledge");
  await page.getByRole("link", { name: /Pregunta de prueba E2E/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/ })).toContainText("Pregunta eliminada");
  await eventually(page, "/es/faq", () => expect(page.getByText("¿Pregunta de prueba E2E?")).toHaveCount(0, { timeout: 2000 }));
});

test("a pasted YouTube link becomes a release that plays inside the site", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/portfolio/new");
  await page.getByLabel("Enlace de Spotify o YouTube").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByLabel("Título").fill("Tema de prueba E2E");
  await page.getByLabel("Artista").fill("Artista E2E");
  await page.getByRole("button", { name: "Añadir trabajo" }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/ })).toContainText("Trabajo añadido");

  await eventually(page, "/es/portfolio", () =>
    expect(page.getByRole("heading", { name: "Tema de prueba E2E" })).toBeVisible({ timeout: 2000 }),
  );
  await page.getByRole("button", { name: /Escuchar «Tema de prueba E2E»/ }).click();
  await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toHaveCount(1);

  await page.goto("/dashboard/portfolio");
  await page.getByRole("link", { name: /Tema de prueba E2E/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("status").filter({ hasText: /\S/ })).toContainText("Trabajo eliminado");
});

test("signing out closes the dashboard", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/dashboard\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard\/login$/);
});
