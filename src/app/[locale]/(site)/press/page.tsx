import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";
import { getAchievementsVM, getContactVM, getPortfolioVM } from "@/server/site-data";
import { CopyButton } from "@/components/site/CopyButton";
import { MonogramTile, Wordmark, Monogram } from "@/components/brand/Logo";
import { RecordMark } from "@/components/ui/RecordMark";
import { getYoutubeViews } from "@/server/youtube-stats";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "press" });
  return { title: t("title"), description: t("metaDescription"), alternates: alternates(locale, "/press") };
}

const PHOTOS = [
  { file: "/images/ymfreak-portrait.jpg", w: 1468, h: 1274 },
  { file: "/images/ymfreak-profile.jpg", w: 2048, h: 3072 },
  { file: "/images/ymfreak-seated.jpg", w: 1024, h: 1536 },
];

/** Electronic press kit: copy-ready bios, facts from the dashboard, downloadable logos and photos. */
export default async function PressPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tAll, achievements, credits, contact, yt] = await Promise.all([
    getTranslations("press"),
    getTranslations(),
    getAchievementsVM(locale),
    getPortfolioVM(locale),
    getContactVM(),
    getYoutubeViews(),
  ]);
  const bioShort = tAll("about.p1");
  const bioLong = [tAll("about.p1"), tAll("about.p2"), tAll("about.p3")].join("\n\n");
  const logos = [
    { key: "logo", label: t("logoFull"), preview: <Wordmark className="h-8 w-auto" /> },
    { key: "monogram", label: t("logoShort"), preview: <Monogram className="h-12 w-auto" /> },
  ];

  return (
    <section className="mx-auto max-w-5xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
      <h1 className="type-name text-[clamp(1.9rem,5.2vw,3.6rem)]">{t("title")}</h1>
      <p className="mt-6 max-w-[60ch] text-lg text-bone/85">{t("intro")}</p>

      <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-12">
          <section aria-labelledby="bio-short">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="bio-short" className="type-sub text-2xl">
                {t("bioShort")}
              </h2>
              <CopyButton text={bioShort} label={t("copy")} done={t("copied")} />
            </div>
            <p className="mt-3 max-w-[65ch] leading-relaxed text-bone/90">{bioShort}</p>
          </section>
          <section aria-labelledby="bio-long">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="bio-long" className="type-sub text-2xl">
                {t("bioLong")}
              </h2>
              <CopyButton text={bioLong} label={t("copy")} done={t("copied")} />
            </div>
            <div className="mt-3 grid max-w-[65ch] gap-4 leading-relaxed text-bone/90">
              {bioLong.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
          {credits.length > 0 && (
            <section aria-labelledby="credits">
              <h2 id="credits" className="type-sub text-2xl">
                {t("credits")}
              </h2>
              <ul className="mt-4 divide-y divide-rule border-y border-rule">
                {credits.map((c) => (
                  <li key={c.slug} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                    <span>
                      <span className="font-semibold">{c.title}</span> <span className="text-ash">— {c.artist}</span>
                    </span>
                    <span className="text-sm text-bone/80">
                      {c.credit}
                      {c.year !== null && <span className="num text-ash"> · {c.year}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-6">
          <section className="rounded-xl border border-rule p-5" aria-labelledby="facts">
            <h2 id="facts" className="type-sub text-xl">
              {t("facts")}
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-ash">{t("name")}</dt>
                <dd>YM Freak</dd>
              </div>
              <div>
                <dt className="text-ash">{t("roles")}</dt>
                <dd>{tAll("hero.roles")}</dd>
              </div>
              <div>
                <dt className="text-ash">{t("base")}</dt>
                <dd>{t("baseValue")}</dd>
              </div>
              <div>
                <dt className="text-ash">{t("experience")}</dt>
                <dd>{t("experienceValue")}</dd>
              </div>
              {yt && yt.total > 0 && (
                <div>
                  <dt className="text-ash">{t("views")}</dt>
                  <dd>{t("viewsValue", { count: new Intl.NumberFormat(locale === "es" ? "es-DO" : "en-US").format(yt.total) })}</dd>
                </div>
              )}
              {achievements.length > 0 && (
                <div>
                  <dt className="text-ash">{t("highlights")}</dt>
                  {achievements.map((a) => (
                    <dd key={a.id} className="mt-1 flex gap-2 text-brass">
                      <RecordMark className="mt-1 size-3.5 shrink-0" />
                      <span>
                        {a.title}
                        {a.year !== null && <span className="num"> {a.year}</span>}
                        <span className="block text-bone/75">{a.detail}</span>
                      </span>
                    </dd>
                  ))}
                </div>
              )}
            </dl>
          </section>
          {contact.email && (
            <section className="rounded-xl bg-key p-5">
              <h2 className="type-sub text-xl">{t("contactTitle")}</h2>
              <p className="mt-2 text-sm text-bone/80">{t("contactBody")}</p>
              <a href={`mailto:${contact.email}`} className="mt-2 inline-block break-all underline underline-offset-4">
                {contact.email}
              </a>
            </section>
          )}
        </aside>
      </div>

      <section className="mt-16" aria-labelledby="logos">
        <h2 id="logos" className="type-sub text-2xl">
          {t("logos")}
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {logos.map((l) => (
            <li key={l.key} className="overflow-hidden rounded-xl border border-rule">
              <div className="grid h-36 place-items-center bg-studio-deep text-white">{l.preview}</div>
              <div className="p-4">
                <p className="font-semibold">{l.label}</p>
                <Downloads base={`/press/ymfreak-${l.key}`} t={t} />
              </div>
            </li>
          ))}
          <li className="overflow-hidden rounded-xl border border-rule">
            <div className="grid h-36 place-items-center bg-studio-deep">
              <MonogramTile className="size-20" />
            </div>
            <div className="p-4">
              <p className="font-semibold">{t("logoIcon")}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href="/press/ymfreak-icon.png" download className="underline underline-offset-4">
                  PNG
                </a>
                <a href="/press/ymfreak-icon.svg" download className="underline underline-offset-4">
                  SVG
                </a>
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section className="mt-16" aria-labelledby="photos">
        <h2 id="photos" className="type-sub text-2xl">
          {t("photos")}
        </h2>
        <p className="mt-1 text-sm text-ash">{t("photosNote")}</p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {PHOTOS.map((p) => (
            <li key={p.file}>
              <Image src={p.file} alt="YM Freak" width={p.w} height={p.h} sizes="(min-width: 640px) 30vw, 100vw" className="aspect-[4/5] w-full rounded-xl object-cover" />
              <a href={p.file} download className="mt-2 inline-block text-sm underline underline-offset-4">
                {t("download")} ({p.w}×{p.h})
              </a>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function Downloads({ base, t }: { base: string; t: (k: string) => string }) {
  return (
    <div className="mt-2 grid gap-1 text-sm">
      <p>
        <span className="text-ash">{t("onDark")}: </span>
        <a href={`${base}-light.png`} download className="underline underline-offset-4">
          PNG
        </a>{" "}
        ·{" "}
        <a href={`${base}-light.svg`} download className="underline underline-offset-4">
          SVG
        </a>
      </p>
      <p>
        <span className="text-ash">{t("onLight")}: </span>
        <a href={`${base}-dark.png`} download className="underline underline-offset-4">
          PNG
        </a>{" "}
        ·{" "}
        <a href={`${base}-dark.svg`} download className="underline underline-offset-4">
          SVG
        </a>
      </p>
    </div>
  );
}
