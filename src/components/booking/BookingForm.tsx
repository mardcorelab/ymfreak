"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { BusinessHoursVM, ServiceVM } from "@/lib/view-models";
import { formatMoney } from "@/server/domain/money";
import { addDays } from "@/server/domain/calendar";
import {
  getDeliveryQuote,
  getSessionAvailability,
  submitBooking,
} from "@/server/booking/public-actions";
import type { DeliveryQuote, QuoteSummary, SessionAvailability } from "@/server/booking/engine";

const input =
  "w-full rounded-md border border-rule bg-studio-deep px-3 py-3 text-base text-bone placeholder:text-ash/60 focus:border-bone/60 focus:outline-none";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-rule pt-8">
      <legend className="float-left mb-6 flex w-full items-baseline gap-4">
        <span className="type-head num text-4xl text-bone/35">{n}</span>
        <span className="type-sub text-2xl">{title}</span>
      </legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-bone/85">{label}</span>
      {children}
      {hint && <span className="text-xs text-ash">{hint}</span>}
    </label>
  );
}

export function BookingForm({
  services,
  business,
  initialService,
  today,
  timeZone,
}: {
  services: ServiceVM[];
  business: BusinessHoursVM;
  initialService: string | null;
  today: string;
  timeZone: string;
}) {
  const t = useTranslations("book");
  const locale = useLocale() as "es" | "en";
  const router = useRouter();

  const [slug, setSlug] = useState(services.some((s) => s.slug === initialService) ? initialService! : (services[0]?.slug ?? ""));
  const service = services.find((s) => s.slug === slug);
  const isSession = service?.bookingMode === "SESSION";
  const [qty, setQty] = useState(1);
  const [needBy, setNeedBy] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [slot, setSlot] = useState("");

  const [delivery, setDelivery] = useState<DeliveryQuote | null>(null);
  const [availability, setAvailability] = useState<SessionAvailability | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", phone: "", artist: "", song: "", reference: "", notes: "", website: "" });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Delivery date: recomputed on the server from the real calendar whenever the choice changes.
  useEffect(() => {
    if (!service || isSession) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await getDeliveryQuote({ services: [service.slug], songs: qty, requestedDeliveryDate: needBy || undefined, locale });
      if (!cancelled) {
        setDelivery(res);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [service, isSession, qty, needBy, locale]);

  // Session slots for the chosen day.
  useEffect(() => {
    setSlot("");
    if (!service || !isSession || !sessionDate) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSessionAvailability({ service: service.slug, hours: qty, date: sessionDate, locale }).then((res) => {
      if (!cancelled) {
        setAvailability(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [service, isSession, qty, sessionDate, locale]);

  const longDate = useMemo(
    () => new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
    [locale],
  );
  const fmtDate = (d: string) => longDate.format(new Date(`${d}T12:00:00Z`));
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
  const tzLabel = locale === "es" ? "hora de República Dominicana" : "Dominican Republic time";

  const quote: QuoteSummary | null = isSession ? (availability?.ok ? availability.quote : null) : delivery?.ok ? delivery.quote : null;
  const money = (c: number) => formatMoney(c, "USD", locale);
  const ready = !!quote && (!isSession || !!slot);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !ready) return;
    setError(null);
    const project = {
      songTitle: form.song,
      artistName: form.artist,
      notes: form.notes,
      referenceLinks: form.reference ? [form.reference] : [],
    };
    const customer = { name: form.name, email: form.email, locale, ...(form.phone ? { phone: form.phone } : {}) };
    const request = isSession
      ? { mode: "SESSION", service: service.slug, hours: qty, startsAt: slot, project, customer }
      : { mode: "DELIVERY", services: [service.slug], songs: qty, ...(needBy ? { requestedDeliveryDate: needBy } : {}), project, customer };

    startTransition(async () => {
      const res = await submitBooking(request, form.website);
      if (res.ok) {
        router.push(`/checkout/${res.orderId}`);
        return;
      }
      if (res.error === "INVALID") {
        const fields = (res.issues ?? []).map((p) => (t.has(`fields.${p}`) ? t(`fields.${p}`) : p)).join(", ");
        setError(t("errors.INVALID", { fields }));
      } else if (res.error === "SLOT_TAKEN") {
        setError(t("errors.SLOT_TAKEN"));
        setSessionDate((d) => d); // keep the day; slots refresh below
        setAvailability(null);
        const again = await getSessionAvailability({ service: service.slug, hours: qty, date: sessionDate, locale });
        setAvailability(again);
        setSlot("");
      } else {
        setError(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.generic"));
      }
    });
  }

  if (!service) return null;
  const unit = isSession ? t("hours") : t("songs");
  const maxQty = isSession ? 4 : 20;

  return (
    <form onSubmit={submit} className="mt-14 grid max-w-3xl gap-12" noValidate>
      <Step n={1} title={t("s1")}>
        <div role="radiogroup" aria-label={t("s1")} className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <label
              key={s.slug}
              className={`flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-4 transition-colors ${
                s.slug === slug ? "border-bone bg-white/[0.04]" : "border-rule hover:border-bone/40"
              }`}
            >
              <span className="flex gap-3">
                <input
                  type="radio"
                  name="service"
                  value={s.slug}
                  checked={s.slug === slug}
                  onChange={() => {
                    setSlug(s.slug);
                    setQty(1);
                  }}
                  className="mt-1 accent-[#ebe6dc]"
                />
                <span>
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-sm text-ash">{s.description}</span>
                </span>
              </span>
              <span className="type-head num whitespace-nowrap text-xl">{s.price}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <span className="text-sm text-bone/85">{unit}</span>
          <div className="flex items-center rounded-full border border-rule">
            <button type="button" aria-label={t("less")} disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} className="size-11 text-xl disabled:opacity-30">
              −
            </button>
            <output aria-live="polite" className="type-head num w-10 text-center text-2xl">
              {qty}
            </output>
            <button type="button" aria-label={t("more")} disabled={qty >= maxQty} onClick={() => setQty((q) => q + 1)} className="size-11 text-xl disabled:opacity-30">
              +
            </button>
          </div>
        </div>
      </Step>

      <Step n={2} title={t("s2")}>
        {!isSession ? (
          <div className="grid gap-6">
            <div aria-live="polite" className="min-h-24 rounded-lg bg-key p-6">
              {loading || !delivery ? (
                <p className="text-ash">{t("computing")}</p>
              ) : delivery.ok ? (
                <>
                  <p className="text-sm text-bone/70">{t("deliveryOn")}</p>
                  <p className="type-head mt-1 text-[clamp(2rem,5vw,3rem)] first-letter:uppercase">{fmtDate(delivery.deliveryDate)}</p>
                  <p className="mt-2 text-sm text-bone/75">{t("startsOn", { date: fmtDate(delivery.firstStartDate) })}</p>
                </>
              ) : (
                <p>{t.has(`errors.${delivery.error}`) ? t(`errors.${delivery.error}`) : t("errors.generic")}</p>
              )}
            </div>
            <div className="max-w-xs">
              <Field label={t("needBy")} hint={t("needByHint")}>
                <input type="date" min={today} value={needBy} onChange={(e) => setNeedBy(e.target.value)} className={input} />
              </Field>
              {delivery?.ok && delivery.requested && (
                <p className={`mt-3 text-sm ${delivery.requested.feasible ? "text-emerald-300" : "text-amber-300"}`}>
                  {delivery.requested.feasible
                    ? t("feasibleYes", { date: fmtDate(delivery.requested.date) })
                    : t("feasibleNo", { date: fmtDate(delivery.requested.date) })}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="max-w-xs">
              <Field label={t("pickDate")}>
                <input type="date" min={today} max={addDays(today, 60)} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className={input} />
              </Field>
            </div>
            {sessionDate && (
              <div aria-live="polite">
                {loading || !availability ? (
                  <p className="text-ash">{t("computing")}</p>
                ) : availability.ok ? (
                  availability.slots.length === 0 ? (
                    <p className="text-amber-300">{t("noSlots")}</p>
                  ) : (
                    <div role="radiogroup" aria-label={t("pickSlot")}>
                      <p className="mb-3 text-sm text-bone/85">{t("slotsFor", { tz: tzLabel })}</p>
                      <div className="flex flex-wrap gap-2">
                        {availability.slots.map((s) => (
                          <label
                            key={s}
                            className={`num cursor-pointer rounded-full border px-4 py-2.5 text-sm transition-colors ${
                              slot === s ? "border-bone bg-bone text-studio" : "border-rule hover:border-bone/50"
                            }`}
                          >
                            <input type="radio" name="slot" value={s} checked={slot === s} onChange={() => setSlot(s)} className="sr-only" />
                            {fmtTime(s)}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <p>{t.has(`errors.${availability.error}`) ? t(`errors.${availability.error}`) : t("errors.generic")}</p>
                )}
              </div>
            )}
            <p className="text-sm text-ash">{t("sessionNote")}</p>
          </div>
        )}
      </Step>

      <Step n={3} title={t("s3")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("name")}>
            <input required autoComplete="name" value={form.name} onChange={set("name")} className={input} />
          </Field>
          <Field label={t("email")}>
            <input required type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} className={input} />
          </Field>
          <Field label={t("artist")}>
            <input required value={form.artist} onChange={set("artist")} className={input} />
          </Field>
          <Field label={isSession ? t("songOptional") : t("song")}>
            <input required={!isSession} value={form.song} onChange={set("song")} className={input} />
          </Field>
          <Field label={t("phone")}>
            <input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} className={input} />
          </Field>
          <Field label={t("reference")} hint={t("referenceHint")}>
            <input type="url" inputMode="url" placeholder="https://" value={form.reference} onChange={set("reference")} className={input} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("notes")}>
              <textarea rows={4} value={form.notes} onChange={set("notes")} className={input} />
            </Field>
          </div>
          {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
            </label>
          </div>
        </div>
        {!isSession && <p className="mt-4 text-sm text-ash">{t("files")}</p>}
      </Step>

      <Step n={4} title={t("s4")}>
        <div className="rounded-lg border border-rule p-6">
          {quote ? (
            <dl className="grid gap-3">
              {quote.lines.map((l) => (
                <div key={l.serviceSlug} className="flex justify-between gap-4">
                  <dt>
                    {l.name} <span className="num text-ash">× {l.quantity}</span>
                  </dt>
                  <dd className="num">{money(l.lineTotalCents)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-rule pt-3">
                <dt className="text-ash">{t("total")}</dt>
                <dd className="num">{money(quote.totalCents)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold">{t("depositNow", { percent: quote.depositPercent })}</dt>
                <dd className="type-head num text-3xl">{money(quote.depositCents)}</dd>
              </div>
              <div className="flex justify-between gap-4 text-sm text-ash">
                <dt>{t("balanceLater")}</dt>
                <dd className="num">{money(quote.balanceCents)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-ash">{isSession ? t("pickSlot") : t("computing")}</p>
          )}
        </div>
        <ul className="mt-4 grid gap-1 text-sm text-ash">
          <li>{t("policyCancel", { hours: business.cancellationWindowHours })}</li>
          {!isSession && <li>{t("policyRevisions", { fee: business.revisionFee })}</li>}
        </ul>

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!ready || pending}
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-bone px-8 font-semibold text-studio transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? t("submitting") : t("submit")}
        </button>
      </Step>
    </form>
  );
}
