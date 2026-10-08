import "server-only";
import type { Booking, Order, Payment, Prisma } from "@prisma/client";
import { db } from "../db";
import { getSetting } from "../settings";
import { siteUrl } from "@/lib/seo";
import { checkTransition, type Actor } from "../domain/booking-status";
import { evaluateClientCancellation } from "../domain/cancellation";
import { expireStaleHolds } from "../booking/calendar";
import { getPaymentProvider } from "./index";
import { PaymentProviderError, type CaptureResult, type PaymentKind, type ProviderEvent } from "./provider";

export type PayError =
  | "NOT_CONFIGURED"
  | "NOT_FOUND"
  | "NOTHING_DUE"
  | "HOLD_EXPIRED"
  | "NOT_READY"
  | "PROVIDER_ERROR"
  | "DECLINED"
  | "WINDOW_CLOSED"
  | "NOT_REFUNDABLE";

type OrderWithAll = Order & { booking: Booking | null; payments: Payment[] };

async function loadOrder(orderId: string): Promise<OrderWithAll | null> {
  return db.order.findUnique({ where: { id: orderId }, include: { booking: true, payments: true } });
}

function paidCents(order: OrderWithAll): number {
  return order.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amountCents, 0);
}

/** What the client can pay right now on this order, if anything. */
export function amountDue(order: OrderWithAll): { kind: PaymentKind; amountCents: number } | null {
  const b = order.booking;
  if (!b) return null;
  if (order.status === "AWAITING_DEPOSIT" && b.status === "AWAITING_PAYMENT") return { kind: "DEPOSIT", amountCents: order.depositCents };
  if ((order.status === "DEPOSIT_PAID" || order.status === "AWAITING_BALANCE") && (b.status === "DELIVERED" || b.status === "REVISION")) {
    const due = order.totalCents - paidCents(order);
    return due > 0 ? { kind: "BALANCE", amountCents: due } : null;
  }
  return null;
}

/**
 * Creates a provider checkout for what is due on the order and returns the
 * URL where the client approves it. The payment is linked to this order only.
 */
export async function startPayment(
  orderId: string,
  locale: "es" | "en",
  origin: string = siteUrl(),
): Promise<{ ok: true; approvalUrl: string } | { ok: false; error: PayError }> {
  const provider = getPaymentProvider();
  if (!provider) return { ok: false, error: "NOT_CONFIGURED" };
  const now = new Date();
  await expireStaleHolds(db, now);

  const order = await loadOrder(orderId);
  if (!order?.booking) return { ok: false, error: "NOT_FOUND" };
  if (order.booking.status === "EXPIRED") return { ok: false, error: "HOLD_EXPIRED" };
  const due = amountDue(order);
  if (!due) return { ok: false, error: order.booking.status === "AWAITING_PAYMENT" ? "HOLD_EXPIRED" : "NOTHING_DUE" };

  // Keep the date held while the client is on the provider's page.
  if (due.kind === "DEPOSIT") {
    const { holdMinutes } = await getSetting("booking");
    const until = new Date(now.getTime() + holdMinutes * 60_000);
    if (!order.booking.holdExpiresAt || order.booking.holdExpiresAt < until) {
      await db.booking.update({ where: { id: order.booking.id }, data: { holdExpiresAt: until } });
    }
  }
  // Abandoned earlier attempts for the same amount are superseded.
  await db.payment.updateMany({ where: { orderId, kind: due.kind, status: "PENDING" }, data: { status: "CANCELLED" } });

  const payment = await db.payment.create({
    data: {
      orderId,
      kind: due.kind,
      provider: provider.name,
      providerRef: `pending-${crypto.randomUUID()}`,
      amountCents: due.amountCents,
      status: "PENDING",
    },
  });

  const base = origin.replace(/\/+$/, "");
  const label = due.kind === "DEPOSIT" ? (locale === "es" ? "Depósito" : "Deposit") : locale === "es" ? "Saldo" : "Balance";
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      amountCents: due.amountCents,
      currency: "USD",
      description: `YM Freak · ${label} · ${order.booking.code}`,
      locale,
      returnUrl: `${base}/api/payments/return?payment=${payment.id}&l=${locale}`,
      cancelUrl: `${base}/${locale}/checkout/${orderId}?payment=cancelled`,
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: session.providerRef } });
    return { ok: true, approvalUrl: session.approvalUrl };
  } catch (e) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", rawStatus: e instanceof Error ? e.message.slice(0, 200) : "error" } });
    console.error("[payments] createCheckout failed", e instanceof PaymentProviderError ? { status: e.status, details: e.details } : e);
    return { ok: false, error: "PROVIDER_ERROR" };
  }
}

