import { NextResponse, type NextRequest } from "next/server";
import { finalizePayment } from "@/server/payments/service";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** The client lands here after approving the payment on PayPal. */
export async function GET(request: NextRequest) {
  const paymentId = request.nextUrl.searchParams.get("payment") ?? "";
  const locale = request.nextUrl.searchParams.get("l") === "en" ? "en" : "es";
  if (!/^c[a-z0-9]{20,32}$/.test(paymentId)) return NextResponse.redirect(new URL(`/${locale}`, siteUrl()));

  const result = await finalizePayment(paymentId);
  if (!result.orderId) return NextResponse.redirect(new URL(`/${locale}`, siteUrl()));
  const outcome = result.ok ? "paid" : result.error === "NOT_READY" ? "pending" : result.error === "HOLD_EXPIRED" ? "expired" : "failed";
  return NextResponse.redirect(new URL(`/${locale}/checkout/${result.orderId}?payment=${outcome}`, siteUrl()), 303);
}
