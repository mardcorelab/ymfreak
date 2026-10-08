import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { PortfolioVM } from "@/lib/view-models";
import { EmbedPlayer } from "@/components/media/EmbedPlayer";

const PROVIDER_NAME = { SPOTIFY: "Spotify", YOUTUBE: "YouTube" } as const;

/** Release cards: cover → in-page player, plus liner-note credits. */
export function WorkGrid({ items }: { items: PortfolioVM[] }) {
  const t = useTranslations("work");

  if (items.length === 0) return <p className="text-ash">{t("empty")}</p>;

  return (
    <ul className="grid gap-x-8 gap-y-14 md:grid-cols-2">
      {items.map((item) => {
        const provider = item.embed ? PROVIDER_NAME[item.embed.provider] : null;
                return (
          <li key={item.slug}>
            <EmbedPlayer
              item={item}
              labels={{
                play: t("play", { title: item.title }),
                loading: t("loading"),
                playerTitle: provider ? t("playerTitle", { provider, title: item.title }) : item.title,
                coverAlt: t("coverAlt", { title: item.title, artist: item.artist }),
              }}
            />
            <div className="mt-5 flex items-start justify-between gap-6">
              <div>
                <h3 className="type-head text-[clamp(1.9rem,3vw,2.6rem)]">{item.title}</h3>
                <p className="mt-1 text-lg">{item.artist}</p>
                <p className="mt-2 text-ash">
                  {item.credit && <span className="text-bone/90">{item.credit}. </span>}
                  {item.year !== null && <span className="num">{item.year}</span>}
                </p>
              </div>
              {item.externalUrl && provider && (
                <Link
                  href={`/r/${item.slug}`}
                  className="mt-2 shrink-0 text-sm text-ash underline decoration-ash/40 underline-offset-4 hover:text-bone"
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
