import { useTranslations } from "next-intl";
import type { PortfolioVM } from "@/lib/view-models";
import { EmbedPlayer } from "@/components/media/EmbedPlayer";

/** Latest YouTube videos; each plays in place (YouTube loads only on play). */
export function VideoGrid({ items }: { items: PortfolioVM[] }) {
  const t = useTranslations("work");
  return (
    <ul className="grid gap-x-6 gap-y-10 md:grid-cols-3">
      {items.map((v) => (
        <li key={v.slug}>
          <EmbedPlayer
            item={v}
            labels={{
              play: t("play", { title: v.title }),
              loading: t("loading"),
              playerTitle: t("playerTitle", { provider: "YouTube", title: v.title }),
              coverAlt: v.title,
            }}
          />
          <h3 className="mt-3 line-clamp-2 font-semibold leading-snug">{v.title}</h3>
        </li>
      ))}
    </ul>
  );
}
