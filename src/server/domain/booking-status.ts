/**
 * Booking lifecycle. Every status change in the app goes through
 * `assertTransition`, and every accepted change is written to the booking's
 * event history by the data layer.
 *
 * Payment model: 50 % deposit to book, 50 % balance on delivery.
 *  - AWAITING_PAYMENT → PAID happens when the deposit is captured.
 *  - Final files are released and the booking can be COMPLETED only once the
 *    balance has been paid.
 */

export const BOOKING_STATUSES = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "IN_PROGRESS",
  "DELIVERED",
  "REVISION",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type Actor = "system" | "admin" | "client";

interface TransitionRule {
  to: BookingStatus;
  actors: readonly Actor[];
}

const TRANSITIONS: Record<BookingStatus, readonly TransitionRule[]> = {
  PENDING: [
    { to: "AWAITING_PAYMENT", actors: ["system"] },
    { to: "CANCELLED", actors: ["client", "admin", "system"] },
    { to: "EXPIRED", actors: ["system"] },
  ],
  AWAITING_PAYMENT: [
    { to: "PAID", actors: ["system"] },
    { to: "CANCELLED", actors: ["client", "admin", "system"] },
    { to: "EXPIRED", actors: ["system"] },
  ],
  PAID: [
    { to: "CONFIRMED", actors: ["system", "admin"] },
    { to: "CANCELLED", actors: ["client", "admin"] },
  ],
  CONFIRMED: [
    { to: "IN_PROGRESS", actors: ["admin"] },
    { to: "CANCELLED", actors: ["client", "admin"] },
  ],
  IN_PROGRESS: [
    { to: "DELIVERED", actors: ["admin"] },
    { to: "CANCELLED", actors: ["client", "admin"] },
  ],
  DELIVERED: [
    { to: "REVISION", actors: ["client", "admin"] },
    { to: "COMPLETED", actors: ["admin", "system"] },
  ],
  REVISION: [{ to: "DELIVERED", actors: ["admin"] }],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export interface TransitionContext {
  actor: Actor;
  /** True once the 50 % balance has been captured. */
  balancePaid: boolean;
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: "NOT_ALLOWED" | "ACTOR_NOT_ALLOWED" | "BALANCE_UNPAID" };

export function checkTransition(from: BookingStatus, to: BookingStatus, ctx: TransitionContext): TransitionResult {
  const rule = TRANSITIONS[from].find((r) => r.to === to);
  if (!rule) return { ok: false, reason: "NOT_ALLOWED" };
  if (!rule.actors.includes(ctx.actor)) return { ok: false, reason: "ACTOR_NOT_ALLOWED" };
  if (to === "COMPLETED" && !ctx.balancePaid) return { ok: false, reason: "BALANCE_UNPAID" };
  return { ok: true };
}

export class BookingTransitionError extends Error {
  constructor(
    public readonly from: BookingStatus,
    public readonly to: BookingStatus,
    public readonly reason: Exclude<TransitionResult, { ok: true }>["reason"],
  ) {
    super(`Cannot move booking from ${from} to ${to}: ${reason}`);
    this.name = "BookingTransitionError";
  }
}

export function assertTransition(from: BookingStatus, to: BookingStatus, ctx: TransitionContext): void {
  const result = checkTransition(from, to, ctx);
  if (!result.ok) throw new BookingTransitionError(from, to, result.reason);
}

export function nextStatuses(from: BookingStatus, actor: Actor): BookingStatus[] {
  return TRANSITIONS[from].filter((r) => r.actors.includes(actor)).map((r) => r.to);
}

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Statuses whose capacity counts as taken in the calendar. */
export const CAPACITY_HOLDING_STATUSES: readonly BookingStatus[] = [
  "AWAITING_PAYMENT", // only while its hold has not expired; the data layer filters by holdExpiresAt
  "PAID",
  "CONFIRMED",
  "IN_PROGRESS",
  "DELIVERED",
  "REVISION",
];
