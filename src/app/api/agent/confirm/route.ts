import { clientIp } from "@/server/auth/admin";
import { confirmAction } from "@/server/agent/chat";
import { asLocale, noStore, readJson, sameOrigin } from "@/server/agent/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** The visitor's explicit click on Confirm / Cancel for a booking the assistant proposed. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return noStore({ ok: false, error: "INVALID" }, 403);
  const body = await readJson(request);
  if (!body || typeof body.conversationId !== "string" || typeof body.actionId !== "string") return noStore({ ok: false, error: "INVALID" }, 400);
  const result = await confirmAction({
    conversationId: body.conversationId,
    actionId: body.actionId,
    decision: body.decision === "dismiss" ? "dismiss" : "confirm",
    locale: asLocale(body.locale),
    ip: await clientIp(),
  });
  return noStore(result);
}
