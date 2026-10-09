import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/ComingSoon";
import { siteGate } from "@/server/site-visibility";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";
import { getAchievementsVM, getContactVM } from "@/server/site-data";
import { getLinkReleases } from "@/server/releases";
import { getYoutubeVideos } from "@/server/youtube";
import { getNextAvailable } from "@/server/booking/next-available";
import { agentAvailable } from "@/server/agent/model";
import { socialLinks } from "@/components/site/social";
import { MonogramTile, Slogan, Wordmark } from "@/components/brand/Logo";
import { OpenAgentButton, TrackedLink } from "@/components/site/TrackedLink";
import { RecordMark } from "@/components/ui/RecordMark";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "links" });
  return { title: t("title"), description: t("description"), alternates: alternates(locale, "/links") };
}

const big =
  "flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl px-5 py-3 text-left transition active:scale-[0.99] focus-visible:outline-2";

/** Link-in-bio page for Instagram, TikTok and YouTube: standalone, thumb-sized, everything one tap away. */
export default async function LinksPage({ params }: Props) {
  const { locale } = await params;
  if ((await siteGate()) === "coming-soon") return <ComingSoon locale={locale} />;
  setRequestLocale(locale);
  const [t, tAll, contact, releases, achievements, next, videos] = await Promise.all([
    getTranslations("links"),
    getTranslations(),
    getContactVM(),
    getLinkReleases(locale),
    getAchievementsVM(locale),
    getNextAvailable(locale),
    getYoutubeVideos(),
  ]);
  const video = videos[0];
  const socials = socialLinks(contact, tAll);
  const highlight = achievements.find((a) => a.highlight);
  const other = locale === "es" ? "en" : "es";

  return (
    <main id="main" className="mx-auto min-h-dvh w-full max-w-md px-5 pb-16 pt-12">
      <header className="flex flex-col items-center text-center">
        <MonogramTile className="size-20 shadow-[0_10px_40px_rgba(0,0,0,0.5)]" />
        <h1 className="mt-6 w-full">
          <span className="sr-only">YM Freak</span>
          <Wordmark className="mx-auto h-auto w-[78%]" />
        </h1>
        <Slogan className="mx-auto mt-3 h-auto w-[78%] text-bone/85" />
        <p className="mt-4 text-sm text-ash">{tAll("hero.roles")}</p>
        {highlight && (
          <p className="mt-3 flex items-center gap-2 text-sm text-brass">
            <RecordMark className="size-4" />
            {highlight.title}
            {highlight.year !== null && <span className="num">{highlight.year}</span>}
          </p>
        )}
      </header>

      <nav aria-label={t("title")} className="mt-10 grid gap-3">
        <TrackedLink label="book" href={`/${locale}/book`} className={`${big} bg-bone text-studio hover:bg-white`}>
          <span>
            <span className="block font-semibold">{t("book")}</span>
            <span className="block text-sm text-studio/70">{next ? tAll("hero.nextAvailable", { date: next.label }) : t("bookHint")}</span>
          </span>
          <span aria-hidden>→</span>
        </TrackedLink>
        {agentAvailable() && (
          <OpenAgentButton className={`${big} border border-bone/30 hover:bg-bone/5`}>
            <span>
              <span className="block font-semibold">{t("agent")}</span>
              <span className="block text-sm text-ash">{t("agentHint")}</span>
            </span>
            <MonogramTile className="size-8 shrink-0" />
          </OpenAgentButton>
        )}
        <TrackedLink label="portfolio" href={`/${locale}/portfolio`} className={`${big} border border-bone/30 hover:bg-bone/5`}>
          <span className="font-semibold">{t("listen")}</span>
          <span aria-hidden>→</span>
        </TrackedLink>
        <TrackedLink label="analyzer" href={`/${locale}/analyzer`} className={`${big} border border-bone/30 hover:bg-bone/5`}>
          <span className="font-semibold">{tAll("analyzer.navLabel")}</span>
          <span aria-hidden>→</span>
        </TrackedLink>
      </nav>

      {(releases.length > 0 || video) && (
        <section className="mt-10" aria-labelledby="latest">
          <h2 id="latest" className="text-sm uppercase tracking-wider text-ash">
            {t("latest")}
          </h2>
          <ul className="mt-3 grid gap-3">
            {video && (
              <li>
                <TrackedLink
                  label="youtube-video"
                  href={video.url || `https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-2xl border border-rule p-3 hover:bg-bone/5"
                >
                  <Image
                    src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                    alt=""
                    width={96}
                    height={64}
                    className="h-16 w-24 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs uppercase tracking-wider text-ash">{tAll("youtube.latest")}</span>
                    <span className="line-clamp-2 font-semibold leading-snug">{video.title}</span>
                  </span>
                </TrackedLink>
              </li>
            )}
            {releases.map((r) => (
              <li key={r.slug}>
                <TrackedLink label={`release-${r.slug}`.slice(0, 40)} href={`/${locale}/r/${r.slug}`} className="flex items-center gap-4 rounded-2xl border border-rule p-3 hover:bg-bone/5">
                  {r.coverUrl ? (
                    <Image src={r.coverUrl} alt="" width={64} height={64} className="size-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="size-16 shrink-0 rounded-lg bg-key" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="block truncate text-sm text-ash">
                      {r.artist}
                      {r.credit ? ` · ${r.credit}` : ""}
                    </span>
                  </span>
                </TrackedLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {socials.length > 0 && (
        <section className="mt-10" aria-labelledby="follow">
          <h2 id="follow" className="text-sm uppercase tracking-wider text-ash">
            {t("follow")}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {socials.map((s) => (
              <li key={s.href}>
                <TrackedLink
                  label={s.key === "other" ? `other-${s.label}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) : s.key}
                  href={s.href}
                  {...s.anchorProps}
                  className="flex min-h-14 flex-col justify-center rounded-2xl border border-rule px-4 py-2 hover:bg-bone/5"
                >
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="truncate text-xs text-ash">{s.display}</span>
                </TrackedLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ash">
        <TrackedLink label="website" href={`/${locale}`} className="hover:text-bone">
          {t("web")}
        </TrackedLink>
        <TrackedLink label="account" href={`/${locale}/account`} className="hover:text-bone">
          {t("account")}
        </TrackedLink>
        <a href={`/${other}/links`} className="hover:text-bone" hrefLang={other}>
          {tAll("nav.language")}
        </a>
      </footer>
    </main>
  );
}
