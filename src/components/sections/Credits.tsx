import { useTranslations } from "next-intl";
import type { AchievementVM } from "@/lib/view-models";
import { RecordMark } from "@/components/ui/RecordMark";
import { CountUp } from "@/components/ui/CountUp";
import { useLocale } from "next-intl";

/**
 * Credibility strip set like an album's liner notes: what, where, when.
 * Fed from highlighted achievements, so a new certification appears here
 * as soon as it is added in the dashboard.
 */
export function Credits({ achievements, youtubeViews }: { achievements: AchievementVM[]; youtubeViews?: number | null }) {
  const t = useTranslations();
  const locale = useLocale() as "es" | "en";
  const highlighted = achievements.filter((a) => a.highlight).slice(0, 2);
  const views = youtubeViews && youtubeViews > 0 ? youtubeViews : null;

  return (
    <section aria-label={t("credits.label")} className="border-y border-rule bg-studio-deep">
      <dl data-stagger className={`mx-auto grid max-w-[90rem] divide-y divide-rule px-5 sm:px-8 md:divide-x md:divide-y-0 lg:px-12 ${views ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}>
        {highlighted.map((a) => (
          <div key={a.id} data-reveal className="flex gap-4 py-7 md:px-8 md:first:pl-0">
            <RecordMark className="mt-1 size-7 shrink-0 text-brass" />
            <div>
              <dt className="type-sub text-xl text-brass">
                {a.title}
                {a.year !== null && <span className="num"> {a.year}</span>}
              </dt>
              <dd className="mt-1 text-[0.95rem] text-bone/75">{a.detail}</dd>
            </div>
          </div>
        ))}
        <div data-reveal className="flex items-baseline gap-4 py-7 md:px-8">
          <dt className="sr-only">{t("credits.years")}</dt>
          <dd className="type-figure num text-5xl">{t("credits.yearsValue")}</dd>
          <dd className="text-[0.95rem] text-bone/75">{t("credits.years")}</dd>
        </div>
        {views && (
          <div data-reveal className="flex flex-col gap-1 py-7 md:px-8" data-testid="youtube-views">
            <dt className="sr-only">{t("credits.views")}</dt>
            <dd className="type-figure num text-5xl">
              <CountUp value={views} locale={locale} />
            </dd>
            <dd className="text-[0.95rem] text-bone/75">{t("credits.views")}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
