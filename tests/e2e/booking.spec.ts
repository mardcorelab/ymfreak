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

/** A weekday at least `minDays` ahead, as YYYY-MM-DD (UTC-based is fine for a far-enough date). */
function weekdayAhead(minDays: number): string {
  const d = new Date(Date.now() + minDays * 864e5);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function fillProject(page: Page, who: string) {
  await page.getByLabel("Tu nombre").fill(`Cliente ${who}`);
  await page.getByLabel("Correo").fill(`${who.toLowerCase()}@example.com`);
  await page.getByLabel("Nombre artístico").fill(`Artista ${who}`);
}

test.describe.configure({ mode: "serial" });

test("booking is closed to the public while switched off", async ({ page }) => {
  await page.goto("/es/book");
  await expect(page.getByText("Las reservas en línea abrirán muy pronto")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reservar" })).toHaveCount(0);
});

test("a mix & master booking gets a real delivery date and holds capacity", async ({ page }) => {
  await login(page);
  await page.goto("/es/book?service=mezcla-mastering");
  await expect(page.getByText("Vista previa")).toBeVisible();

  // Delivery date comes from the server calendar.
  await expect(page.getByText("Entrega", { exact: true })).toBeVisible();
  await expect(page.getByText(/Empiezo a trabajarla el/)).toBeVisible();
  // $150 total → $75 deposit now and $75 on delivery.
  await expect(page.getByText("Depósito para reservar (50 %)")).toBeVisible();
  await expect(page.getByText("$75", { exact: true })).toHaveCount(2);

  await fillProject(page, "Delivery");
  await page.getByLabel("Nombre de la canción").fill("Canción E2E");
  await page.getByRole("button", { name: "Reservar", exact: true }).click();

  await expect(page).toHaveURL(/\/es\/checkout\/c[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Tu reserva" })).toBeVisible();
  await expect(page.getByText(/^YMF-[A-Z0-9]{5}$/)).toBeVisible();
  await expect(page.getByText("Pendiente del depósito")).toBeVisible();
  await expect(page.getByText(/Te guardo esta fecha hasta/)).toBeVisible();

  await page.goto("/dashboard/bookings");
  await expect(page.getByText("Cliente Delivery")).toBeVisible();
  await page.goto("/dashboard/availability");
  await expect(page.getByText("1/2 proyectos").first()).toBeVisible();
});

test("a session slot, once booked, is no longer offered", async ({ page }) => {
  await login(page);
  const day = weekdayAhead(3);
  await page.goto("/es/book?service=asesoria-productores");
  await page.getByLabel("Elige el día de la sesión").fill(day);
  const slots = page.getByRole("radiogroup", { name: "Elige un horario" }).getByRole("radio");
  await expect(slots.first()).toBeAttached();
  const before = await slots.count();
  expect(before).toBe(10); // 08:00 … 17:00

  const first = page.getByRole("radiogroup", { name: "Elige un horario" }).locator("label").first();
  const firstLabel = (await first.textContent())?.trim() ?? "";
  await first.click();
  await fillProject(page, "Session");
  await page.getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(page).toHaveURL(/\/es\/checkout\//);
  await expect(page.getByText("Sesión", { exact: true })).toBeVisible();

  await page.goto("/es/book?service=asesoria-productores");
  await page.getByLabel("Elige el día de la sesión").fill(day);
  await expect(slots.first()).toBeAttached();
  await expect(slots).toHaveCount(before - 1);
  await expect(page.getByRole("radiogroup", { name: "Elige un horario" }).locator("label", { hasText: firstLabel })).toHaveCount(0);
});

test("the admin can move a booking through its states and cancel it", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/bookings");
  await page.getByRole("link", { name: /Cliente Delivery/ }).click();
  await expect(page.getByRole("heading", { name: /Reserva YMF-/ })).toBeVisible();
  await page.getByLabel("Nuevo estado").selectOption({ label: "Cancelada" });
  await page.getByLabel("Nota (opcional)").fill("Prueba E2E");
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  // A cancelled booking is closed: the status form is replaced by a notice.
  await expect(page.getByText("Esta reserva está cerrada")).toBeVisible();
  await expect(page.getByText("Prueba E2E")).toBeVisible(); // note in the history

  // Capacity is released.
  await page.goto("/dashboard/availability");
  await expect(page.getByText("1/2 proyectos")).toHaveCount(0);
});

test("a manual booking from the dashboard starts confirmed and can be completed after the balance", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/bookings/new");
  await page.getByLabel("Servicio", { exact: true }).selectOption({ label: "Mastering (entrega)" });
  await page.getByLabel("Nombre del cliente").fill("Cliente Manual");
  await page.getByLabel("Correo del cliente").fill("manual@example.com");
  await page.getByLabel("Artista").fill("Artista Manual");
  await page.getByLabel("Canción").fill("Tema Manual");
  await page.getByRole("button", { name: "Crear reserva" }).click();
  await expect(page.getByText("Reserva creada.")).toBeVisible();
  await expect(page.getByText("Confirmada").first()).toBeVisible();

  for (const label of ["En proceso", "Entregada"]) {
    await page.getByLabel("Nuevo estado").selectOption({ label });
    await page.getByRole("button", { name: "Cambiar estado" }).click();
    await expect(page.getByRole("status").filter({ hasText: /\S/ })).toContainText(label);
  }
  // Cannot complete before the balance is recorded.
  await page.getByLabel("Nuevo estado").selectOption({ label: "Completada" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "falta registrar el pago del saldo" })).toBeVisible();

  await page.getByRole("button", { name: "Registrar saldo pagado" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saldo registrado" })).toBeVisible();
  await page.getByLabel("Nuevo estado").selectOption({ label: "Completada" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByText("Esta reserva está cerrada")).toBeVisible();
  await expect(page.getByText("Completada").first()).toBeVisible();
});
