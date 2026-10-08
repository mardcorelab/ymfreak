import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Section } from "@/components/sections/Section";
import { ServiceList } from "@/components/sections/ServiceList";
import { Process } from "@/components/sections/Process";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getBusinessVM, getServicesVM } from "@/server/site-data";
import { alternates } from "@/lib/seo";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("services"), description: t("servicesDescription"), alternates: alternates(locale, "/services") };
}

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [services, business, t] = await Promise.all([getServicesVM(locale), getBusinessVM(locale), getTranslations()]);

  return (
    <>
      <Section
        headingLevel="h1"
        title={t("services.title")}
        intro={t("services.intro", { deposit: business.depositPercent })}
      >
        <ServiceList services={services} business={business} detailed />
        <p className="mt-8 text-ash">{t("services.combine")}</p>
        <div className="mt-10">
          <ButtonLink href="/book">{t("services.cta")}</ButtonLink>
        </div>
      </Section>
      <Section tone="deep" title={t("process.title")}>
        <Process depositPercent={business.depositPercent} />
      </Section>
    </>
  );
}
