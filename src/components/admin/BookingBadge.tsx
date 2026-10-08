import type { BookingStatus } from "@prisma/client";

const LABEL: Record<BookingStatus, string> = {
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

const TONE: Partial<Record<BookingStatus, string>> = {
  AWAITING_PAYMENT: "border-amber-400/50 text-amber-200",
  PAID: "border-emerald-400/50 text-emerald-200",
  CONFIRMED: "border-emerald-400/50 text-emerald-200",
  IN_PROGRESS: "border-sky-400/50 text-sky-200",
  REVISION: "border-sky-400/50 text-sky-200",
  DELIVERED: "border-bone/50 text-bone",
};

export function BookingBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs ${TONE[status] ?? "border-rule text-ash"}`}>
      {LABEL[status]}
    </span>
  );
}

export const BOOKING_LABEL = LABEL;
