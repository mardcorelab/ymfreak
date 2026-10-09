import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { HomeView } from "@/components/views/HomeView";
import {
  getAchievementsVM,
  getBusinessVM,
  getContactVM,
  getPortfolioVM,
  getServicesVM,
  getTestimonialsVM,
} from "@/server/site-data";
import { alternates, jsonLdScript, personJsonLd } from "@/lib/seo";
import { getNextAvailable } from "@/server/booking/next-available";
import { getYoutubeVideos, videoToVM } from "@/server/youtube";
import { getYoutubeViews } from "@/server/youtube-stats";

// Content changes from the dashboard should show up within a minute.
export const revalidate = 60;

type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternates(locale, "/") };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [featured, services, achievements, testimonials, contact, business, t, nextAvailable, videos, ytViews] = await Promise.all([
    getPortfolioVM(locale, { featuredOnly: true }),
    getServicesVM(locale),
    getAchievementsVM(locale),
    getTestimonialsVM(locale),
    getContactVM(),
    getBusinessVM(locale),
    getTranslations({ locale, namespace: "meta" }),
    getNextAvailable(locale),
    getYoutubeVideos(),
    getYoutubeViews(),
  ]);

  const sameAs = [contact.instagram, contact.youtube, contact.spotify, contact.tiktok].filter(Boolean);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(personJsonLd({ locale, sameAs, email: contact.email, description: t("description") })),
        }}
      />
      <HomeView data={{ featured, services, achievements, testimonials, contact, business, nextAvailable: nextAvailable ? { serviceName: nextAvailable.serviceName, label: nextAvailable.label } : null, videos: videos.filter((v) => !v.short).slice(0, 3).map(videoToVM), youtubeViews: ytViews ? { total: ytViews.total, bySlug: Object.fromEntries(ytViews.releases.map((r) => [r.slug, r.views])) } : null }} />
    </>
  );
}
