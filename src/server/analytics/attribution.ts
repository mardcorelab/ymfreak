import "server-only";
import { headers } from "next/headers";
import { db } from "../db";
import { env } from "../env";
import { dailyVisitor, isBot } from "./classify";

/**
 * Which channel brought the person making a booking right now: the channel of
 * their first page view today (same anonymous daily id as the analytics).
 * "direct" when they arrived without a referrer, null when nothing was
 * recorded (Do Not Track, blocked beacons, a new day).
 */
export async function currentChannel(): Promise<string | null> {
  try {
    const h = await headers();
    const ua = h.get("user-agent");
    if (isBot(ua)) return null;
    const ip = (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0").slice(0, 64);
    const now = new Date();
    const visitor = dailyVisitor(env.AUTH_SECRET ?? env.DATABASE_URL, ip, ua ?? "", now);
    const since = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
    const first = await db.analyticsEvent.findFirst({
      where: { visitor, createdAt: { gte: since }, channel: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { channel: true },
    });
    if (first?.channel) return first.channel;
    const any = await db.analyticsEvent.count({ where: { visitor, createdAt: { gte: since } } });
    return any > 0 ? "direct" : null;
  } catch {
    return null;
  }
}
