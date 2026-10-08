import "server-only";
import { db } from "./db";

/**
 * Database-backed sliding-window rate limit. Returns false when `key` has
 * already been hit `limit` times within `windowMs`; otherwise records a hit.
 */
export async function allowRate(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const hits = await db.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });
  if (hits >= limit) return false;
  await db.rateLimitHit.create({ data: { key } });
  // Opportunistic cleanup of old rows (cheap, indexed).
  if (Math.random() < 0.02) await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 864e5) } } });
  return true;
}
