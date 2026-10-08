import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { BookingBadge } from "@/components/admin/BookingBadge";
import { fmtDateTime, fmtDay, fmtMoney } from "@/lib/admin-format";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: { bookings: { include: { items: { include: { service: true } }, order: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!c) notFound();
  const spent = c.bookings.filter((b) => b.order && ["DEPOSIT_PAID", "AWAITING_BALANCE", "PAID_IN_FULL"].includes(b.order.status)).reduce((s, b) => s + (b.order?.totalCents ?? 0), 0);

  return (
    <>
      <PageHeader title={c.name} back={{ href: "/dashboard/clients", label: "Clientes" }} description={c.artistName ?? undefined} />
      <dl className="mb-10 grid gap-6 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ash">Correo</dt>
          <dd>
            <a href={`mailto:${c.email}`} className="underline underline-offset-4">
              {c.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ash">Teléfono</dt>
          <dd>{c.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ash">Idioma</dt>
          <dd>{c.locale === "es" ? "Español" : "Inglés"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ash">Proyectos confirmados</dt>
          <dd className="num">{fmtMoney(spent)}</dd>
        </div>
      </dl>
      <h2 className="type-sub mb-3 text-xl">Reservas</h2>
      <ul className="divide-y divide-rule border-y border-rule">
        {c.bookings.map((b) => (
          <li key={b.id}>
            <Link href={`/dashboard/bookings/${b.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-white/[0.02]">
              <span>
                <span className="num text-sm text-ash">{b.code}</span> {b.items.map((i) => i.service.nameEs).join(" + ")}
                <span className="block text-sm text-ash">{b.bookingMode === "DELIVERY" ? `Entrega: ${fmtDay(b.deliveryDate)}` : `Sesión: ${fmtDateTime(b.startsAt)}`}</span>
              </span>
              <BookingBadge status={b.status} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
