import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/seo";

/**
 * Origin the visitor is actually using (e.g. ymfreak.vercel.app before the
 * custom domain is connected), so return links from PayPal come back to a
 * site that exists. Only known hosts are accepted; anything else falls back
 * to NEXT_PUBLIC_SITE_URL, so a forged Host header cannot redirect payments.
 */
export async function requestOrigin(): Promise<string> {
  const configured = new URL(siteUrl());
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim().toLowerCase();
  const allowed = new Set(
    [configured.host, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase()),
  );
  if (!host || !allowed.has(host)) return configured.origin;
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  return `${local ? "http" : "https"}://${host}`;
}
