import { clientIp } from "@/server/auth/admin";
import { noStore, readJson, sameOrigin } from "@/server/agent/http";
import { speak } from "@/server/agent/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reads one of the assistant's replies aloud in YM Freak's cloned voice (AI-generated). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return noStore({ ok: false, error: "INVALID" }, 403);
  const body = await readJson(request);
  if (!body) return noStore({ ok: false, error: "INVALID" }, 400);
  const result = await speak(body.conversationId, body.text, await clientIp());
  if (!result.ok) return noStore(result, result.error === "RATE_LIMITED" ? 429 : result.error === "NOT_CONFIGURED" || result.error === "NOT_FOUND" ? 404 : 502);
  return new Response(result.audio, { headers: { "Content-Type": result.type, "Cache-Control": "private, max-age=3600" } });
}
