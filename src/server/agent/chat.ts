import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { db } from "../db";
import { getSetting } from "../settings";
import { allowRate } from "../rate-limit";
import { bookingOpen } from "../booking/public-actions";
import { createBooking } from "../booking/engine";
import { currentChannel } from "../analytics/attribution";
import { formatMoney } from "../domain/money";
import { bookingRequestSchema } from "@/lib/validators/booking";
import { AGENT_LIMITS, type AgentCard, type ChatItem, type ChatResponse, type ConfirmResponse } from "@/lib/agent-types";
import { recentWindow, toApiMessages, type Block, type ToolResultBlock, type ToolUseBlock } from "./llm";
import { getAgentModel } from "./model";
import { getAgentSettings } from "./settings";
import { currentClient } from "../portal/session";
import { dynamicPrompt, STABLE_PROMPT } from "./prompt";
import { fmtTime, runTool, TOOL_DEFS, type Locale } from "./tools";

const MAX_TOOL_ROUNDS = 6;
const HISTORY_USER_TURNS = 10;

const CONVERSATION_ID = /^[a-f0-9]{32}$/;
export const isConversationId = (id: unknown): id is string => typeof id === "string" && CONVERSATION_ID.test(id);

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function addRow(conversationId: string, role: "user" | "assistant" | "tool" | "card", content: unknown) {
  await db.message.create({ data: { conversationId, role, content: json(content) } });
}

/** What the visitor sees of a stored conversation: their messages, the assistant's text and the cards. */
export function visibleItems(rows: { role: string; content: unknown }[]): ChatItem[] {
  const items: ChatItem[] = [];
  for (const r of rows) {
    if (r.role === "card") items.push({ type: "card", card: r.content as AgentCard });
    else if (r.role === "user" || r.role === "assistant") {
      const text = (r.content as Block[])
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n\n")
        .trim();
      if (text) items.push({ type: "text", role: r.role, text });
    }
  }
  return items;
}

/** Marks proposal cards as confirmed/dismissed/expired so a reloaded chat never offers a stale Confirm button. */
async function withProposalState(conversationId: string, items: ChatItem[], now: Date): Promise<ChatItem[]> {
  const ids = items.flatMap((i) => (i.type === "card" && i.card.kind === "proposal" ? [i.card.actionId] : []));
  if (ids.length === 0) return items;
  const actions = await db.pendingAction.findMany({ where: { conversationId, id: { in: ids } } });
  return items.map((i) => {
    if (i.type !== "card" || i.card.kind !== "proposal") return i;
    const card = i.card;
    const a = actions.find((x) => x.id === card.actionId);
    const summary = (a?.summary ?? {}) as { dismissed?: boolean; failed?: string };
    const state: "open" | "confirmed" | "dismissed" | "expired" = !a || summary.failed
      ? "expired"
      : a.confirmedAt
        ? "confirmed"
        : summary.dismissed
          ? "dismissed"
          : a.expiresAt <= now
            ? "expired"
            : "open";
    return { type: "card", card: { ...card, state } };
  });
}

export async function loadConversation(id: string): Promise<{ conversationId: string; items: ChatItem[] } | null> {
  if (!isConversationId(id)) return null;
  const rows = await db.message.findMany({ where: { conversationId: id }, orderBy: { seq: "asc" }, take: 400 });
  if (rows.length === 0) return null;
  return { conversationId: id, items: await withProposalState(id, visibleItems(rows), new Date()) };
}

