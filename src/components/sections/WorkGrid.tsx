import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { PortfolioVM } from "@/lib/view-models";
import { EmbedPlayer } from "@/components/media/EmbedPlayer";
import { byViews } from "@/lib/portfolio-order";

const PROVIDER_NAME = { SPOTIFY: "Spotify", YOUTUBE: "YouTube" } as const;

/**
 * Release cards: cover → in-page player, plus liner-note credits. When view
 * counts are known, the most played come first (the rest keep the dashboard
 * order). `compact` fits more per row for the full portfolio page.
 */
export function WorkGrid({ items, views, compact = false }: { items: PortfolioVM[]; views?: Record<string, number>; compact?: boolean }) {
  const locale = useLocale();
  const fmt = new Intl.NumberFormat(locale === "es" ? "es-DO" : "en-US");
  const t = useTranslations("work");

  if (items.length === 0) return <p className="text-ash">{t("empty")}</p>;

  const sorted = byViews(items, views);

  return (
    <ul
      className={compact ? "grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5" : "grid gap-x-8 gap-y-14 md:grid-cols-2"}
      data-stagger
      data-testid="work-grid"
    >
      {sorted.map((item) => {
        const provider = item.embed ? PROVIDER_NAME[item.embed.provider] : null;
                return (
          <li key={item.slug} data-reveal data-slug={item.slug}>
            <EmbedPlayer
              item={item}
              compact={compact}
              labels={{
                play: t("play", { title: item.title }),
                loading: t("loading"),
                playerTitle: provider ? t("playerTitle", { provider, title: item.title }) : item.title,
                coverAlt: t("coverAlt", { title: item.title, artist: item.artist }),
              }}
            />
            <div className={compact ? "mt-3 flex flex-col gap-1" : "mt-5 flex items-start justify-between gap-6"}>
              <div className="min-w-0">
                <h3 className={compact ? "type-head truncate text-[0.95rem] sm:text-base" : "type-head text-[clamp(1.1rem,2vw,1.5rem)]"}>{item.title}</h3>
                <p className={compact ? "truncate text-sm" : "mt-1 text-lg"}>{item.artist}</p>
                <p className={compact ? "mt-1 line-clamp-2 text-xs text-ash" : "mt-2 text-ash"}>
                  {item.credit && <span className="text-bone/90">{item.credit}. </span>}
                  {item.year !== null && <span className="num">{item.year}</span>}
                </p>
                {views?.[item.slug] ? (
                  <p className={compact ? "text-xs text-ash" : "mt-1 text-sm text-ash"} data-testid="release-views">
                    {t("views", { count: fmt.format(views[item.slug]!) })}
                  </p>
                ) : null}
              </div>
              {item.externalUrl && provider && (
                <Link
                  href={`/r/${item.slug}`}
                  className={`shrink-0 text-ash underline decoration-ash/40 underline-offset-4 hover:text-bone ${compact ? "text-xs" : "mt-2 text-sm"}`}
                >
                  {t("allPlatforms")}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
