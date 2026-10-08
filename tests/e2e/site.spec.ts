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
  await page.goto("/dashboard/analytics?d=7");
  await expect(page.getByRole("heading", { name: "Analíticas" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Servicios" })).toBeVisible();
  await expect(page.getByText("Visitas por día")).toBeVisible();
});
