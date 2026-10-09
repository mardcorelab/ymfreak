import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { getSetting } from "@/server/settings";
import { expireStaleHolds } from "@/server/booking/calendar";
import { fromDateColumn } from "@/server/booking/code";
import { formatMoney } from "@/server/domain/money";
import { evaluateClientCancellation } from "@/server/domain/cancellation";
import { amountDue } from "@/server/payments/service";
import { getPaymentProvider } from "@/server/payments";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CancelForm, PayForm } from "@/components/booking/PaymentPanel";
import { signInFromOrder } from "@/server/portal/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: AppLocale; orderId: string }>; searchParams: Promise<{ payment?: string }> };
const RESULTS = ["paid", "pending", "cancelled", "failed", "expired"] as const;

/**
 * The order id is a long random identifier, so the link itself is what gives
 * access to this page (it is only shown to the person who booked).
 */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const { locale, orderId } = await params;
  const { payment: result } = await searchParams;
  setRequestLocale(locale);
  if (!/^c[a-z0-9]{20,32}$/.test(orderId)) notFound();

  const now = new Date();
  await expireStaleHolds(db, now);
  const [t, ta, order, rules, contact] = await Promise.all([
    getTranslations("checkout"),
    getTranslations("account"),
    db.order.findUnique({ where: { id: orderId }, include: { items: true, booking: true, payments: { orderBy: { createdAt: "asc" } } } }),
    getSetting("business_rules"),
    getSetting("contact"),
  ]);
  if (!order?.booking) notFound();
  const b = order.booking;
  const lang = locale === "es" ? "es-DO" : "en-US";
  const money = (c: number) => formatMoney(c, order.currency, locale);
  const fmtDay = (d: Date) =>
    new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${fromDateColumn(d)}T12:00:00Z`));
  const fmtDateTime = (d: Date) =>
    new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: rules.timeZone }).format(d);
  const fmtTime = (d: Date) => new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit", timeZone: rules.timeZone }).format(d);

  const due = amountDue(order);
  const payable = due && getPaymentProvider() !== null;
  const paid = order.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amountCents, 0);
  const refunded = order.payments.filter((p) => p.status === "REFUNDED").reduce((s, p) => s + p.amountCents, 0);
  const deposit = order.payments.find((p) => p.kind === "DEPOSIT" && p.status === "SUCCEEDED" && p.provider !== "manual");
  const cancellation = deposit
    ? evaluateClientCancellation({ status: b.status, depositPaidAt: deposit.paidAt, depositPaidCents: deposit.amountCents, now, rules })
    : null;
  const shownResult = RESULTS.find((r) => r === result);

  const statusText: Partial<Record<typeof b.status, string>> = {
    CONFIRMED: t("confirmed"),
    PAID: t("confirmed"),
    IN_PROGRESS: t("inProgress"),
    REVISION: t("inProgress"),
    DELIVERED: t("delivered"),
    COMPLETED: t("completed"),
    CANCELLED: t("cancelled"),
  };

  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
      <h1 className="type-name text-[clamp(1.9rem,5.2vw,3.6rem)]">{t("title")}</h1>

      {shownResult && (
        <p
          role="status"
          className={`mt-8 rounded-lg px-5 py-4 ${shownResult === "paid" ? "border border-emerald-400/30 bg-emerald-500/10" : "border border-amber-400/40 bg-amber-500/10"}`}
        >
          {t(`result.${shownResult}`)}
        </p>
      )}

      <dl className="mt-10 grid gap-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ash">{t("code")}</dt>
          <dd className="type-figure num mt-1 text-4xl tracking-wide">{b.code}</dd>
        </div>
        <div>
          <dt className="sr-only">{t("title")}</dt>
          <dd className="mt-1 inline-flex rounded-full border border-rule px-4 py-2 text-sm" data-status={b.status}>
            {t(`status.${b.status}`)}
          </dd>
        </div>
      </dl>
      {statusText[b.status] && <p className="mt-6 text-lg">{statusText[b.status]}</p>}
      {b.status === "CANCELLED" && refunded > 0 && <p className="mt-2 text-bone/80">{t("refunded", { amount: money(refunded) })}</p>}

      {b.status === "AWAITING_PAYMENT" && b.holdExpiresAt && <p className="mt-8 text-bone/85">{t("held", { time: fmtTime(b.holdExpiresAt) })}</p>}
      {b.status === "EXPIRED" && (
        <div className="mt-8 rounded-lg border border-amber-400/40 bg-amber-500/10 px-5 py-4">
          <p>{t("expired")}</p>
          <div className="mt-4">
            <ButtonLink href="/book">{t("bookAgain")}</ButtonLink>
          </div>
        </div>
      )}

      {due && (
        <div className="mt-8">
          {payable ? (
            <PayForm
              orderId={order.id}
              locale={locale}
              label={due.kind === "DEPOSIT" ? t("payDeposit") : t("payBalance")}
              amount={money(due.amountCents)}
            />
          ) : (
            <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-5 py-4">{t("errors.NOT_CONFIGURED")}</p>
          )}
        </div>
      )}

      <div className="mt-10 rounded-lg border border-rule p-6">
        <dl className="grid gap-3">
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-4">
              <dt>
                {i.nameSnapshot} <span className="num text-ash">× {i.quantity}</span>
              </dt>
              <dd className="num">{money(i.unitPriceCents * i.quantity)}</dd>
            </div>
          ))}
          {b.deliveryDate && (
            <div className="flex justify-between gap-4 border-t border-rule pt-3">
              <dt className="text-ash">{t("delivery")}</dt>
              <dd className="first-letter:uppercase">{fmtDay(b.deliveryDate)}</dd>
            </div>
          )}
          {b.startsAt && (
            <div className="flex justify-between gap-4 border-t border-rule pt-3">
              <dt className="text-ash">{t("session")}</dt>
              <dd className="text-right first-letter:uppercase">{fmtDateTime(b.startsAt)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-3">
            <dt className="font-semibold">Total</dt>
            <dd className="type-figure num text-3xl">{money(order.totalCents)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-ash">{t("paidLabel")}</dt>
            <dd className="num">{money(paid)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-ash">{t("dueLabel")}</dt>
            <dd className="num">{money(["CANCELLED", "EXPIRED"].includes(b.status) ? 0 : Math.max(0, order.totalCents - paid))}</dd>
          </div>
        </dl>
      </div>

      {["CONFIRMED", "PAID", "IN_PROGRESS"].includes(b.status) && (
        <div className="mt-10 grid gap-3 text-bone/85">
          <h2 className="type-sub text-2xl">{t("next")}</h2>
          {b.bookingMode === "DELIVERY" && contact.email && (
            <p>
              {t("sendFiles", { email: contact.email })}{" "}
              <Link href="/faq" className="underline underline-offset-4">
                {t("filesInfo")}
              </Link>
            </p>
          )}
          <p className="text-ash">{t("saveLink")}</p>
        </div>
      )}

      {!["EXPIRED"].includes(b.status) && (
        <form action={signInFromOrder} className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-rule p-5">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="locale" value={locale} />
          <p className="max-w-[44ch] text-sm text-bone/80">{ta("fromCheckoutHint")}</p>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-full border border-bone/40 px-5 text-sm hover:bg-bone/5">
            {ta("fromCheckout")}
          </button>
        </form>
      )}

      {cancellation?.allowed && cancellation.deadline && (
        <div className="mt-10">
          <CancelForm orderId={order.id} text={t("cancelText", { deadline: fmtDateTime(cancellation.deadline), amount: money(cancellation.refundCents) })} />
        </div>
      )}
    </section>
  );
}
