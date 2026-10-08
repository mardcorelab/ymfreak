import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";
import { getServiceBySlug } from "@/server/catalog";
import { formatMoney } from "@/server/domain/money";
import { agentAvailable } from "@/server/agent/model";
import { Analyzer } from "@/components/analyzer/Analyzer";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analyzer" });
  return { title: t("title"), description: t("metaDescription"), alternates: alternates(locale, "/analyzer") };
}

/** Free loudness analyzer: a useful tool for artists that leads to the mastering service. */
export default async function AnalyzerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, mastering] = await Promise.all([getTranslations("analyzer"), getServiceBySlug("mastering")]);
  return (
    <section className="mx-auto max-w-4xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
      <h1 className="type-name text-[clamp(3.2rem,8vw,6rem)] leading-[0.95]">{t("title")}</h1>
      <p className="mt-6 max-w-[60ch] text-lg text-bone/85">{t("intro")}</p>
      <div className="mt-10">
        <Analyzer masteringPrice={mastering ? formatMoney(mastering.priceCents, "USD", locale) : null} agent={agentAvailable()} />
      </div>
    </section>
  );
}