/**
 * Called when the client comes back from the provider (and from the
 * "approved" webhook as a backup): captures the money and confirms the
 * booking. Idempotent — safe if both paths run.
 */
export async function finalizePayment(paymentId: string): Promise<{ ok: true; orderId: string } | { ok: false; orderId: string | null; error: PayError }> {
  const provider = getPaymentProvider();
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { booking: true } } } });
  if (!payment) return { ok: false, orderId: null, error: "NOT_FOUND" };
  const orderId = payment.orderId;
  if (payment.status === "SUCCEEDED") return { ok: true, orderId };
  if (!provider || provider.name !== payment.provider) return { ok: false, orderId, error: "NOT_CONFIGURED" };
  if (payment.status !== "PENDING" || payment.providerRef.startsWith("pending-")) return { ok: false, orderId, error: "NOT_READY" };

  // Never take a deposit for a date that is no longer held.
  const booking = payment.order.booking;
  if (payment.kind === "DEPOSIT" && booking && booking.status !== "AWAITING_PAYMENT") {
    await db.payment.update({ where: { id: paymentId }, data: { status: "CANCELLED", rawStatus: `booking ${booking.status}` } });
    return { ok: false, orderId, error: "HOLD_EXPIRED" };
  }

  let result: CaptureResult;
  try {
    result = await provider.capture(payment.providerRef, `capture-${payment.id}`);
  } catch (e) {
    console.error("[payments] capture failed", e instanceof PaymentProviderError ? { status: e.status, details: e.details } : e);
    return { ok: false, orderId, error: "PROVIDER_ERROR" };
  }
  await applyCapture(paymentId, result);
  if (result.status === "SUCCEEDED") return { ok: true, orderId };
  return { ok: false, orderId, error: result.status === "PENDING" ? "NOT_READY" : "DECLINED" };
}

async function addEvent(tx: Prisma.TransactionClient, booking: Booking, to: Booking["status"], actor: Actor, note: string) {
  await tx.bookingEvent.create({ data: { bookingId: booking.id, from: booking.status, to, actor, note } });
}

