"use server";

import { clientIp } from "../auth/admin";
import { allowRate } from "../rate-limit";
import { cancelByClient, startPayment } from "./service";

export type PayActionState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "ok"; message: string }
  | { status: "redirect"; url: string };

const ORDER_ID = /^c[a-z0-9]{20,32}$/;

/**
 * Starts the PayPal checkout for whatever is due on this order. The browser
 * then does a full navigation to the returned URL (PayPal's page).
 */
export async function payNow(orderId: string, locale: "es" | "en", _prev: PayActionState): Promise<PayActionState> {
  if (!ORDER_ID.test(orderId)) return { status: "error", error: "NOT_FOUND" };
  if (!(await allowRate(`pay:${await clientIp()}`, 20, 60 * 60_000))) return { status: "error", error: "RATE_LIMITED" };
  const result = await startPayment(orderId, locale === "en" ? "en" : "es");
  if (!result.ok) return { status: "error", error: result.error };
  return { status: "redirect", url: result.approvalUrl };
}

/** Client self-service cancellation within the allowed window (full refund). */
export async function cancelMyBooking(orderId: string, _prev: PayActionState, fd: FormData): Promise<PayActionState> {
  if (!ORDER_ID.test(orderId)) return { status: "error", error: "NOT_FOUND" };
  if (fd.get("confirm") !== "on") return { status: "error", error: "CONFIRM" };
  if (!(await allowRate(`cancel:${await clientIp()}`, 10, 60 * 60_000))) return { status: "error", error: "RATE_LIMITED" };
  const result = await cancelByClient(orderId);
  if (!result.ok) return { status: "error", error: result.error };
  return { status: "ok", message: "CANCELLED" };
}
