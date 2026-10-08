/**
 * Shapes shared by the assistant's server code and the chat widget.
 * Cards are built on the server from tool results (never from the model's
 * text), already localised, so the widget only lays them out.
 */

export interface CardRow {
  label: string;
  value: string;
}

export type AgentCard =
  | {
      kind: "services";
      items: { slug: string; name: string; price: string; unit: string; detail: string }[];
    }
  | {
      kind: "quote";
      lines: { name: string; quantity: number; amount: string }[];
      total: string;
      deposit: string;
      balance: string;
      depositPercent: number;
      startDate: string;
      deliveryDate: string;
      requested: { date: string; feasible: boolean } | null;
    }
  | {
      kind: "slots";
      serviceName: string;
      dateLabel: string;
      timeZone: string;
      slots: { iso: string; label: string }[];
    }
  | {
      kind: "proposal";
      actionId: string;
      title: string;
      rows: CardRow[];
      total: string;
      deposit: string;
      expiresAt: string;
      state: "open" | "confirmed" | "dismissed" | "expired";
    }
  | {
      kind: "booked";
      code: string;
      checkoutPath: string;
      deposit: string;
      holdUntil: string | null;
    }
  | {
      kind: "status";
      code: string;
      status: string;
      rows: CardRow[];
      checkoutPath: string;
    }
  | {
      kind: "contact";
      email: string;
      instagram: string;
      whatsapp: string;
    };

export type ChatItem =
  | { type: "text"; role: "user" | "assistant"; text: string }
  | { type: "card"; card: AgentCard };

export type ChatError = "NOT_CONFIGURED" | "RATE_LIMITED" | "TOO_LONG" | "CONVERSATION_LIMIT" | "MODEL_ERROR" | "INVALID";

export type ChatResponse =
  | { ok: true; conversationId: string; items: ChatItem[] }
  | { ok: false; error: ChatError; conversationId?: string };

export type ConfirmError = "NOT_FOUND" | "EXPIRED" | "ALREADY_DONE" | "BOOKING_CLOSED" | "RATE_LIMITED" | "INVALID" | string;

export type ConfirmResponse =
  | { ok: true; items: ChatItem[] }
  | { ok: false; error: ConfirmError; items?: ChatItem[] };

/** Limits shared by the widget (to explain them) and the server (to enforce them). */
export const AGENT_LIMITS = {
  messageChars: 2000,
  userMessagesPerConversation: 40,
} as const;
