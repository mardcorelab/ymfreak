/**
 * Client self-service cancellation policy:
 *  - Before the deposit is paid, the client can cancel freely (nothing to refund).
 *  - Within `cancellationWindowHours` of paying the deposit, the client can
 *    cancel and gets the full deposit back.
 *  - After the window, self-service cancellation is closed; the client is
 *    pointed to YM Freak, who can still cancel manually from the dashboard.
 */
import type { BookingStatus } from "./booking-status";
import type { BusinessRules } from "./types";

export type CancellationDecision =
  | { allowed: true; refundCents: number; deadline: Date | null }
  | { allowed: false; reason: "ALREADY_FINAL" | "WINDOW_CLOSED" | "WORK_DELIVERED"; deadline: Date | null };

const UNPAID: readonly BookingStatus[] = ["PENDING", "AWAITING_PAYMENT"];
const PAID_CANCELLABLE: readonly BookingStatus[] = ["PAID", "CONFIRMED", "IN_PROGRESS"];

export function evaluateClientCancellation(params: {
  status: BookingStatus;
  depositPaidAt: Date | null;
  depositPaidCents: number;
  now: Date;
  rules: Pick<BusinessRules, "cancellationWindowHours">;
}): CancellationDecision {
  const { status, depositPaidAt, depositPaidCents, now, rules } = params;

  if (UNPAID.includes(status)) return { allowed: true, refundCents: 0, deadline: null };

  if (!PAID_CANCELLABLE.includes(status)) {
    const reason = status === "DELIVERED" || status === "REVISION" ? "WORK_DELIVERED" : "ALREADY_FINAL";
    return { allowed: false, reason, deadline: null };
  }

  if (!depositPaidAt) {
    // A paid status without a payment date is a data error; fail closed.
    return { allowed: false, reason: "WINDOW_CLOSED", deadline: null };
  }

  const deadline = new Date(depositPaidAt.getTime() + rules.cancellationWindowHours * 3_600_000);
  if (now > deadline) return { allowed: false, reason: "WINDOW_CLOSED", deadline };
  return { allowed: true, refundCents: depositPaidCents, deadline };
}
