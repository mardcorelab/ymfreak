import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Section } from "@/components/sections/Section";
import { Highlights } from "@/components/sections/Highlights";
import { getAchievementsVM } from "@/server/site-data";
import { alternates } from "@/lib/seo";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("achievements"), description: t("achievementsDescription"), alternates: alternates(locale, "/achievements") };
}

export default async function AchievementsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [achievements, t] = await Promise.all([getAchievementsVM(locale), getTranslations("highlights")]);

  return (
    <Section headingLevel="h1" title={t("title")}>
      <Highlights achievements={achievements} />
    </Section>
  );
}
