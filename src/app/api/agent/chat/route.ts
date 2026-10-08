import { clientIp } from "@/server/auth/admin";
import { handleChat, loadConversation } from "@/server/agent/chat";
import { asLocale, noStore, readJson, sameOrigin } from "@/server/agent/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Restores a conversation in the widget (the id is a random 128-bit token kept by the visitor's browser). */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("c") ?? "";
  const conversation = await loadConversation(id);
  return conversation ? noStore({ ok: true, ...conversation }) : noStore({ ok: false, error: "NOT_FOUND" }, 404);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return noStore({ ok: false, error: "INVALID" }, 403);
  const body = await readJson(request);
  if (!body || typeof body.text !== "string") return noStore({ ok: false, error: "INVALID" }, 400);
  const result = await handleChat({
    conversationId: typeof body.conversationId === "string" ? body.conversationId : null,
    text: body.text,
    locale: asLocale(body.locale),
    ip: await clientIp(),
  });
  return noStore(result, result.ok ? 200 : result.error === "RATE_LIMITED" ? 429 : result.error === "MODEL_ERROR" ? 502 : 200);
}