/** Applies a capture outcome to payment, order and booking in one transaction. */
export async function applyCapture(paymentId: string, result: CaptureResult): Promise<void> {
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { booking: true, payments: true } } } });
    if (!payment || payment.status === "SUCCEEDED" || payment.status === "REFUNDED") return;

    if (result.status === "FAILED") {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", rawStatus: result.rawStatus } });
      return;
    }
    if (result.status === "PENDING") {
      await tx.payment.update({ where: { id: paymentId }, data: { rawStatus: result.rawStatus, ...(result.captureRef ? { captureRef: result.captureRef } : {}) } });
      return;
    }
    if (result.amountCents !== undefined && result.amountCents !== payment.amountCents) {
      // Should never happen; flag it for a human instead of confirming.
      await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", rawStatus: `AMOUNT_MISMATCH ${result.amountCents}` } });
      console.error("[payments] amount mismatch", { paymentId, expected: payment.amountCents, got: result.amountCents });
      return;
    }

    const now = new Date();
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "SUCCEEDED", paidAt: now, rawStatus: result.rawStatus, ...(result.captureRef ? { captureRef: result.captureRef } : {}) },
    });

    const order = payment.order;
    const booking = order.booking;
    const paid = order.payments.filter((p) => p.status === "SUCCEEDED" && p.id !== paymentId).reduce((s, p) => s + p.amountCents, 0) + payment.amountCents;

    if (payment.kind === "DEPOSIT") {
      if (booking) await tx.conversation.updateMany({ where: { bookingId: booking.id }, data: { outcome: "PAID" } });
      await tx.order.update({ where: { id: order.id }, data: { status: paid >= order.totalCents ? "PAID_IN_FULL" : "DEPOSIT_PAID" } });
      if (booking && booking.status === "AWAITING_PAYMENT") {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", holdExpiresAt: null } });
        await addEvent(tx, booking, "PAID", "system", "Depósito pagado en línea");
        await tx.bookingEvent.create({ data: { bookingId: booking.id, from: "PAID", to: "CONFIRMED", actor: "system", note: "Confirmada automáticamente" } });
      } else if (booking) {
        await tx.bookingEvent.create({
          data: { bookingId: booking.id, from: booking.status, to: booking.status, actor: "system", note: "Depósito recibido con la reserva ya cerrada: revisar y reembolsar si corresponde" },
        });
      }
    } else {
      await tx.order.update({ where: { id: order.id }, data: { status: paid >= order.totalCents ? "PAID_IN_FULL" : "AWAITING_BALANCE" } });
      if (booking && paid >= order.totalCents && checkTransition(booking.status, "COMPLETED", { actor: "system", balancePaid: true }).ok) {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" } });
        await addEvent(tx, booking, "COMPLETED", "system", "Saldo pagado en línea");
      } else if (booking) {
        await tx.bookingEvent.create({ data: { bookingId: booking.id, from: booking.status, to: booking.status, actor: "system", note: "Saldo pagado en línea" } });
      }
    }
  });
}

