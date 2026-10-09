import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";
import { getSetting } from "@/server/settings";
import { formatMoney } from "@/server/domain/money";
import { LegalPage } from "@/components/legal/LegalPage";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return { title: t("title"), description: t("description"), alternates: alternates(locale, "/privacy") };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [rules, booking, contact] = await Promise.all([getSetting("business_rules"), getSetting("booking"), getSetting("contact")]);
  return (
    <LegalPage
      kind="privacy"
      locale={locale}
      values={{
        email: contact.email,
        deposit: rules.depositPercent,
        hold: booking.holdMinutes,
        fee: formatMoney(rules.revisionFeeCents, "USD", locale),
        hours: rules.cancellationWindowHours,
      }}
    />
  );
}
