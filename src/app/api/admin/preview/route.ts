import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/auth/admin";

export const dynamic = "force-dynamic";

/** Turns on the owner's preview of the hidden site, then opens it. Admins only. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!(await currentAdmin())) return NextResponse.redirect(new URL("/dashboard/login", url));
  (await draftMode()).enable();
  const to = url.searchParams.get("to") ?? "/es";
  // Same-site paths only.
  const safe = /^\/(es|en)(\/[\w\-/]*)?$/.test(to) ? to : "/es";
  return NextResponse.redirect(new URL(safe, url));
}
