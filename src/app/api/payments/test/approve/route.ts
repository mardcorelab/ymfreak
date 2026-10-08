import { NextResponse, type NextRequest } from "next/server";
import { paymentsTestMode } from "@/server/payments";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Automated tests only: stands in for "the buyer clicked Pay on PayPal". Disabled everywhere else. */
export async function GET(request: NextRequest) {
  if (!paymentsTestMode()) return new NextResponse("Not found", { status: 404 });
  const target = new URL(request.nextUrl.searchParams.get("return") ?? "/", siteUrl());
  if (target.origin !== new URL(siteUrl()).origin) return new NextResponse("Bad request", { status: 400 });
  target.searchParams.set("token", request.nextUrl.searchParams.get("token") ?? "");
  return NextResponse.redirect(target, 303);
}
