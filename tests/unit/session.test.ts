import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  safeEqual,
  secretMaterial,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "../../src/server/auth/session";

const material = "test-material-that-is-long-enough";

test("a fresh token verifies and carries the email", async () => {
  const token = await createSessionToken("admin@example.com", material);
  const payload = await verifySessionToken(token, material);
  assert.equal(payload?.email, "admin@example.com");
});

test("tampered, foreign-key and expired tokens are rejected", async () => {
  const now = Date.UTC(2026, 9, 8);
  const token = await createSessionToken("admin@example.com", material, now);
  const [body, sig] = token.split(".");

  const forgedBody = Buffer.from(JSON.stringify({ sub: "admin", email: "evil@x.com", iat: 0, exp: 9e9 })).toString("base64url");
  assert.equal(await verifySessionToken(`${forgedBody}.${sig}`, material, now), null);
  assert.equal(await verifySessionToken(`${body}.${sig}x`, material, now), null);
  assert.equal(await verifySessionToken(token, "another-material-entirely-xx", now), null);
  assert.equal(await verifySessionToken(token, material, now + (SESSION_MAX_AGE_SECONDS + 1) * 1000), null);
  assert.equal(await verifySessionToken("garbage", material, now), null);
  assert.equal(await verifySessionToken(undefined, material, now), null);
  assert.equal(await verifySessionToken(token, null, now), null);
});

test("changing the admin password invalidates sessions", async () => {
  const a = secretMaterial({ ADMIN_PASSWORD: "first-password", DATABASE_URL: "postgresql://x" });
  const b = secretMaterial({ ADMIN_PASSWORD: "second-password", DATABASE_URL: "postgresql://x" });
  assert.ok(a && b && a !== b);
  const token = await createSessionToken("admin@example.com", a!);
  assert.equal(await verifySessionToken(token, b), null);
});

test("no password and no secret means login is disabled", () => {
  assert.equal(secretMaterial({}), null);
  assert.equal(secretMaterial({ AUTH_SECRET: "short" }), null);
  assert.ok(secretMaterial({ AUTH_SECRET: "x".repeat(32) }));
});

test("safeEqual", async () => {
  assert.equal(await safeEqual("abc", "abc"), true);
  assert.equal(await safeEqual("abc", "abd"), false);
  assert.equal(await safeEqual("abc", "abcd"), false);
});
