import { expect, test, type Page } from "@playwright/test";

// Runs after payments.spec.ts, so online booking is already open.
const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const CLIENT_EMAIL = "portal@example.com";

async function login(page: Page) {
  await page.goto("/dashboard/login");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tu panel" })).toBeVisible();
}

async function openBookingAsAdmin(page: Page) {
  await page.goto("/dashboard/bookings");
  await page.getByRole("link", { name: /Cliente Portal/ }).first().click();
  await expect(page.getByRole("heading", { name: /Reserva YMF-/ })).toBeVisible();
}

async function setStatus(page: Page, label: string) {
  await page.getByLabel("Nuevo estado").selectOption({ label });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByText(`Reserva marcada como «${label}»`)).toBeVisible();
}

async function shareLink(page: Page, kind: string, name: string, url: string, message: string) {
  await page.getByLabel("Tipo").selectOption({ label: kind });
  await page.getByLabel("Nombre (opcional)").fill(name);
  await page.getByLabel("Enlace", { exact: true }).fill(url);
  await page.getByRole("button", { name: "Compartir enlace" }).click();
  await expect(page.getByText(message)).toBeVisible();
}

test.describe.configure({ mode: "serial" });

let code = "";
let projectUrl = "";

test("after paying the deposit, the client opens their portal and shares their files", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/es/book?service=mezcla-mastering");
  await expect(page.getByText(/Empiezo a trabajarla el/)).toBeVisible();
  await page.getByLabel("Tu nombre").fill("Cliente Portal");
  await page.getByLabel("Correo").fill(CLIENT_EMAIL);
  await page.getByLabel("Nombre artístico").fill("Artista Portal");
  await page.getByLabel("Nombre de la canción").fill("Canción Portal");
  await page.getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(page).toHaveURL(/\/es\/checkout\//);
  code = ((await page.getByText(/^YMF-[A-Z0-9]{5}$/).textContent()) ?? "").trim();
  await page.getByRole("button", { name: "Pagar depósito con PayPal" }).click();
  await expect(page.getByText("Tu proyecto ha sido reservado")).toBeVisible();

  // From the private booking page straight into the portal.
  await page.getByRole("button", { name: "Ver todos mis proyectos" }).click();
  await expect(page).toHaveURL(/\/es\/account$/);
  await expect(page.getByRole("heading", { name: "Hola, Cliente" })).toBeVisible();
  const card = page.locator(`[data-booking="${code}"]`);
  await expect(card.getByText("Confirmada")).toBeVisible();
  await card.getByRole("link", { name: "Ver proyecto" }).click();
  await expect(page).toHaveURL(new RegExp(`/es/account/${code}$`));
  projectUrl = page.url();
  await expect(page.getByRole("heading", { name: "Canción Portal · Artista Portal" })).toBeVisible();
  await expect(page.getByText("Qué archivos enviar")).toBeVisible();

  // Only https links are accepted.
  await page.getByLabel("Enlace a tus archivos").fill("http://example.com/stems");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "empezando por https://" })).toBeVisible();

  await page.getByLabel("Enlace a tus archivos").fill("https://wetransfer.com/downloads/portal-stems");
  await page.getByLabel("Nota (opcional)").fill("Voces y pista por separado");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText("¡Recibido!")).toBeVisible();
  await expect(page.locator('[data-link-kind="CLIENT_FILES"]').getByText("Voces y pista por separado")).toBeVisible();
  await ctx.storageState({ path: "test-results/portal-client.json" });
  await ctx.close();
});

test("the admin sees the files, shares a preview and the finals, and delivers", async ({ page }) => {
  await login(page);
  await openBookingAsAdmin(page);
  await expect(page.getByText("https://wetransfer.com/downloads/portal-stems")).toBeVisible();
  await shareLink(page, "Versión para escuchar", "Mezcla v1", "https://drive.google.com/portal-preview", "Versión compartida con el cliente.");
  await setStatus(page, "En proceso");
  await setStatus(page, "Entregada");
  await shareLink(page, "Archivos finales", "Master final", "https://drive.google.com/portal-final", "Archivos finales añadidos.");
});

