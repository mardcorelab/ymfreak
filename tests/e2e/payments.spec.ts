import { expect, test, type Browser, type Page } from "@playwright/test";

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

async function login(page: Page) {
  await page.goto("/dashboard/login");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tu panel" })).toBeVisible();
}

/** A client books a mix & master as a member of the public and lands on the checkout page. */
async function bookAsClient(browser: Browser, who: string): Promise<{ page: Page; url: string }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/es/book?service=mezcla-mastering");
  await expect(page.getByText(/Empiezo a trabajarla el/)).toBeVisible();
  await page.getByLabel("Tu nombre").fill(`Cliente ${who}`);
  await page.getByLabel("Correo").fill(`${who.toLowerCase()}@example.com`);
  await page.getByLabel("Nombre artístico").fill(`Artista ${who}`);
  await page.getByLabel("Nombre de la canción").fill(`Canción ${who}`);
  await page.getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(page).toHaveURL(/\/es\/checkout\/c[a-z0-9]+$/);
  return { page, url: page.url() };
}

test.describe.configure({ mode: "serial" });

test("the admin opens online booking once payments are configured", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/availability");
  await expect(page.getByText(/PayPal conectado/)).toBeVisible();
  await page.getByLabel("Abrir las reservas en línea al público").check();
  await page.getByRole("button", { name: "Guardar cambios" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Reservas en línea abiertas al público" })).toBeVisible();
});

test("a client pays the deposit, the booking is confirmed, and can cancel within 24 h for a full refund", async ({ browser }) => {
  const { page, url } = await bookAsClient(browser, "Pago");
  await expect(page.getByText("Pendiente del depósito")).toBeVisible();
  await expect(page.getByText("$75", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Pagar depósito con PayPal" }).click();
  await expect(page).toHaveURL(/\?payment=paid$/);
  await expect(page.getByText("Tu proyecto ha sido reservado")).toBeVisible();
  await expect(page.getByText("Confirmada", { exact: true })).toBeVisible();
  await expect(page.getByText(/Envíame tus archivos a/)).toBeVisible();

  // Paying again is not possible: nothing is due until delivery.
  await expect(page.getByRole("button", { name: /Pagar/ })).toHaveCount(0);

  // Self-service cancellation needs explicit confirmation.
  await page.getByRole("button", { name: "Cancelar y recibir el reembolso" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Marca la casilla" })).toBeVisible();
  await page.getByLabel("Sí, quiero cancelar esta reserva").check();
  await page.getByRole("button", { name: "Cancelar y recibir el reembolso" }).click();
  await expect(page.getByText("Reserva cancelada. El reembolso va en camino.")).toBeVisible();

  await page.goto(url);
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  await expect(page.getByText(/Te devolvimos \$75/)).toBeVisible();
});

test("after delivery the client pays the balance and the project completes", async ({ browser, page }) => {
  const client = await bookAsClient(browser, "Saldo");
  await client.page.getByRole("button", { name: "Pagar depósito con PayPal" }).click();
  await expect(client.page.getByText("Tu proyecto ha sido reservado")).toBeVisible();

  // The admin works on it and delivers.
  await login(page);
  await page.goto("/dashboard/bookings");
  await page.getByRole("link", { name: /Cliente Saldo/ }).click();
  for (const label of ["En proceso", "Entregada"]) {
    await page.getByLabel("Nuevo estado").selectOption({ label });
    await page.getByRole("button", { name: "Cambiar estado" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Reserva marcada como «${label}»` })).toBeVisible();
  }

  await client.page.goto(client.url);
  await expect(client.page.getByText("Tu trabajo está listo")).toBeVisible();
  await client.page.getByRole("button", { name: "Pagar el saldo con PayPal" }).click();
  await expect(client.page.getByText("Tu proyecto ha sido reservado")).toBeVisible();
  await expect(client.page.getByText("Completada", { exact: true })).toBeVisible();

  await page.goto("/dashboard/orders");
  await expect(page.getByText(/Saldo \$75, test, pagado/)).toBeVisible();
});

test("the webhook endpoint refuses unverified calls", async ({ request }) => {
  const res = await request.post("/api/webhooks/paypal", { data: { id: "WH-FAKE", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} } });
  expect([400, 503]).toContain(res.status());
});
