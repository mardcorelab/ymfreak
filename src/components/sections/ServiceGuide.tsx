"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { track } from "@/components/site/Analytics";
import { openAssistant } from "@/components/agent/open";
import { formatMoney } from "@/server/domain/money";
import { getDeliveryQuote } from "@/server/booking/public-actions";
import type { DeliveryQuote } from "@/server/booking/engine";
import type { ServiceVM } from "@/lib/view-models";

const STAGES = ["idea", "vocals", "recorded", "mixed", "other"] as const;
type Stage = (typeof STAGES)[number];
type Step = "stage" | "songs" | "when" | "result";

/**
 * "Find your service": three quick questions, then the recommended service
 * with its real price and delivery date from the calendar engine. Which
 * service answers each stage is set per service in the dashboard.
 */
export function ServiceGuide({ services }: { services: ServiceVM[] }) {
  const t = useTranslations("guide");
  const locale = useLocale() as "es" | "en";
  const [step, setStep] = useState<Step>("stage");
  const [stage, setStage] = useState<Stage | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [songs, setSongs] = useState(1);
  const [date, setDate] = useState("");
  const [wantsDate, setWantsDate] = useState(false);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [pending, startTransition] = useTransition();

  const byStage = useMemo(() => {
    const m = new Map<Stage, ServiceVM[]>();
    for (const st of STAGES) m.set(st, services.filter((s) => s.stages.includes(st)));
    return m;
  }, [services]);
  const stages = STAGES.filter((st) => (byStage.get(st)?.length ?? 0) > 0);
  const matches = stage ? (byStage.get(stage) ?? []) : [];
  const chosen = matches.find((s) => s.slug === pick) ?? matches[0] ?? null;
  const alternatives = matches.filter((s) => s.slug !== chosen?.slug);

  const money = (cents: number) => formatMoney(cents, "USD", locale);
  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const today = new Date().toISOString().slice(0, 10);

  if (stages.length === 0) return null;

  const reset = () => {
    setStep("stage");
    setStage(null);
    setPick(null);
    setSongs(1);
    setDate("");
    setWantsDate(false);
    setQuote(null);
  };

  const chooseStage = (st: Stage) => {
    track("click", window.location.pathname, `guide:${st}`);
    setStage(st);
    setPick(null);
    const first = byStage.get(st)?.[0];
    // Sessions and "other" go straight to the answer; songs only matter for deliveries.
    setStep(st === "other" || !first || first.bookingMode === "SESSION" ? "result" : "songs");
  };

  const fetchQuote = (service: ServiceVM, requested: string | null) => {
    setQuote(null);
    setStep("result");
    if (service.bookingMode !== "DELIVERY") return;
    startTransition(async () => {
      try {
        const q = await getDeliveryQuote({ services: [service.slug], songs, locale, ...(requested ? { requestedDeliveryDate: requested } : {}) });
        setQuote(q);
      } catch {
        setQuote({ ok: false, error: "BOOKING_CLOSED" });
      }
    });
  };

  const switchTo = (slug: string) => {
    setPick(slug);
    const s = matches.find((m) => m.slug === slug);
    if (s && stage !== "other") fetchQuote(s, wantsDate && date ? date : null);
  };

  const unit = (s: ServiceVM) => ({ PER_SONG: t("perSong"), PER_HOUR: t("perHour"), FLAT: t("flat") })[s.pricingUnit];
  const option = "min-h-12 rounded-full border border-rule-key px-5 text-left text-[0.95rem] text-bone/90 transition hover:border-bone/60 hover:bg-bone/5";

  return (
    <section aria-labelledby="guide-title" className="mb-14 rounded-2xl border border-rule-key bg-studio p-6 sm:p-9" data-testid="service-guide" data-reveal>
      <p className="text-sm text-bone/60">{t("eyebrow")}</p>
      <h3 id="guide-title" className="type-head mt-2 text-[clamp(1.2rem,2.4vw,1.75rem)]">
        {t("title")}
      </h3>

      <div aria-live="polite" className="mt-6">
        <div key={`${step}-${pick ?? ""}`} className="step-in">
        {step === "stage" && (
          <fieldset>
            <legend className="text-bone/85">{t("qStage")}</legend>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {stages.map((st) => (
                <button key={st} type="button" className={option} onClick={() => chooseStage(st)}>
                  {t(`stage.${st}`)}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === "songs" && (
          <div>
            <p className="text-bone/85" id="songs-label">
              {t("qSongs")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center rounded-full border border-rule-key" role="group" aria-labelledby="songs-label">
                <button type="button" aria-label={t("less")} className="grid size-12 place-items-center text-xl disabled:opacity-30" disabled={songs <= 1} onClick={() => setSongs(songs - 1)}>
                  −
                </button>
                <output className="type-figure num w-14 text-center text-2xl" aria-live="polite">
                  {songs}
                </output>
                <button type="button" aria-label={t("more")} className="grid size-12 place-items-center text-xl disabled:opacity-30" disabled={songs >= 20} onClick={() => setSongs(songs + 1)}>
                  +
                </button>
              </div>
              <button type="button" className={option} onClick={() => setStep("when")}>
                {t("next")}
              </button>
            </div>
          </div>
        )}

        {step === "when" && chosen && (
          <div>
            <p className="text-bone/85">{t("qWhen")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button type="button" className={option} onClick={() => fetchQuote(chosen, null)}>
                {t("asap")}
              </button>
              {!wantsDate ? (
                <button type="button" className={option} onClick={() => setWantsDate(true)}>
                  {t("haveDate")}
                </button>
              ) : (
                <form
                  className="flex flex-wrap items-center gap-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (date) fetchQuote(chosen, date);
                  }}
                >
                  <label className="sr-only" htmlFor="guide-date">
                    {t("dateLabel")}
                  </label>
                  <input
                    id="guide-date"
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="min-h-12 rounded-full border border-rule-key bg-studio-deep px-4 text-bone [color-scheme:dark]"
                  />
                  <button type="submit" disabled={!date} className={`${option} disabled:opacity-40`}>
                    {t("see")}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {step === "result" && stage === "other" && (
          <div>
            <p className="text-bone/85">{t("otherIntro")}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {matches.map((s) => (
                <li key={s.slug} className="rounded-xl border border-rule p-5">
                  <p className="type-head text-base">{s.name}</p>
                  <p className="mt-2 text-sm text-bone/80">{s.promise}</p>
                  <p className="mt-3 text-sm">
                    <span className="type-figure num text-xl">{s.price}</span> <span className="text-ash">{unit(s)}</span>
                  </p>
                  <ButtonLink href={{ pathname: "/book", query: { service: s.slug } }} variant="line" className="mt-4 min-h-10 px-4 text-sm">
                    {t("book")}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === "result" && stage !== "other" && chosen && (
          <div data-testid="guide-result">
            <p className="text-sm text-bone/60">{t("yours")}</p>
            <p className="type-head mt-1 text-[clamp(1.3rem,2.8vw,2rem)]">{chosen.name}</p>
            <p className="mt-2 max-w-[60ch] text-bone/85">{chosen.promise}</p>

            <div className="mt-6 grid gap-6 border-t border-rule-key pt-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-ash">{t("investment")}</p>
                {chosen.bookingMode === "SESSION" || !quote?.ok ? (
                  <p className="mt-1">
                    <span className="type-figure num text-4xl">{chosen.price}</span> <span className="text-sm text-ash">{unit(chosen)}</span>
                  </p>
                ) : (
                  <>
                    <p className="type-figure num mt-1 text-4xl">{money(quote.quote.totalCents)}</p>
                    <p className="mt-1 text-sm text-ash">
                      {t("forSongs", { count: songs })} · {t("deposit", { amount: money(quote.quote.depositCents) })}
                    </p>
                  </>
                )}
              </div>
              <div>
                {chosen.bookingMode === "SESSION" ? (
                  <>
                    <p className="text-sm text-ash">{t("sessionTitle")}</p>
                    <p className="mt-1 text-bone/85">{t("sessionText")}</p>
                  </>
                ) : pending || !quote ? (
                  <p className="text-sm text-ash">{t("calculating")}</p>
                ) : quote.ok ? (
                  <>
                    <p className="text-sm text-ash">{t("delivery")}</p>
                    <p className="type-head mt-1 text-xl first-letter:uppercase">{fmtDate(quote.deliveryDate)}</p>
                    {quote.requested && (
                      <p className={`mt-1 text-sm ${quote.requested.feasible ? "text-emerald-300" : "text-amber-300"}`}>
                        {quote.requested.feasible ? t("onTime", { date: fmtDate(quote.requested.date) }) : t("notOnTime", { date: fmtDate(quote.requested.date) })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-bone/75">{t("noDate")}</p>
                )}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink href={{ pathname: "/book", query: { service: chosen.slug } }} onClick={() => track("click", window.location.pathname, `guide-book:${chosen.slug}`)}>
                {chosen.bookingMode === "SESSION" ? t("pickTime") : t("book")}
              </ButtonLink>
              <button
                type="button"
                className="min-h-11 text-sm text-bone/80 underline underline-offset-4 hover:text-bone"
                onClick={() => openAssistant(chosen.bookingMode === "SESSION" ? t("askSession", { service: chosen.name }) : t("askPrompt", { service: chosen.name, count: songs }))}
              >
                {t("ask")}
              </button>
              <button type="button" className="min-h-11 text-sm text-ash hover:text-bone" onClick={reset}>
                {t("restart")}
              </button>
            </div>

            {alternatives.length > 0 && (
              <p className="mt-6 text-sm text-bone/75">
                {t("alsoFits")}{" "}
                {alternatives.map((a, i) => (
                  <span key={a.slug}>
                    {i > 0 && ", "}
                    <button type="button" className="underline underline-offset-4 hover:text-bone" onClick={() => switchTo(a.slug)}>
                      {a.name}
                    </button>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        {step === "result" && stage === "other" && (
          <button type="button" className="mt-6 min-h-11 text-sm text-ash hover:text-bone" onClick={reset}>
            {t("restart")}
          </button>
        )}
        {(step === "songs" || step === "when") && (
          <button type="button" className="mt-5 min-h-11 text-sm text-ash hover:text-bone" onClick={() => setStep(step === "when" ? "songs" : "stage")}>
            {t("back")}
          </button>
        )}
        </div>
      </div>
    </section>
  );
}
