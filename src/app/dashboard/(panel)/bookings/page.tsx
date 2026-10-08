import Link from "next/link";
import type { BookingStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { expireStaleHolds } from "@/server/booking/calendar";
import { NewLink, PageHeader } from "@/components/admin/PageHeader";
import { BookingBadge } from "@/components/admin/BookingBadge";
import { fmtDateTime, fmtDay, fmtMoney } from "@/lib/admin-format";

const FILTERS: { key: string; label: string; where: Prisma.BookingWhereInput }[] = [
  { key: "active", label: "Activas", where: { status: { in: ["AWAITING_PAYMENT", "PAID", "CONFIRMED", "IN_PROGRESS", "DELIVERED", "REVISION"] } } },
  { key: "pending", label: "Esperando pago", where: { status: "AWAITING_PAYMENT" } },
  { key: "done", label: "Completadas", where: { status: "COMPLETED" } },
  { key: "closed", label: "Canceladas y expiradas", where: { status: { in: ["CANCELLED", "EXPIRED"] as BookingStatus[] } } },
  { key: "all", label: "Todas", where: {} },
];

export default async function BookingsAdmin({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "active" } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0]!;
  await expireStaleHolds(db, new Date());
  const bookings = await db.booking.findMany({
    where: filter.where,
    include: { customer: true, order: true, items: { include: { service: true } } },
    orderBy: [{ deliveryDate: "asc" }, { startsAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Reservas"
        description="Ordenadas por fecha de entrega o de sesión."
        actions={<NewLink href="/dashboard/bookings/new" label="Reserva manual" />}
      />
      <nav aria-label="Filtro" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`/dashboard/bookings?f=${x.key}`}
            aria-current={x.key === filter.key ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm ${x.key === filter.key ? "border-bone bg-bone text-studio" : "border-rule text-bone/80 hover:border-bone/40"}`}
          >
            {x.label}
          </Link>
        ))}
      </nav>
      {bookings.length === 0 ? (
        <p className="text-ash">No hay reservas en esta vista.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/bookings/${b.id}`} className="grid gap-2 py-4 hover:bg-white/[0.02] sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                <span className="num text-sm tracking-wide text-ash">{b.code}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {b.items.map((i) => i.service.nameEs).join(" + ")} <span className="num text-ash">× {b.quantity}</span>
                  </span>
                  <span className="block truncate text-sm text-ash">
                    {b.customer.name}
                    {b.bookingMode === "DELIVERY" ? `. Entrega: ${fmtDay(b.deliveryDate)}` : `. Sesión: ${fmtDateTime(b.startsAt)}`}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {b.order && <span className="num text-sm text-ash">{fmtMoney(b.order.totalCents)}</span>}
                  <BookingBadge status={b.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
