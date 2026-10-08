import { getTranslations, setRequestLocale } from "next-intl/server";
import { getActiveServices } from "@/server/catalog";
import { formatMoney } from "@/server/domain/money";
import type { AppLocale } from "@/i18n/routing";

// Phase 0 foundation page: proves the database → domain → i18n path end to end.
// Replaced by the real home page in Phase 1.
export const dynamic = "force-dynamic";

export default async function FoundationPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("foundation");
  const services = await getActiveServices();

  const unitLabel = { PER_SONG: t("perSong"), PER_HOUR: t("perHour"), FLAT: t("flat") } as const;

  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-mute">{t("eyebrow")}</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight">{t("headline")}</h1>
      <p className="mt-2 text-mute">{t("roles")}</p>

      <h2 className="mt-16 text-sm uppercase tracking-[0.2em] text-mute">{t("servicesTitle")}</h2>
      {services.length === 0 ? (
        <p className="mt-6 text-mute">{t("emptyServices")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {services.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-6 py-4">
              <div>
                <p className="font-medium">{locale === "es" ? s.nameEs : s.nameEn}</p>
                <p className="text-sm text-mute">
                  {s.bookingMode === "SESSION"
                    ? t("remoteSession")
                    : s.turnaroundDays !== null && t("workingDays", { count: s.turnaroundDays })}
                </p>
              </div>
              <p className="whitespace-nowrap tabular-nums">
                {formatMoney(s.priceCents, s.currency, locale)}{" "}
                <span className="text-sm text-mute">{unitLabel[s.pricingUnit]}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-10 text-sm text-mute">{t("note")}</p>
    </main>
  );
}
