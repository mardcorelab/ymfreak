import { clientIp } from "@/server/auth/admin";
import { asLocale, noStore, sameOrigin } from "@/server/agent/http";
import { MAX_NOTE_BYTES, transcribe } from "@/server/agent/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Turns a visitor's voice note into text; the widget then sends it as a normal message. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return noStore({ ok: false, error: "INVALID" }, 403);
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_NOTE_BYTES + 64_000) return noStore({ ok: false, error: "TOO_BIG" }, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return noStore({ ok: false, error: "INVALID" }, 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) return noStore({ ok: false, error: "INVALID" }, 400);
  const result = await transcribe(audio, asLocale(form.get("locale")), await clientIp());
  return noStore(result, result.ok ? 200 : result.error === "RATE_LIMITED" ? 429 : result.error === "NOT_CONFIGURED" ? 404 : 200);
}
