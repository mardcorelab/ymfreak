import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { About } from "@/components/sections/About";
import { ClosingCta } from "@/components/sections/ClosingCta";
import { getContactVM } from "@/server/site-data";
import { alternates } from "@/lib/seo";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("about"), description: t("aboutDescription"), alternates: alternates(locale, "/about") };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const contact = await getContactVM();

  return (
    <>
      <section className="bg-key">
        <div className="mx-auto max-w-[90rem] px-5 pt-32 sm:px-8 lg:px-12 lg:pt-40">
          <About headingLevel="h1" />
        </div>
      </section>
      <ClosingCta contact={contact} />
    </>
  );
}