test("the client hears the preview, asks for a revision, and gets the finals only after paying the balance", async ({ browser, page }) => {
  test.setTimeout(120_000); // two people, several round trips
  const ctx = await browser.newContext({ storageState: "test-results/portal-client.json" });
  const client = await ctx.newPage();
  await client.goto(projectUrl);
  await expect(client.locator('[data-status="DELIVERED"]')).toBeVisible();
  await expect(client.getByText("Mezcla v1")).toBeVisible();
  await expect(client.locator('a[href="https://drive.google.com/portal-preview"]')).toBeVisible();
  await expect(client.getByText("Tus archivos finales están listos")).toBeVisible();
  await expect(client.locator('a[href="https://drive.google.com/portal-final"]')).toHaveCount(0);

  await client.getByLabel("Qué quieres cambiar").fill("Subir un poco la voz en el coro (1:05).");
  await client.getByRole("button", { name: "Pedir revisión" }).click();
  await expect(client.getByText("Revisión pedida.")).toBeVisible();
  await client.reload();
  await expect(client.locator('[data-status="REVISION"]')).toBeVisible();

  // The admin sees the request and delivers the new version.
  await login(page);
  await openBookingAsAdmin(page);
  await expect(page.getByText("Subir un poco la voz en el coro (1:05).")).toBeVisible();
  await setStatus(page, "Entregada");

  // The client pays the balance and the final files unlock.
  await client.reload();
  await client.getByRole("link", { name: "Pagar $75" }).first().click();
  await client.getByRole("button", { name: "Pagar el saldo con PayPal" }).click();
  await expect(client.getByText("Completada", { exact: true })).toBeVisible();
  await client.goto(projectUrl);
  await expect(client.locator('a[href="https://drive.google.com/portal-final"]')).toBeVisible();
  await expect(client.getByText("Tus archivos finales están listos")).toHaveCount(0);
  await ctx.close();
});

test("the portal needs the right email and code, and never shows other people's projects", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`/es/account/${code}`);
  await expect(page).toHaveURL(/\/es\/account$/);
  await expect(page.getByRole("heading", { name: "Entra a tu portal" })).toBeVisible();

  await page.getByLabel("Correo").fill("otra@example.com");
  await page.getByLabel("Código de reserva").fill(code);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "no coinciden" })).toBeVisible();

  await page.getByLabel("Correo").fill(CLIENT_EMAIL);
  await page.getByLabel("Código de reserva").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(`[data-booking="${code}"]`)).toBeVisible();

  // Bookings of other clients (from earlier tests) are not reachable.
  await page.goto("/es/account/YMF-ZZZZZ");
  await expect(page.getByText(/no existe/i).first()).toBeVisible();

  await page.goto("/es/account");
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByRole("heading", { name: "Entra a tu portal" })).toBeVisible();
  await ctx.close();
});

test("after the project is completed, the client's review appears on the site once approved", async ({ browser, page }) => {
  const ctx = await browser.newContext({ storageState: "test-results/portal-client.json" });
  const client = await ctx.newPage();
  await client.goto(projectUrl);
  await expect(client.getByRole("heading", { name: "¿Cómo fue trabajar conmigo?" })).toBeVisible();
  await client.getByLabel("4 estrellas", { exact: true }).check({ force: true });
  await client.getByLabel("Tu reseña").fill("Un trabajo increíble, la mezcla quedó enorme y muy clara.");
  await client.getByLabel("Acepto que YM Freak publique").check();
  await client.getByRole("button", { name: "Enviar reseña" }).click();
  await expect(client.getByText("¡Gracias por tu reseña!")).toBeVisible();
  await ctx.close();

  // Not public until approved.
  await page.goto("/es");
  await expect(page.getByText("Un trabajo increíble, la mezcla quedó enorme")).toHaveCount(0);

  await login(page);
  await page.goto("/dashboard/testimonials");
  await expect(page.getByText("Tienes 1 reseña de cliente pendiente de aprobar.")).toBeVisible();
  await page.getByRole("link", { name: /Artista Portal/ }).click();
  await page.getByLabel("Publicado").check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  await expect
    .poll(async () => {
      await page.goto("/es");
      return page.getByText("Un trabajo increíble, la mezcla quedó enorme").count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expect(page.getByText("Cliente verificado")).toBeVisible();
  await expect(page.getByLabel("4 de 5 estrellas")).toBeVisible();
});
