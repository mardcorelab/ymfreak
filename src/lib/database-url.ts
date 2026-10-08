/**
 * Normalises the PostgreSQL connection string so it works the same whether it
 * points at a local database, Neon's pooled endpoint or Neon's direct endpoint.
 *
 *  - Neon computes sleep when idle and need a few seconds to wake up; Prisma's
 *    default 5 s connect timeout is too short for that (error P1001), so we
 *    give it 15 s unless a value is already set.
 *  - Remote databases always use TLS.
 *  - Neon's pooled endpoint (host contains "-pooler") runs PgBouncer, which
 *    Prisma must be told about.
 *  - Schema changes (db push / migrations) need a direct, non-pooled
 *    connection: `toDirect` strips "-pooler" from a Neon host.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "db"]);

export function normalizeDatabaseUrl(raw: string, opts: { direct?: boolean } = {}): string {
  const url = new URL(raw.trim());
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must start with postgresql://");
  }

  if (opts.direct) url.hostname = url.hostname.replace("-pooler.", ".");
  const pooled = url.hostname.includes("-pooler.");
  const local = LOCAL_HOSTS.has(url.hostname);
  const p = url.searchParams;

  // Not understood by Prisma's engine; TLS is enforced through sslmode instead.
  p.delete("channel_binding");
  if (!local && !p.has("sslmode")) p.set("sslmode", "require");
  if (!p.has("connect_timeout")) p.set("connect_timeout", "15");
  if (pooled) p.set("pgbouncer", "true");
  else p.delete("pgbouncer");

  return url.toString();
}
