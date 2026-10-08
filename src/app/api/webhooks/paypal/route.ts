import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/server/payments";
import { handleProviderEvent } from "@/server/payments/service";

export const dynamic = "force-dynamic";

/**
 * PayPal webhook. Every event is verified with PayPal (signature + webhook id)
 * before anything changes, and each event id is processed only once.
 */
export async function POST(request: NextRequest) {
  const provider = getPaymentProvider();
  if (!provider || provider.name !== "paypal") return NextResponse.json({ error: "payments not configured" }, { status: 503 });

  const raw = await request.text();
  if (raw.length > 256_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const event = await provider.verifyWebhook(raw, request.headers).catch(() => null);
  if (!event) return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  try {
    await handleProviderEvent(event, provider.name);
  } catch (e) {
    console.error("[webhook] processing failed", e);
    // A 5xx makes PayPal retry later.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
