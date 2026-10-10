"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { track } from "@/components/site/Analytics";
import { openAssistant } from "@/components/agent/open";
import type { ServiceVM } from "@/lib/view-models";

const FLAGSHIP = "mezcla-mastering";

/**
 * Home-page services: what each one gives the artist first; the investment
 * shows when the visitor asks for it (one tap). Everything comes from the
 * database through ServiceVM.
 */
export function ServiceCards({ services }: { services: ServiceVM[] }) {
  const ordered = [...services.filter((s) => s.slug === FLAGSHIP), ...services.filter((s) => s.slug !== FLAGSHIP)];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="service-cards" data-stagger>
      {ordered.map((s) => (
        <ServiceCard key={s.slug} service={s} flagship={s.slug === FLAGSHIP} />
      ))}
    </ul>
  );
}

function ServiceCard({ service: s, flagship }: { service: ServiceVM; flagship: boolean }) {
  const t = useTranslations("services");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const unit = { PER_SONG: t("perSong"), PER_HOUR: t("perHour"), FLAT: t("flat") }[s.pricingUnit];
  const timing =
    s.bookingMode === "SESSION"
      ? t("session", { minutes: s.sessionMinutes ?? 60 })
      : s.turnaroundDays !== null
        ? t("turnaround", { count: s.turnaroundDays })
        : "";

  return (
    <li
      className={`flex flex-col rounded-xl border p-6 sm:p-7 ${flagship ? "border-bone/25 bg-key sm:col-span-2 lg:col-span-1 lg:row-span-2" : "border-rule bg-studio"}`}
      data-service={s.slug}
      data-reveal
    >
      {flagship && <p className="text-sm text-bone/70">{t("flagship")}</p>}
      <h3 className={`type-head ${flagship ? "mt-2 text-[clamp(1.2rem,2.2vw,1.6rem)]" : "text-lg"}`}>{s.name}</h3>
      <p className="mt-3 text-bone/85">{s.promise}</p>
      {s.includes.length > 0 && (
        <ul className="mt-5 grid gap-1.5 text-sm text-bone/75">
          {s.includes.slice(0, flagship ? 6 : 3).map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-bone/50" />
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-6">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          data-sound="rise"
          onClick={() => {
            if (!open) track("click", window.location.pathname, `price:${s.slug}`);
            setOpen(!open);
          }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-bone underline-offset-4 hover:underline"
        >
          {open ? t("hideInvestment") : t("showInvestment")}
          <svg viewBox="0 0 20 20" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div id={panelId} hidden={!open} className="fader-open mt-4 border-t border-rule-key pt-5">
          <p className="text-sm text-ash">{t("investment")}</p>
          <p className="mt-1">
            <span className="type-figure num text-3xl">{s.price}</span> <span className="text-sm text-ash">{unit}</span>
          </p>
          <p className="mt-2 text-sm text-bone/75">
            {timing}
            {s.revisionsIncluded > 0 && <>. {t("revisions", { count: s.revisionsIncluded })}</>}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <ButtonLink href={{ pathname: "/book", query: { service: s.slug } }} className="min-h-11 px-5">
              {t("bookThis")}
            </ButtonLink>
            <button
              type="button"
              onClick={() => {
                track("click", window.location.pathname, `ask:${s.slug}`);
                openAssistant(t("askPrompt", { service: s.name }));
              }}
              className="min-h-11 text-sm text-bone/80 underline underline-offset-4 hover:text-bone"
            >
              {t("ask")}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
