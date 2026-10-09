import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/auth/admin";
import { youtubeStatus } from "@/server/youtube";
import { youtubeViewsStatus } from "@/server/youtube-stats";

export const dynamic = "force-dynamic";

/** Dashboard only: YouTube channel feed and view counts (loaded after the page, never blocking it). */
export async function GET() {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  const [channel, views] = await Promise.all([youtubeStatus(), youtubeViewsStatus()]);
  return NextResponse.json({ channel, views }, { headers: { "Cache-Control": "no-store" } });
}
