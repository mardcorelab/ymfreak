import { expect, test } from "@playwright/test";

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

test("security headers are sent", async ({ request }) => {
  const res = await request.get("/es");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("https://www.youtube-nocookie.com");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("SEO files: sitemap in both languages, robots, manifest, icons and structured data", async ({ request, page }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/en/services");
  expect(sitemap).toContain("/es/terms");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /dashboard");
  expect(robots).toContain("Disallow: /es/account");
  expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
  expect((await request.get("/icon.svg")).ok()).toBe(true);
  expect((await request.get("/apple-icon")).headers()["content-type"]).toContain("image/png");

  expect((await request.get("/es/opengraph-image")).headers()["content-type"]).toContain("image/png");
  expect(await (await request.get("/icon.svg")).text()).toContain("<path");

  await page.goto("/es");
  await expect(page.getByRole("heading", { level: 1, name: "YM Freak" })).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);

  await page.goto("/es/services");
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toContain('"ProfessionalService"');
  expect(ld).toContain('"priceCurrency":"USD"');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
});

test("terms and privacy show the live business rules", async ({ page }) => {
  await page.goto("/es/terms");
  await expect(page.getByRole("heading", { name: "Condiciones de reserva" })).toBeVisible();
  await expect(page.getByText(/Pagas el 50 % para reservar/)).toBeVisible();
  await expect(page.getByText(/dentro de las 24 horas/)).toBeVisible();
  await page.goto("/en/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", exact: true })).toBeVisible();
  await expect(page.getByText(/your IP address is not stored/)).toBeVisible();
});

test("visits are counted without cookies and appear in the dashboard", async ({ browser, page }) => {
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  const beacons: string[] = [];
  visitor.on("request", (r) => r.url().endsWith("/api/t") && beacons.push(r.url()));
  await visitor.goto("/es");
  await visitor.getByRole("link", { name: "Servicios" }).first().click();
  await expect(visitor).toHaveURL(/\/es\/services$/);
  await expect.poll(() => beacons.length).toBeGreaterThanOrEqual(2);
  // No tracking cookies (only next-intl's technical language cookie may exist).
  expect((await ctx.cookies()).filter((c) => c.name !== "NEXT_LOCALE")).toEqual([]);
  await ctx.close();

  await page.goto("/dashboard/login");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tu panel" })).toBeVisible();
  await page.goto("/dashboard/analytics?d=7");
  await expect(page.getByRole("heading", { name: "Analíticas" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Servicios" })).toBeVisible();
  await expect(page.getByText("Visitas por día")).toBeVisible();
});

test("link-in-bio page and release pages", async ({ page }) => {
  await page.goto("/links?utm_source=instagram");
  await expect(page).toHaveURL(/\/(es|en)\/links\?utm_source=instagram$/);
  await page.goto("/es/links?utm_source=instagram");
  await expect(page.getByRole("heading", { level: 1, name: "YM Freak" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reserva tu fecha/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Instagram/ })).toBeVisible();
  // No header/footer of the main site on this page.
  await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);

  await page.getByRole("link", { name: /No Era El Plan/ }).click();
  await expect(page).toHaveURL(/\/es\/r\/no-era-el-plan$/);
  await expect(page.getByRole("heading", { level: 1, name: "No Era El Plan" })).toBeVisible();
  await expect(page.getByText("Escúchalo en")).toBeVisible();
  await expect(page.locator('[data-platform="spotify"]')).toHaveAttribute("href", /open\.spotify\.com/);
  await expect(page.getByRole("link", { name: "Trabaja con YM Freak" })).toBeVisible();

  await page.goto("/es/r/does-not-exist");
  await expect(page.getByRole("heading", { level: 1, name: "No Era El Plan" })).toHaveCount(0);
});

test("the home page shows the next available delivery date from the calendar", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByTestId("next-available")).toContainText("Próxima entrega disponible:");
  await expect(page.getByTestId("next-available")).toContainText("Mezcla + Mastering");
});

