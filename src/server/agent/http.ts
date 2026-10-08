import "server-only";
import { NextResponse } from "next/server";

/** Browsers always send Origin on cross-site POSTs; refuse those so other sites can't drive the assistant. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(request: Request, maxBytes = 8_000): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > maxBytes) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const noStore = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const asLocale = (v: unknown): "es" | "en" => (v === "en" ? "en" : "es");
