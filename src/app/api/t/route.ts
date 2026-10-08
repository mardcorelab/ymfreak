import { headers } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { currentAdmin } from "@/server/auth/admin";
import { siteUrl } from "@/lib/seo";
import { cleanUtm, dailyVisitor, deviceOf, isBot, normalizePath, referrerHost } from "@/server/analytics/classify";

export const dynamic = "force-dynamic";

/**
 * Receives a page view (sent with navigator.sendBeacon). Always answers 204 so
 * the browser never retries or shows errors; invalid or bot hits are dropped.
 */
export async function POST(request: Request) {
  try {
    const h = await headers();
    const ua = h.get("user-agent");
    if (isBot(ua) || h.get("sec-gpc") === "1" || h.get("dnt") === "1") return new Response(null, { status: 204 });
    const raw = await request.text();
    if (raw.length > 2000) return new Response(null, { status: 204 });
    const body = JSON.parse(raw) as { t?: string; p?: string; r?: string; u?: string };
    const page = normalizePath(body.p);
    const type = body.t === "agent_open" ? "agent_open" : "pageview";
    if (!page || (await currentAdmin())) return new Response(null, { status: 204 });

    const ip = (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0").slice(0, 64);
    const own = [new URL(siteUrl()).hostname, h.get("host") ?? "", "ymfreak.com", "ymfreak.vercel.app"];
    const country = h.get("x-vercel-ip-country");
    await db.analyticsEvent.create({
      data: {
        type,
        path: page.path,
        locale: page.locale,
        referrer: referrerHost(body.r, own),
        utmSource: cleanUtm(body.u),
        country: country && /^[A-Z]{2}$/.test(country) ? country : null,
        device: deviceOf(ua ?? ""),
        visitor: dailyVisitor(env.AUTH_SECRET ?? env.DATABASE_URL, ip, ua ?? ""),
      },
    });
    // Keep about 13 months.
    if (Math.random() < 0.01) await db.analyticsEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 400 * 864e5) } } });
  } catch {
    /* analytics must never break anything */
  }
  return new Response(null, { status: 204 });
}
