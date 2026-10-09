import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/auth/admin";
import { youtubeStatus } from "@/server/youtube";

export const dynamic = "force-dynamic";

/** Dashboard only: whether the YouTube channel is connected (loaded after the page, never blocking it). */
export async function GET() {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  return NextResponse.json(await youtubeStatus(), { headers: { "Cache-Control": "no-store" } });
}
