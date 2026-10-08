import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { ContactView } from "@/components/views/ContactView";
import { getBusinessVM, getContactVM } from "@/server/site-data";
import { alternates } from "@/lib/seo";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("contact"), description: t("contactDescription"), alternates: alternates(locale, "/contact") };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [contact, business] = await Promise.all([getContactVM(), getBusinessVM(locale)]);
  return <ContactView contact={contact} business={business} />;
}
