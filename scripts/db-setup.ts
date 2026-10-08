/**
 * Prepares the database during a deploy: applies the schema, the extra SQL
 * constraints and the (idempotent) seed. Runs over Neon's direct endpoint and
 * retries while a sleeping Neon compute wakes up.
 *
 *   tsx scripts/db-setup.ts
 */
import { spawnSync } from "node:child_process";
import { normalizeDatabaseUrl } from "../src/lib/database-url";

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.");
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: normalizeDatabaseUrl(raw, { direct: true }) };
const host = new URL(env.DATABASE_URL).hostname;
console.log(`Database setup against ${host}`);

const steps: [string, string[]][] = [
  ["Prepare schema changes", ["prisma", "db", "execute", "--file", "prisma/sql/000_before_push.sql", "--schema", "prisma/schema.prisma"]],
  ["Apply schema", ["prisma", "db", "push", "--skip-generate"]],
  ["Apply constraints", ["prisma", "db", "execute", "--file", "prisma/sql/001_session_no_overlap.sql", "--schema", "prisma/schema.prisma"]],
  ["Seed initial content", ["tsx", "prisma/seed.ts"]],
];

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

for (const [label, args] of steps) {
  for (let attempt = 1; ; attempt++) {
    console.log(`\n▶ ${label}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
    const result = spawnSync("npx", args, { env, stdio: "inherit" });
    if (result.status === 0) break;
    if (attempt >= 3) {
      console.error(
        `\n✖ ${label} failed. If the error is P1001, check that DATABASE_URL in Vercel is the exact connection string from Neon (no quotes, no "psql" prefix).`,
      );
      process.exit(result.status ?? 1);
    }
    sleep(5000 * attempt);
  }
}
console.log("\n✓ Database ready");
