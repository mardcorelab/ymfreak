import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDatabaseUrl } from "../../src/lib/database-url";

const NEON_POOLED =
  "postgresql://user:pa%24s@ep-fancy-sunset-b5ymt820-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

test("Neon pooled URL: keeps TLS, adds timeout and pgbouncer, drops channel_binding", () => {
  const url = new URL(normalizeDatabaseUrl(NEON_POOLED));
  assert.equal(url.hostname, "ep-fancy-sunset-b5ymt820-pooler.c-7.us-east-2.aws.neon.tech");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.searchParams.get("connect_timeout"), "15");
  assert.equal(url.searchParams.get("pgbouncer"), "true");
  assert.equal(url.searchParams.has("channel_binding"), false);
  assert.equal(url.password, "pa%24s");
});

test("direct mode strips -pooler and pgbouncer", () => {
  const url = new URL(normalizeDatabaseUrl(NEON_POOLED, { direct: true }));
  assert.equal(url.hostname, "ep-fancy-sunset-b5ymt820.c-7.us-east-2.aws.neon.tech");
  assert.equal(url.searchParams.has("pgbouncer"), false);
});

test("remote URL without params gets TLS; local URL does not", () => {
  const remote = new URL(normalizeDatabaseUrl("postgresql://u:p@db.example.com:5432/app"));
  assert.equal(remote.searchParams.get("sslmode"), "require");
  const local = new URL(normalizeDatabaseUrl("postgresql://ymfreak:ymfreak@localhost:5432/ymfreak"));
  assert.equal(local.searchParams.has("sslmode"), false);
  assert.equal(local.searchParams.get("connect_timeout"), "15");
});

test("an existing connect_timeout is respected; junk is rejected", () => {
  const url = new URL(normalizeDatabaseUrl("postgresql://u:p@h.neon.tech/db?connect_timeout=30"));
  assert.equal(url.searchParams.get("connect_timeout"), "30");
  assert.throws(() => normalizeDatabaseUrl("psql 'postgresql://u:p@h/db'"));
  assert.throws(() => normalizeDatabaseUrl("mysql://u:p@h/db"));
});
