import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Section } from "@/components/sections/Section";
import { WorkGrid } from "@/components/sections/WorkGrid";
import { getPortfolioVM } from "@/server/site-data";
import { alternates } from "@/lib/seo";
import { getYoutubeViews } from "@/server/youtube-stats";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("portfolio"), description: t("portfolioDescription"), alternates: alternates(locale, "/portfolio") };
}

export default async function PortfolioPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [items, t, yt] = await Promise.all([getPortfolioVM(locale), getTranslations("work"), getYoutubeViews()]);
  const views = yt ? Object.fromEntries(yt.releases.map((r) => [r.slug, r.views])) : undefined;

  return (
    <Section headingLevel="h1" title={t("title")} intro={t("intro")}>
      <WorkGrid items={items} views={views} compact />
      {items.some((i) => i.embed?.provider === "SPOTIFY") && <p className="mt-10 text-sm text-ash">{t("embedNote")}</p>}
    </Section>
  );
}
