import { useTranslations } from "next-intl";
import type { BusinessHoursVM, ServiceVM } from "@/lib/view-models";

const FLAGSHIP = "mezcla-mastering";

function useServiceLabels() {
  const t = useTranslations("services");
  return {
    t,
    unit: (s: ServiceVM) => ({ PER_SONG: t("perSong"), PER_HOUR: t("perHour"), FLAT: t("flat") })[s.pricingUnit],
    timing: (s: ServiceVM) =>
      s.bookingMode === "SESSION"
        ? t("session", { minutes: s.sessionMinutes ?? 60 })
        : s.turnaroundDays !== null
          ? t("turnaround", { count: s.turnaroundDays })
          : "",
  };
}

function Price({ service, unit }: { service: ServiceVM; unit: string }) {
  return (
    <p className="whitespace-nowrap text-right">
      <span className="type-figure num text-3xl">{service.price}</span>
      <span className="block text-sm text-ash">{unit}</span>
    </p>
  );
}

/**
 * The flagship (mix & master) gets the full breakdown; the rest read like a
 * price list. All values come from the database through ServiceVM.
 */
export function ServiceList({
  services,
  business,
  detailed = false,
}: {
  services: ServiceVM[];
  business: BusinessHoursVM;
  detailed?: boolean;
}) {
  const { t, unit, timing } = useServiceLabels();
  const flagship = services.find((s) => s.slug === FLAGSHIP);
  const rest = services.filter((s) => s.slug !== FLAGSHIP);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      {flagship && (
        <article className="self-start rounded-lg bg-key p-7 sm:p-9 lg:sticky lg:top-8">
          <p className="text-sm text-bone/70">{t("flagship")}</p>
          <div className="mt-3 flex items-start justify-between gap-6">
            <h3 className="type-head text-[clamp(1.15rem,2.2vw,1.7rem)]">{flagship.name}</h3>
            <Price service={flagship} unit={unit(flagship)} />
          </div>
          <p className="mt-3 text-bone/80">{flagship.description}</p>
          {flagship.includes.length > 0 && (
            <>
              <p className="mt-7 text-sm text-bone/70">{t("includes")}</p>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {flagship.includes.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.7em] h-px w-3 shrink-0 bg-bone/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-7 border-t border-rule-key pt-5 text-sm text-bone/75">
            {timing(flagship)}. {t("revisions", { count: flagship.revisionsIncluded })}.{" "}
            {t("extraRevision", { fee: business.revisionFee })}.
          </p>
        </article>
      )}

      <ul className="divide-y divide-rule border-y border-rule">
        {rest.map((s) => (
          <li key={s.slug} className="flex items-start justify-between gap-6 py-6">
            <div className="min-w-0">
              <h3 className="type-sub text-2xl">{s.name}</h3>
              <p className="mt-1 text-bone/75">{s.description}</p>
              <p className="mt-2 text-sm text-ash">
                {timing(s)}
                {detailed && s.revisionsIncluded > 0 && <>. {t("revisions", { count: s.revisionsIncluded })}</>}
              </p>
              {detailed && s.includes.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 text-sm text-bone/80">
                  {s.includes.map((i) => (
                    <li key={i} className="rounded-full border border-rule px-3 py-1">
                      {i}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Price service={s} unit={unit(s)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
