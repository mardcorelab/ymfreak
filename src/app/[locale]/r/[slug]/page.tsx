import type { Metadata } from "next";
import { ComingSoon } from "@/components/site/ComingSoon";
import { siteGate } from "@/server/site-visibility";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";
import { getRelease } from "@/server/releases";
import { EmbedPlayer } from "@/components/media/EmbedPlayer";
import { Wordmark } from "@/components/brand/Logo";
import { TrackedLink } from "@/components/site/TrackedLink";

export const revalidate = 300;
type Props = { params: Promise<{ locale: AppLocale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const release = await getRelease(slug, locale);
  if (!release) return {};
  const t = await getTranslations({ locale, namespace: "release" });
  return {
    title: `${release.title} — ${release.artist}`,
    description: t("metaDescription", { title: release.title, artist: release.artist }),
    alternates: alternates(locale, `/r/${slug}`),
    openGraph: release.coverUrl ? { images: [{ url: release.coverUrl, width: 640, height: 640, alt: release.title }] } : undefined,
  };
}

/** Release page (ymfreak.com/r/…): the cover, every platform, a player and a way to work with YM Freak. */
export default async function ReleasePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if ((await siteGate()) === "coming-soon") return <ComingSoon locale={locale} />;
  const release = await getRelease(slug, locale);
  if (!release) notFound();
  const [t, tw] = await Promise.all([getTranslations("release"), getTranslations("work")]);
  const provider = release.embed?.provider === "SPOTIFY" ? "Spotify" : release.embed ? "YouTube" : null;

  return (
    <main id="main" className="relative isolate min-h-dvh overflow-hidden">
      {release.coverUrl && (
        // Blurred cover as the page's backdrop.
        <div aria-hidden className="absolute inset-0 -z-10 scale-125 bg-cover bg-center opacity-35 blur-3xl" style={{ backgroundImage: `url(${release.coverUrl})` }} />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-studio/30 via-studio/80 to-studio" />

      <div className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
        <a href={`/${locale}/links`} className="block w-28 opacity-80 hover:opacity-100" aria-label="YM Freak">
          <Wordmark className="h-auto w-full" />
        </a>

        <div className="mt-8">
          {release.embed ? (
            <EmbedPlayer
              item={release}
              labels={{
                play: t("play"),
                loading: tw("loading"),
                playerTitle: provider ? tw("playerTitle", { provider, title: release.title }) : release.title,
                coverAlt: tw("coverAlt", { title: release.title, artist: release.artist }),
              }}
            />
          ) : release.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={release.coverUrl} alt="" className="aspect-square w-full rounded-md object-cover" />
          ) : null}
        </div>

        <h1 className="type-head mt-6 text-2xl">{release.title}</h1>
        <p className="mt-1 text-lg text-bone/85">
          {release.artist}
          {release.year !== null && <span className="num text-ash"> · {release.year}</span>}
        </p>
        {release.credit && (
          <p className="mt-3 text-sm text-ash">
            {t("credit")}: <span className="text-bone">{release.credit}</span>
          </p>
        )}

        {release.links.length > 0 && (
          <section className="mt-8" aria-labelledby="listen">
            <h2 id="listen" className="text-sm uppercase tracking-wider text-ash">
              {t("listenOn")}
            </h2>
            <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-studio/60">
              {release.links.map((l) => (
                <li key={l.platform}>
                  <TrackedLink
                    label={l.platform}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-14 items-center justify-between px-5 hover:bg-bone/5"
                    data-platform={l.platform}
                  >
                    <span className="font-semibold">{l.label}</span>
                    <span aria-hidden className="text-ash">
                      ↗
                    </span>
                  </TrackedLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 rounded-2xl bg-key p-5">
          <p className="type-sub text-xl">{t("cta")}</p>
          <TrackedLink
            label="book"
            href={`/${locale}/book`}
            className="mt-4 inline-flex min-h-12 items-center rounded-full bg-bone px-6 font-semibold text-studio hover:bg-white"
          >
            {t("ctaButton")}
          </TrackedLink>
        </section>

        <p className="mt-8 text-center text-sm">
          <a href={`/${locale}/portfolio`} className="text-ash underline underline-offset-4 hover:text-bone">
            {t("more")}
          </a>
        </p>
      </div>
    </main>
  );
}
