import "server-only";
import type { BookingStatus } from "@prisma/client";
import { db } from "../db";
import { checkTransition } from "../domain/booking-status";
import { revisionCharge } from "../domain/pricing";
import { parseSetting } from "../settings/schemas";

export type OpResult = { ok: true; message: string } | { ok: false; message: string };

const STATUS_ES: Record<BookingStatus, string> = {
  PENDING: "Pendiente",
  AWAITING_PAYMENT: "Esperando pago",
  PAID: "Depósito pagado",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En proceso",
  DELIVERED: "Entregada",
  REVISION: "En revisión",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};
export const statusLabel = (s: BookingStatus) => STATUS_ES[s];

export type TransitionOutcome =
  | { ok: true; from: BookingStatus; feeNote: string | null }
  | { ok: false; reason: "NOT_FOUND" | "NOT_ALLOWED" | "ACTOR_NOT_ALLOWED" | "BALANCE_UNPAID"; from?: BookingStatus };

/**
 * Moves a booking to another status. Every rule lives in the domain state
 * machine; this only loads data, adds the extra-revision fee when it applies
 * and records the event. Used by the dashboard (admin) and the client portal
 * (client asking for a revision).
 */
export async function transitionBookingAs(
  actor: "admin" | "client",
  bookingId: string,
  to: BookingStatus,
  note?: string | null,
): Promise<TransitionOutcome> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { order: true, items: { include: { service: true } } } });
  if (!booking) return { ok: false, reason: "NOT_FOUND" };

  const balancePaid = booking.order?.status === "PAID_IN_FULL";
  const check = checkTransition(booking.status, to, { actor, balancePaid });
  if (!check.ok) return { ok: false, reason: check.reason, from: booking.status };

  // Optimistic check: only move it if nobody changed the status meanwhile.
  const moved = await db.booking.updateMany({
    where: { id: bookingId, status: booking.status },
    data: {
      status: to,
      ...(to === "REVISION" ? { revisionsUsed: { increment: 1 } } : {}),
      ...(to === "CANCELLED" ? { holdExpiresAt: null } : {}),
    },
  });
  if (moved.count !== 1) return { ok: false, reason: "NOT_ALLOWED", from: booking.status };

  // Third and later revisions add a fee line to the order.
  let feeNote: string | null = null;
  if (to === "REVISION" && booking.order) {
    const revisionNumber = booking.revisionsUsed + 1;
    const included = Math.min(...booking.items.map((i) => i.service.revisionsIncluded));
    const rulesRow = await db.setting.findUnique({ where: { key: "business_rules" } });
    const rules = rulesRow ? parseSetting("business_rules", rulesRow.value) : null;
    const charge = revisionCharge(revisionNumber, Number.isFinite(included) ? included : 0, { revisionFeeCents: rules?.revisionFeeCents ?? 0 });
    if (charge.billable && charge.amountCents > 0) {
      feeNote = `Revisión #${revisionNumber}: se añadió el cargo de revisión adicional al pedido.`;
      await db.order.update({
        where: { id: booking.order.id },
        data: {
          totalCents: { increment: charge.amountCents },
          balanceCents: { increment: charge.amountCents },
          ...(booking.order.status === "PAID_IN_FULL" ? { status: "AWAITING_BALANCE" } : {}),
          items: { create: { nameSnapshot: `Revisión adicional #${revisionNumber}`, unitPriceCents: charge.amountCents, quantity: 1 } },
        },
      });
    }
  }

  if (to === "CANCELLED" && booking.order && ["AWAITING_DEPOSIT"].includes(booking.order.status)) {
    await db.order.update({ where: { id: booking.order.id }, data: { status: "CANCELLED" } });
  }
  await db.bookingEvent.create({
    data: { bookingId, from: booking.status, to, actor, note: [note, feeNote].filter(Boolean).join(" ") || null },
  });
  return { ok: true, from: booking.status, feeNote };
}

/** Moves a booking to another status as the admin, with a message for the dashboard. */
export async function transitionAsAdmin(bookingId: string, to: BookingStatus, note?: string): Promise<OpResult> {
  const r = await transitionBookingAs("admin", bookingId, to, note);
  if (r.ok) return { ok: true, message: `Reserva marcada como «${STATUS_ES[to]}».${r.feeNote ? ` ${r.feeNote}` : ""}` };
  if (r.reason === "NOT_FOUND") return { ok: false, message: "Esta reserva ya no existe." };
  if (r.reason === "BALANCE_UNPAID") return { ok: false, message: "No se puede completar: falta registrar el pago del saldo." };
  return { ok: false, message: `No se puede pasar de «${r.from ? STATUS_ES[r.from] : "?"}» a «${STATUS_ES[to]}».` };
}

/** Records the balance as paid outside the website (cash, transfer, PayPal link…). */
export async function markBalancePaidManually(bookingId: string): Promise<OpResult> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { order: true } });
  if (!booking?.order) return { ok: false, message: "Esta reserva no tiene pedido." };
  if (booking.order.status === "PAID_IN_FULL") return { ok: false, message: "El saldo ya estaba registrado como pagado." };
  const paidSoFar = await db.payment.aggregate({ where: { orderId: booking.order.id, status: "SUCCEEDED" }, _sum: { amountCents: true } });
  const remaining = booking.order.totalCents - (paidSoFar._sum.amountCents ?? 0);
  if (remaining > 0) {
    await db.payment.create({
      data: {
        orderId: booking.order.id,
        kind: "BALANCE",
        provider: "manual",
        providerRef: `manual-${crypto.randomUUID()}`,
        amountCents: remaining,
        status: "SUCCEEDED",
        paidAt: new Date(),
      },
    });
  }
  await db.order.update({ where: { id: booking.order.id }, data: { status: "PAID_IN_FULL" } });
  await db.bookingEvent.create({ data: { bookingId, from: booking.status, to: booking.status, actor: "admin", note: "Saldo registrado como pagado fuera de la web" } });
  return { ok: true, message: "Saldo registrado como pagado." };
}