export async function handleChat(input: { conversationId?: string | null; text: string; locale: Locale; ip: string; page?: string | null }): Promise<ChatResponse> {
  const model = getAgentModel();
  if (!model) return { ok: false, error: "NOT_CONFIGURED" };
  const text = input.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!text) return { ok: false, error: "INVALID" };
  if (text.length > AGENT_LIMITS.messageChars) return { ok: false, error: "TOO_LONG" };

  if (!(await allowRate(`agent:${input.ip}`, 20, 10 * 60_000))) return { ok: false, error: "RATE_LIMITED" };
  // Global ceiling protects the API budget if the site is ever flooded.
  if (!(await allowRate("agent:all", 2000, 24 * 60 * 60_000))) return { ok: false, error: "RATE_LIMITED" };

  const now = new Date();
  let conversation = isConversationId(input.conversationId) ? await db.conversation.findUnique({ where: { id: input.conversationId } }) : null;
  if (!conversation) {
    conversation = await db.conversation.create({ data: { id: randomBytes(16).toString("hex"), locale: input.locale } });
  }
  const conversationId = conversation.id;
  if (conversation.userMessages >= AGENT_LIMITS.userMessagesPerConversation) return { ok: false, error: "CONVERSATION_LIMIT", conversationId };

  await addRow(conversationId, "user", [{ type: "text", text }]);
  await db.conversation.update({ where: { id: conversationId }, data: { userMessages: { increment: 1 }, lastMessageAt: now } });

  const [rules, open, agent, client] = await Promise.all([getSetting("business_rules"), bookingOpen(), getAgentSettings(), currentClient()]);
  if (client && !conversation.customerId) {
    await db.conversation.update({ where: { id: conversationId }, data: { customerId: client.id } }).catch(() => null);
  }
  const system = {
    stable: STABLE_PROMPT,
    dynamic: dynamicPrompt({
      now,
      timeZone: rules.timeZone,
      bookingOpen: open,
      pageLocale: input.locale,
      name: agent.name,
      ownerNotes: agent.notes,
      page: input.page ?? null,
      client: client ? await clientSummary(client.id, client.name, client.artistName) : null,
    }),
  };

  const rows = (await db.message.findMany({ where: { conversationId, role: { not: "card" } }, orderBy: { seq: "desc" }, take: 80 })).reverse();
  const messages = toApiMessages(recentWindow(rows.map((r) => ({ role: r.role, content: r.content as unknown as Block[] })), HISTORY_USER_TURNS));

  const texts: string[] = [];
  const cards: AgentCard[] = [];
  const ctx = { locale: input.locale, conversationId, ip: input.ip, now };

  try {
    let finished = false;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await model.complete({ system, messages, tools: TOOL_DEFS });
      await addRow(conversationId, "assistant", res.content);
      messages.push({ role: "assistant", content: res.content });
      for (const b of res.content) if (b.type === "text" && b.text.trim()) texts.push(b.text.trim());

      const calls = res.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
      if (calls.length === 0) {
        finished = true;
        break;
      }
      const results: ToolResultBlock[] = [];
      for (const call of calls) {
        const out = await runTool(call.name, call.input, ctx);
        if (out.card) cards.push(out.card);
        results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out.result ?? null), ...(out.isError ? { is_error: true } : {}) });
      }
      await addRow(conversationId, "tool", results);
      messages.push({ role: "user", content: results });
    }
    if (!finished) {
      const t = await getTranslations({ locale: input.locale, namespace: "agent" });
      const fallback = t("fallback");
      await addRow(conversationId, "assistant", [{ type: "text", text: fallback }]);
      texts.push(fallback);
    }
  } catch (e) {
    console.error("[agent] model call failed", e);
    if (cards.length === 0) return { ok: false, error: "MODEL_ERROR", conversationId };
  }

  // When the assistant only looked up the catalogue on the way to a quote or a
  // proposal, the specific card is what matters: skip the full price list.
  const specific = cards.some((c) => c.kind === "quote" || c.kind === "slots" || c.kind === "proposal");
  if (specific) cards.splice(0, cards.length, ...cards.filter((c) => c.kind !== "services"));
  for (const card of cards) await addRow(conversationId, "card", card);
  await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });

  const items: ChatItem[] = [
    ...(texts.length ? [{ type: "text" as const, role: "assistant" as const, text: texts.join("\n\n") }] : []),
    ...cards.map((card) => ({ type: "card" as const, card })),
  ];
  return { ok: true, conversationId, items };
}

/**
 * The visitor pressed Confirm (or Cancel) on a booking proposal. This is the
 * only path that writes a booking from the assistant, and it re-validates
 * everything: price and availability are recomputed inside createBooking.
 */
