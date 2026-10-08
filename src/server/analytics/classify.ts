/**
 * Pure helpers for the cookie-free analytics (unit-tested).
 */
import { createHash } from "node:crypto";

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|node-fetch|axios|playwright|vercel-screenshot/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT.test(userAgent);
}

export function deviceOf(userAgent: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** Only the host of an external referrer; internal navigation and garbage become null. */
export function referrerHost(referrer: string | null | undefined, ownHosts: string[]): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || ownHosts.some((h) => h.replace(/^www\./, "").toLowerCase() === host)) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

/** Public page paths only: /es or /en followed by a simple path. Booking and account pages are grouped. */
export function normalizePath(path: unknown): { path: string; locale: "es" | "en" } | null {
  if (typeof path !== "string" || path.length > 200) return null;
  const m = /^\/(es|en)(\/[a-z0-9\-/]*)?$/i.exec(path.split("?")[0]!.split("#")[0]!);
  if (!m) return null;
  let rest = (m[2] ?? "").replace(/\/+$/, "").toLowerCase();
  if (rest.startsWith("/checkout/")) rest = "/checkout";
  if (rest.startsWith("/account/")) rest = "/account/project";
  return { path: rest || "/", locale: m[1]!.toLowerCase() as "es" | "en" };
}

/**
 * Daily visitor id: hash(secret + day + ip + user agent). It cannot be
 * reversed, and it changes every day, so visitors are never tracked across days.
 */
export function dailyVisitor(secret: string, ip: string, userAgent: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${secret}|${day}|${ip}|${userAgent}`).digest("base64url").slice(0, 22);
}

export function cleanUtm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/[^a-z0-9._\-]/g, "").slice(0, 40);
  return v || null;
}
