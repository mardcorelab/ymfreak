import { expect, test, type Page } from "@playwright/test";

// Runs with AGENT_TEST_MODE=1: a scripted stand-in for Claude that calls the
// tool named in the message (`TOOL <name> <json>`). Everything behind the
// tools — prices, calendar, pending actions, booking — is the real code.

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

async function login(page: Page) {
  await page.goto("/dashboard/login");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tu panel" })).toBeVisible();
}

async function openChat(page: Page) {
  await page.getByRole("button", { name: /¿Qué quieres crear/ }).click();
  await expect(page.getByRole("dialog", { name: "Asistente del estudio" })).toBeVisible();
}

async function say(page: Page, text: string) {
  const box = page.getByLabel("Escribe tu mensaje…");
  await box.fill(text);
  await box.press("Enter");
}

const log = (page: Page) => page.getByTestId("agent-log");

const PROPOSAL = JSON.stringify({
  mode: "DELIVERY",
  services: ["mezcla-mastering"],
  songs: 1,
  name: "Cliente Asistente",
  email: "asistente@example.com",
  artist_name: "Artista Asistente",
  song_title: "Canción Asistente",
});

test.describe.configure({ mode: "serial" });

test("the assistant answers from live data and cannot book while booking is closed", async ({ page }) => {
  await page.goto("/es");
  await openChat(page);
  await expect(log(page).getByText(/Soy el asistente del estudio/)).toBeVisible();

  await say(page, "hola");
  await expect(log(page).getByText("TEST-REPLY echo: hola")).toBeVisible();

  // Prices come from the database through the tool.
  await say(page, "TOOL get_services {}");
  const services = log(page).locator('[data-card="services"]');
  await expect(services.getByText("Mezcla + Mastering")).toBeVisible();
  await expect(services.getByText("$150", { exact: false }).first()).toBeVisible();

  // Real delivery date and deposit from the calendar engine.
  await say(page, 'TOOL quote_delivery {"services":["mezcla-mastering"],"songs":1}');
  const quote = log(page).locator('[data-card="quote"]');
  await expect(quote.getByText("Entrega estimada")).toBeVisible();
  await expect(quote.getByText("$75")).toHaveCount(2);

  // The write tool refuses while online booking is closed: no proposal is shown.
  await say(page, `TOOL propose_booking ${PROPOSAL}`);
  await expect(log(page).getByText(/TEST-REPLY propose_booking error: .*BOOKING_CLOSED/)).toBeVisible();
  await expect(log(page).locator('[data-card="proposal"]')).toHaveCount(0);

  // Booking status needs a matching code and email.
  await say(page, 'TOOL get_booking_status {"code":"YMF-ZZZZZ","email":"nadie@example.com"}');
  await expect(log(page).getByText(/TEST-REPLY get_booking_status error: .*NOT_FOUND/)).toBeVisible();

  // Unknown tools and bad input come back as errors, never crashes.
  await say(page, 'TOOL quote_delivery {"services":"x"}');
  await expect(log(page).getByText(/TEST-REPLY quote_delivery error: .*INVALID_INPUT/)).toBeVisible();

  // The conversation survives a reload.
  await page.reload();
  await openChat(page);
  await expect(log(page).getByText("TEST-REPLY echo: hola")).toBeVisible();
  await expect(log(page).locator('[data-card="quote"]')).toBeVisible();
});

test("other websites can't drive the assistant", async ({ request }) => {
  const res = await request.post("/api/agent/chat", { headers: { origin: "https://evil.example" }, data: { text: "hola", locale: "es" } });
  expect(res.status()).toBe(403);
  const forged = await request.post("/api/agent/confirm", { data: { conversationId: "0".repeat(32), actionId: "x", locale: "es" } });
  expect((await forged.json()).ok).toBe(false);
});

test("a booking happens only when the visitor presses Confirm, then goes to the deposit", async ({ page }) => {
  // Logged in as the admin, booking is open in preview mode.
  await login(page);
  await page.goto("/es");
  await openChat(page);

  await say(page, `TOOL propose_booking ${PROPOSAL}`);
  const proposal = log(page).locator('[data-card="proposal"]').last();
  await expect(proposal.getByText("Tu reserva")).toBeVisible();
  await expect(proposal.getByText("Mezcla + Mastering")).toBeVisible();
  await expect(proposal.getByText("$150")).toBeVisible();
  await expect(proposal.getByText("Nada se reserva hasta que confirmes")).toBeVisible();

  // Declining books nothing.
  await proposal.getByRole("button", { name: "No, cancelar" }).click();
  await expect(log(page).getByText("Listo, no hice la reserva.")).toBeVisible();
  await expect(proposal.getByText("Descartada")).toBeVisible();

  // A new proposal, confirmed.
  await say(page, `TOOL propose_booking ${PROPOSAL}`);
  const second = log(page).locator('[data-card="proposal"]').last();
  await second.getByRole("button", { name: "Confirmar reserva" }).click();
  const booked = log(page).locator('[data-card="booked"]');
  await expect(booked.getByText(/^YMF-[A-Z0-9]{5}$/)).toBeVisible();
  await expect(second.getByText("Confirmada")).toBeVisible();
  const code = (await booked.getByText(/^YMF-/).textContent())?.trim() ?? "";

  await booked.getByRole("link", { name: "Pagar depósito ($75)" }).click();
  await expect(page).toHaveURL(/\/es\/checkout\/c[a-z0-9]+$/);
  await expect(page.getByText("Pendiente del depósito")).toBeVisible();
  await expect(page.getByText(code)).toBeVisible();

  // The dashboard shows the conversation, linked to the booking.
  await page.goto("/dashboard/conversations");
  // (the first "Reservó" link is the filter; the conversation is in the list)
  await page.getByRole("listitem").getByRole("link", { name: /Reservó/ }).first().click();
  await expect(page.getByText("preparó una reserva para confirmar").first()).toBeVisible();
  await page.getByRole("link", { name: `Reserva ${code}` }).click();
  await expect(page.getByRole("heading", { name: `Reserva ${code}` })).toBeVisible();
  await expect(page.getByText("Reserva creada con el asistente")).toBeVisible();

  // Release the capacity so later tests start from an empty calendar.
  await page.getByLabel("Nuevo estado").selectOption({ label: "Cancelada" });
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByText("Esta reserva está cerrada")).toBeVisible();
});