/** Refunds every online payment of an order through the provider. Manual payments are not touched. */
async function refundOnlinePayments(order: OrderWithAll): Promise<{ ok: true; refundedCents: number } | { ok: false; error: PayError }> {
  const provider = getPaymentProvider();
  const online = order.payments.filter((p) => p.status === "SUCCEEDED" && p.provider !== "manual");
  if (online.length === 0) return { ok: true, refundedCents: 0 };
  if (!provider) return { ok: false, error: "NOT_CONFIGURED" };
  let refunded = 0;
  for (const p of online) {
    if (!p.captureRef || p.provider !== provider.name) return { ok: false, error: "NOT_REFUNDABLE" };
    try {
      await provider.refund(p.captureRef, p.amountCents, `refund-${p.id}`);
    } catch (e) {
      console.error("[payments] refund failed", e instanceof PaymentProviderError ? { status: e.status, details: e.details } : e);
      return { ok: false, error: "PROVIDER_ERROR" };
    }
    await db.payment.update({ where: { id: p.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
    refunded += p.amountCents;
  }
  return { ok: true, refundedCents: refunded };
}

/** Client self-service: cancel within the window after paying the deposit, with a full refund. */
export async function cancelByClient(orderId: string): Promise<{ ok: true; refundedCents: number } | { ok: false; error: PayError }> {
  await expireStaleHolds(db, new Date());
  const order = await loadOrder(orderId);
  const booking = order?.booking;
  if (!order || !booking) return { ok: false, error: "NOT_FOUND" };

  const rules = await getSetting("business_rules");
  const deposit = order.payments.find((p) => p.kind === "DEPOSIT" && p.status === "SUCCEEDED");
  const decision = evaluateClientCancellation({
    status: booking.status,
    depositPaidAt: deposit?.paidAt ?? null,
    depositPaidCents: deposit?.amountCents ?? 0,
    now: new Date(),
    rules,
  });
  if (!decision.allowed) return { ok: false, error: "WINDOW_CLOSED" };
  if (!checkTransition(booking.status, "CANCELLED", { actor: "client", balancePaid: false }).ok) return { ok: false, error: "WINDOW_CLOSED" };

  const refund = await refundOnlinePayments(order);
  if (!refund.ok) return refund;
  await db.$transaction([
    db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", holdExpiresAt: null } }),
    db.order.update({ where: { id: order.id }, data: { status: refund.refundedCents > 0 ? "REFUNDED" : "CANCELLED" } }),
    db.bookingEvent.create({
      data: { bookingId: booking.id, from: booking.status, to: "CANCELLED", actor: "client", note: refund.refundedCents > 0 ? "Cancelada por el cliente con reembolso" : "Cancelada por el cliente" },
    }),
  ]);
  return { ok: true, refundedCents: refund.refundedCents };
}

/** Admin: cancel a booking and refund what was paid online. */
export async function cancelByAdminWithRefund(bookingId: string): Promise<{ ok: true; refundedCents: number } | { ok: false; error: PayError | "NOT_ALLOWED" }> {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking?.orderId) return { ok: false, error: "NOT_FOUND" };
  if (!checkTransition(booking.status, "CANCELLED", { actor: "admin", balancePaid: false }).ok) return { ok: false, error: "NOT_ALLOWED" };
  const order = await loadOrder(booking.orderId);
  if (!order) return { ok: false, error: "NOT_FOUND" };
  const refund = await refundOnlinePayments(order);
  if (!refund.ok) return refund;
  await db.$transaction([
    db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", holdExpiresAt: null } }),
    db.order.update({ where: { id: order.id }, data: { status: refund.refundedCents > 0 ? "REFUNDED" : "CANCELLED" } }),
    db.bookingEvent.create({
      data: { bookingId: booking.id, from: booking.status, to: "CANCELLED", actor: "admin", note: `Cancelada con reembolso de ${(refund.refundedCents / 100).toFixed(2)} USD` },
    }),
  ]);
  return { ok: true, refundedCents: refund.refundedCents };
}

/** Webhook entry point: verified events only, each processed exactly once. */
export async function handleProviderEvent(event: ProviderEvent, providerName: string): Promise<void> {
  const fresh = await db.webhookEvent
    .create({ data: { id: event.eventId, provider: providerName, type: event.kind } })
    .then(() => true)
    .catch(() => false);
  if (!fresh) return;

  switch (event.kind) {
    case "APPROVED": {
      const payment = await db.payment.findUnique({ where: { providerRef: event.providerRef } });
      if (payment) await finalizePayment(payment.id);
      return;
    }
    case "CAPTURE_COMPLETED": {
      const payment =
        (event.paymentId ? await db.payment.findUnique({ where: { id: event.paymentId } }) : null) ??
        (event.providerRef ? await db.payment.findUnique({ where: { providerRef: event.providerRef } }) : null);
      if (payment) {
        await applyCapture(payment.id, {
          status: "SUCCEEDED",
          captureRef: event.captureRef,
          rawStatus: "COMPLETED",
          ...(Number.isNaN(event.amountCents) ? {} : { amountCents: event.amountCents }),
        });
      }
      return;
    }
    case "CAPTURE_FAILED": {
      const payment =
        (event.paymentId ? await db.payment.findUnique({ where: { id: event.paymentId } }) : null) ??
        (await db.payment.findUnique({ where: { captureRef: event.captureRef } }));
      if (payment) await applyCapture(payment.id, { status: "FAILED", rawStatus: event.rawStatus });
      return;
    }
    case "CAPTURE_REFUNDED": {
      const payment =
        (event.captureRef ? await db.payment.findUnique({ where: { captureRef: event.captureRef } }) : null) ??
        (event.paymentId ? await db.payment.findUnique({ where: { id: event.paymentId } }) : null);
      if (payment && payment.status === "SUCCEEDED") {
        await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
      }
      return;
    }
    default:
      return;
  }
}
