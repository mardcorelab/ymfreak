import { test } from "node:test";
import assert from "node:assert/strict";
import { clientKey, createClientToken, verifyClientToken } from "../../src/server/auth/client-token";

const key = clientKey({ DATABASE_URL: "postgres://secret" })!;

test("client tokens round-trip and expire", () => {
  const now = Date.UTC(2026, 9, 8);
  const token = createClientToken("cust_1", key, now);
  assert.equal(verifyClientToken(token, key, now)?.cid, "cust_1");
  assert.equal(verifyClientToken(token, key, now + 31 * 86400_000), null);
});

test("client tokens reject tampering, other keys and malformed input", () => {
  const token = createClientToken("cust_1", key);
  const [body, sig] = token.split(".") as [string, string];
  const forged = Buffer.from(JSON.stringify({ sub: "client", cid: "cust_2", iat: 1, exp: 9e9 })).toString("base64url");
  assert.equal(verifyClientToken(`${forged}.${sig}`, key), null);
  assert.equal(verifyClientToken(token, clientKey({ DATABASE_URL: "postgres://other" })), null);
  assert.equal(verifyClientToken(`${body}`, key), null);
  assert.equal(verifyClientToken(`${body}.${sig}.x`, key), null);
  assert.equal(verifyClientToken("", key), null);
  assert.equal(verifyClientToken(token, null), null);
});

test("AUTH_SECRET wins over the database URL when long enough", () => {
  assert.notEqual(clientKey({ AUTH_SECRET: "x".repeat(32), DATABASE_URL: "postgres://secret" }), key);
  assert.equal(clientKey({ AUTH_SECRET: "short", DATABASE_URL: "postgres://secret" }), key);
  assert.equal(clientKey({}), null);
});