/** 16-bit stereo WAV of a 1 kHz sine at the given peak level. */
function sineWav(dbfs: number, seconds: number, rate = 48000): Buffer {
  const n = seconds * rate;
  const data = Buffer.alloc(n * 4);
  const amp = Math.pow(10, dbfs / 20) * 32767;
  for (let i = 0; i < n; i++) {
    const v = Math.round(amp * Math.sin((2 * Math.PI * 1000 * i) / rate));
    data.writeInt16LE(v, i * 4);
    data.writeInt16LE(v, i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

test("the master analyzer measures a reference tone in the browser", async ({ page }) => {
  const uploads: string[] = [];
  page.on("request", (r) => r.method() === "POST" && !r.url().endsWith("/api/t") && uploads.push(r.url()));
  await page.goto("/es/analyzer");
  await expect(page.getByRole("heading", { level: 1, name: "Analizador de masters" })).toBeVisible();
  await page.getByTestId("analyzer-input").setInputFiles({ name: "tono.wav", mimeType: "audio/wav", buffer: sineWav(-23, 6) });
  await expect(page.getByTestId("analyzer-result")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("lufs")).toHaveText(/^-23[.,]0 LUFS$/);
  await expect(page.getByText(/WAV · 48 kHz · 16 bits · estéreo/)).toBeVisible();
  await expect(page.locator('[data-platform="Spotify"]')).toContainText("La sube 9");
  await expect(page.locator('[data-platform="YouTube"]')).toContainText("No sube canciones bajas");
  await expect(page.getByRole("link", { name: /Reserva tu mastering \(\$70\)/ })).toBeVisible();
  // The audio never left the browser.
  expect(uploads).toEqual([]);
});

test("the assistant knows the page and reads a song dropped into the chat", async ({ page }) => {
  await page.goto("/es/analyzer");
  await page.getByRole("button", { name: /¿Qué quieres crear/ }).click();
  const chat = page.getByTestId("agent-log");
  await expect(chat.getByText(/Suelta tu canción aquí en el chat/)).toBeVisible();
  await expect(page.getByRole("button", { name: "¿Mi master está listo para Spotify?" })).toBeVisible();
  await page.getByTestId("agent-audio-input").setInputFiles({ name: "tono.wav", mimeType: "audio/wav", buffer: sineWav(-23, 6) });
  // The numbers are measured in the browser and sent as the visitor's message.
  await expect(chat.getByText(/TEST-REPLY echo: Analicé mi canción «tono\.wav»: [-−]23[.,]0 LUFS integrados/)).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText(/En Spotify le subirían el volumen/).first()).toBeVisible();
});

test("press kit: bios, facts and downloadable logos", async ({ page, request }) => {
  await page.goto("/es/press");
  await expect(page.getByRole("heading", { level: 1, name: "Prensa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Biografía corta" })).toBeVisible();
  await expect(page.getByText("Nominación al Latin Grammy").first()).toBeVisible();
  for (const f of ["ymfreak-logo-light.png", "ymfreak-logo-dark.svg", "ymfreak-monogram-light.png", "ymfreak-icon.png"]) {
    await expect(page.locator(`a[href="/press/${f}"]`).first()).toBeAttached();
    expect((await request.get(`/press/${f}`)).ok()).toBe(true);
  }
});

test("YM Freak names and guides the assistant from the dashboard", async ({ page }) => {
  await page.goto("/dashboard/login");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tu panel" })).toBeVisible();
  await page.goto("/dashboard/assistant");
  await page.getByLabel("Nombre del asistente").fill("Eco");
  await page.getByLabel("Tus instrucciones").fill("Saluda con energía.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Asistente actualizado.")).toBeVisible();

  await page.goto("/es");
  await page.getByRole("button", { name: /¿Qué quieres crear/ }).click();
  await expect(page.getByRole("dialog", { name: "Eco" })).toBeVisible();
  await expect(page.getByText(/Soy Eco, el asistente del estudio/)).toBeVisible();

  // Back to no name so other runs start clean.
  await page.goto("/dashboard/assistant");
  await page.getByLabel("Nombre del asistente").fill("");
  await page.getByLabel("Tus instrucciones").fill("");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Asistente actualizado.")).toBeVisible();
});

test("the owner can hide the site behind a coming-soon page and still preview it", async ({ page, browser }) => {
  await page.goto("/dashboard/login");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Tu panel" })).toBeVisible();
  const visibility = page.locator("section", { has: page.getByRole("heading", { name: "Visibilidad de la web" }) });
  const toggle = async (hide: boolean, message: RegExp) => {
    await page.goto("/dashboard");
    await visibility.getByLabel("Ocultar la web al público (modo Próximamente)").setChecked(hide);
    await visibility.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText(message)).toBeVisible();
  };

  await toggle(true, /Web oculta: los visitantes ven la página de Próximamente/);
  try {
    const visitor = await browser.newContext();
    const v = await visitor.newPage();
    await v.goto("/es");
    await expect(v.getByTestId("coming-soon")).toBeVisible();
    await expect(v.getByRole("heading", { name: "Estamos afinando algo grande" })).toBeVisible();
    await v.goto("/en/services");
    await expect(v.getByRole("heading", { name: "Fine-tuning something big" })).toBeVisible();
    await v.goto("/es/links");
    await expect(v.getByTestId("coming-soon")).toBeVisible();
    // Clients can still reach their account, checkout and the legal pages.
    await v.goto("/es/account");
    await expect(v.getByTestId("coming-soon")).toHaveCount(0);
    await v.goto("/es/privacy");
    await expect(v.getByTestId("coming-soon")).toHaveCount(0);
    await visitor.close();

    // The owner sees the real site with a banner.
    await page.goto("/es");
    await expect(page.getByTestId("hidden-banner")).toBeVisible();
    await expect(page.getByTestId("coming-soon")).toHaveCount(0);
  } finally {
    await toggle(false, /Web visible para todo el mundo/);
  }
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto("/es");
  await expect(v.getByTestId("coming-soon")).toHaveCount(0);
  await visitor.close();
});
