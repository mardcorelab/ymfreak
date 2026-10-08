import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingRequestSchema } from "../../src/lib/validators/booking";
import { parseSetting } from "../../src/server/settings/schemas";
import { businessRulesSeed, contactSeed, paymentSeed } from "../../content/business";
import { serviceSeeds } from "../../content/services";

test("seed settings are valid", () => {
  assert.doesNotThrow(() => parseSetting("business_rules", businessRulesSeed));
  assert.doesNotThrow(() => parseSetting("contact", contactSeed));
  assert.doesNotThrow(() => parseSetting("payment", paymentSeed));
});

test("bad business rules are rejected", () => {
  assert.throws(() => parseSetting("business_rules", { ...businessRulesSeed, workdayEnd: "07:00" }));
  assert.throws(() => parseSetting("business_rules", { ...businessRulesSeed, timeZone: "Mars/Olympus" }));
  assert.throws(() => parseSetting("business_rules", { ...businessRulesSeed, depositPercent: 150 }));
});

test("seed services are consistent", () => {
  const slugs = new Set<string>();
  for (const s of serviceSeeds) {
    assert.ok(!slugs.has(s.slug), `duplicate slug ${s.slug}`);
    slugs.add(s.slug);
    assert.ok(Number.isInteger(s.priceCents) && s.priceCents > 0, s.slug);
    if (s.bookingMode === "DELIVERY") assert.ok((s.turnaroundDays ?? 0) >= 1, s.slug);
    if (s.bookingMode === "SESSION") assert.ok((s.sessionMinutes ?? 0) >= 15, s.slug);
    assert.equal(s.includesEs.length, s.includesEn.length, `${s.slug} includes ES/EN mismatch`);
  }
});

const validDelivery = {
  mode: "DELIVERY",
  services: ["mezcla-mastering"],
  songs: 1,
  requestedDeliveryDate: "2026-10-16",
  project: { songTitle: "Mi canción", artistName: "Artista", notes: "Voz principal + coros" },
  customer: { name: "Ana Pérez", email: "ANA@Example.com ", locale: "es" },
};

test("valid delivery booking request parses and normalises email", () => {
  const parsed = bookingRequestSchema.parse(validDelivery);
  assert.equal(parsed.customer.email, "ana@example.com");
  assert.equal(parsed.mode, "DELIVERY");
});

test("a request cannot carry a price", () => {
  const parsed = bookingRequestSchema.parse({ ...validDelivery, priceCents: 1 }) as Record<string, unknown>;
  assert.equal("priceCents" in parsed, false);
});

test("invalid booking requests are rejected", () => {
  assert.throws(() => bookingRequestSchema.parse({ ...validDelivery, songs: 0 }));
  assert.throws(() => bookingRequestSchema.parse({ ...validDelivery, services: ["../etc/passwd"] }));
  assert.throws(() =>
    bookingRequestSchema.parse({ ...validDelivery, project: { ...validDelivery.project, referenceLinks: ["javascript:alert(1)"] } }),
  );
  assert.throws(() => bookingRequestSchema.parse({ ...validDelivery, customer: { ...validDelivery.customer, email: "nope" } }));
});

test("control characters are stripped from free text", () => {
  const parsed = bookingRequestSchema.parse({
    ...validDelivery,
    project: { ...validDelivery.project, notes: "hola\u0007mundo" },
  });
  assert.equal(parsed.project.notes, "holamundo");
});

test("session request needs an ISO start time", () => {
  const session = {
    mode: "SESSION",
    service: "asesoria-productores",
    hours: 1,
    startsAt: "2026-10-09T08:00:00-04:00",
    project: { artistName: "Productor" },
    customer: validDelivery.customer,
  };
  assert.doesNotThrow(() => bookingRequestSchema.parse(session));
  assert.throws(() => bookingRequestSchema.parse({ ...session, startsAt: "mañana" }));
});