export async function confirmAction(input: { conversationId: string; actionId: string; decision: "confirm" | "dismiss"; locale: Locale; ip: string }): Promise<ConfirmResponse> {
  if (!isConversationId(input.conversationId) || typeof input.actionId !== "string" || input.actionId.length > 40) return { ok: false, error: "INVALID" };
  if (!(await allowRate(`agent-confirm:${input.ip}`, 10, 10 * 60_000))) return { ok: false, error: "RATE_LIMITED" };

  const now = new Date();
  const t = await getTranslations({ locale: input.locale, namespace: "agent" });
  const action = await db.pendingAction.findFirst({ where: { id: input.actionId, conversationId: input.conversationId } });
  if (!action) return { ok: false, error: "NOT_FOUND" };
  if (action.confirmedAt || action.executedAt) return { ok: false, error: "ALREADY_DONE" };

  if (input.decision === "dismiss") {
    await db.pendingAction.updateMany({
      where: { id: action.id, confirmedAt: null },
      data: { expiresAt: now, summary: json({ ...(action.summary as object), dismissed: true }) },
    });
    const text = t("dismissed");
    await addRow(input.conversationId, "assistant", [{ type: "text", text }]);
    return { ok: true, items: [{ type: "text", role: "assistant", text }] };
  }

  if (action.expiresAt <= now) return { ok: false, error: "EXPIRED" };
  if (!(await bookingOpen())) return { ok: false, error: "BOOKING_CLOSED" };
  const parsed = bookingRequestSchema.safeParse(action.payload);
  if (!parsed.success) return { ok: false, error: "INVALID" };

  // Claim the action atomically so a double click can never book twice.
  const claimed = await db.pendingAction.updateMany({ where: { id: action.id, confirmedAt: null, expiresAt: { gt: now } }, data: { confirmedAt: now } });
  if (claimed.count !== 1) return { ok: false, error: "ALREADY_DONE" };

  const result = await createBooking(parsed.data, { source: "AGENT", now });
  if (!result.ok) {
    const text = t(`bookErrors.${result.error}`);
    await db.pendingAction.update({ where: { id: action.id }, data: { executedAt: now, summary: json({ ...(action.summary as object), failed: result.error }) } });
    await addRow(input.conversationId, "assistant", [{ type: "text", text }]);
    return { ok: false, error: result.error, items: [{ type: "text", role: "assistant", text }] };
  }

  const channel = await currentChannel();
  if (channel) await db.booking.update({ where: { id: result.bookingId }, data: { channel } }).catch(() => null);
  const booking = await db.booking.findUniqueOrThrow({ where: { id: result.bookingId }, include: { order: true } });
  await db.pendingAction.update({ where: { id: action.id }, data: { executedAt: new Date() } });
  await db.conversation.update({
    where: { id: input.conversationId },
    data: { bookingId: booking.id, customerId: booking.customerId, outcome: "BOOKING", lastMessageAt: new Date() },
  });

  const rules = await getSetting("business_rules");
  const deposit = formatMoney(booking.order?.depositCents ?? 0, "USD", input.locale);
  const holdUntil = booking.holdExpiresAt ? fmtTime(booking.holdExpiresAt, rules.timeZone, input.locale) : null;
  const card: AgentCard = { kind: "booked", code: booking.code, checkoutPath: `/${input.locale}/checkout/${result.orderId}`, deposit, holdUntil };
  const text = holdUntil ? t("booked", { code: booking.code, deposit, time: holdUntil }) : t("bookedNoHold", { code: booking.code });
  await addRow(input.conversationId, "assistant", [{ type: "text", text }]);
  await addRow(input.conversationId, "card", card);
  return { ok: true, items: [{ type: "text", role: "assistant", text }, { type: "card", card }] };
}

/** A short, private summary of a signed-in client's own projects for the assistant. */
async function clientSummary(customerId: string, name: string, artist: string | null): Promise<string> {
  const bookings = await db.booking.findMany({
    where: { customerId },
    include: { items: { include: { service: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const lines = bookings.map((b) => {
    const d = (b.projectDetails ?? {}) as { songTitle?: string };
    return `• ${b.code}: ${b.items.map((i) => i.service.nameEs).join(" + ")}${d.songTitle ? ` («${d.songTitle}»)` : ""}, status ${b.status}`;
  });
  return [`Name: ${name}${artist ? ` (artist: ${artist})` : ""}`, ...(lines.length ? ["Projects:", ...lines] : ["No projects yet."])].join("\n");
}
