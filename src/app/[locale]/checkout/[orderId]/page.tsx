import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { db } from "@/server/db";
import { getSetting } from "@/server/settings";
import { expireStaleHolds } from "@/server/booking/calendar";
import { fromDateColumn } from "@/server/booking/code";
import { formatMoney } from "@/server/domain/money";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: AppLocale; orderId: string }> };

/**
 * The order id is a long random identifier, so the link itself is what gives
 * access to this summary (it is only shown to the person who booked).
 */
export default async function CheckoutPage({ params }: Props) {
  const { locale, orderId } = await params;
  setRequestLocale(locale);
  if (!/^c[a-z0-9]{20,32}$/.test(orderId)) notFound();

  await expireStaleHolds(db, new Date());
  const [t, order, rules] = await Promise.all([
    getTranslations("checkout"),
    db.order.findUnique({ where: { id: orderId }, include: { items: true, booking: true } }),
    getSetting("business_rules"),
  ]);
  if (!order?.booking) notFound();
  const b = order.booking;
  const money = (c: number) => formatMoney(c, order.currency, locale);
  const fmtDay = (d: Date) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${fromDateColumn(d)}T12:00:00Z`),
    );
  const fmtDateTime = (d: Date) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: rules.timeZone,
    }).format(d);
  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: rules.timeZone }).format(d);

  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
      <h1 className="type-name text-[clamp(3.4rem,8vw,6rem)] leading-[0.95]">{t("title")}</h1>

      <dl className="mt-10 grid gap-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ash">{t("code")}</dt>
          <dd className="type-head num mt-1 text-4xl tracking-wide">{b.code}</dd>
        </div>
        <div>
          <dt className="sr-only">{t("title")}</dt>
          <dd className="mt-1 inline-flex rounded-full border border-rule px-4 py-2 text-sm" data-status={b.status}>
            {t(`status.${b.status}`)}
          </dd>
        </div>
      </dl>

      {b.status === "AWAITING_PAYMENT" && b.holdExpiresAt && (
        <p className="mt-8 rounded-lg bg-key px-5 py-4">{t("held", { time: fmtTime(b.holdExpiresAt) })}</p>
      )}
      {b.status === "EXPIRED" && (
        <div className="mt-8 rounded-lg border border-amber-400/40 bg-amber-500/10 px-5 py-4">
          <p>{t("expired")}</p>
          <div className="mt-4">
            <ButtonLink href="/book">{t("bookAgain")}</ButtonLink>
          </div>
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
            <dd className="type-head num text-3xl">{money(order.totalCents)}</dd>
          </div>
        </dl>
      </div>

      {b.status === "AWAITING_PAYMENT" && <p className="mt-8 text-ash">{t("paymentSoon")}</p>}
    </section>
  );
}
