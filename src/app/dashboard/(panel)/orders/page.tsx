import Link from "next/link";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { fmtDateTime, fmtMoney } from "@/lib/admin-format";

const ORDER_LABEL = {
  AWAITING_DEPOSIT: "Esperando depósito",
  DEPOSIT_PAID: "Depósito pagado",
  AWAITING_BALANCE: "Saldo pendiente",
  PAID_IN_FULL: "Pagado",
  PARTIALLY_REFUNDED: "Reembolso parcial",
  REFUNDED: "Reembolsado",
  CANCELLED: "Cancelado",
} as const;

const PAY_LABEL = { PENDING: "en curso", SUCCEEDED: "pagado", FAILED: "fallido", CANCELLED: "abandonado", EXPIRED: "expirado", REFUNDED: "reembolsado" } as const;

export default async function OrdersAdmin() {
  const [orders, totals] = await Promise.all([
    db.order.findMany({
      include: { customer: true, booking: true, payments: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true } }),
  ]);
  const online = orders.flatMap((o) => o.payments).filter((p) => p.status === "SUCCEEDED" && p.provider !== "manual").reduce((s, p) => s + p.amountCents, 0);

  return (
    <>
      <PageHeader title="Pagos" description="Cada reserva tiene un pedido con su depósito y su saldo. Los pagos en línea se registran solos." />
      <dl className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-rule p-4">
          <dt className="text-sm text-ash">Cobrado en total</dt>
          <dd className="type-head num mt-1 text-3xl">{fmtMoney(totals._sum.amountCents ?? 0)}</dd>
        </div>
        <div className="rounded-lg border border-rule p-4">
          <dt className="text-sm text-ash">De eso, en línea por PayPal</dt>
          <dd className="type-head num mt-1 text-3xl">{fmtMoney(online)}</dd>
        </div>
      </dl>
      {orders.length === 0 ? (
        <p className="text-ash">Todavía no hay pedidos.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {orders.map((o) => (
            <li key={o.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
              <div className="min-w-0">
                <p className="truncate">
                  {o.booking ? (
                    <Link href={`/dashboard/bookings/${o.booking.id}`} className="font-medium underline-offset-4 hover:underline">
                      {o.booking.code}
                    </Link>
                  ) : (
                    "—"
                  )}{" "}
                  <span className="text-ash">{o.customer.name}</span>
                </p>
                <ul className="mt-1 text-xs text-ash">
                  {o.payments.map((p) => (
                    <li key={p.id}>
                      {fmtDateTime(p.createdAt)}. {p.kind === "DEPOSIT" ? "Depósito" : p.kind === "BALANCE" ? "Saldo" : "Revisión"} {fmtMoney(p.amountCents)},{" "}
                      {p.provider === "manual" ? "fuera de la web" : p.provider === "paypal" ? "PayPal" : p.provider}, {PAY_LABEL[p.status]}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-right">
                <p className="num">{fmtMoney(o.totalCents)}</p>
                <p className="text-xs text-ash">{ORDER_LABEL[o.status]}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
