import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { BookingForm } from "@/components/booking/BookingForm";
import { ButtonAnchor } from "@/components/ui/ButtonLink";
import { currentAdmin } from "@/server/auth/admin";
import { getSetting } from "@/server/settings";
import { getBusinessVM, getContactVM, getServicesVM } from "@/server/site-data";
import { alternates } from "@/lib/seo";
import { toLocalDate } from "@/server/domain/calendar";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: AppLocale }>; searchParams: Promise<{ service?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("book"), description: t("bookDescription"), alternates: alternates(locale, "/book") };
}

export default async function BookPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { service } = await searchParams;
  setRequestLocale(locale);

  const [t, booking, rules, admin, contact, business, services] = await Promise.all([
    getTranslations("book"),
    getSetting("booking"),
    getSetting("business_rules"),
    currentAdmin(),
    getContactVM(),
    getBusinessVM(locale),
    getServicesVM(locale),
  ]);
  const open = booking.enabled || admin !== null;

  return (
    <section className="mx-auto max-w-[90rem] px-5 pb-24 pt-36 sm:px-8 lg:px-12 lg:pb-32 lg:pt-44">
      <h1 className="type-name text-[clamp(1.9rem,5.2vw,3.6rem)]">{t("title")}</h1>

      {!open ? (
        <>
          <p className="mt-8 max-w-[52ch] text-lg text-bone/80">{t("closed")}</p>
          {contact.email && (
            <div className="mt-8">
              <ButtonAnchor href={`mailto:${contact.email}`}>{t("closedCta")}</ButtonAnchor>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-8 max-w-[56ch] text-lg text-bone/80">{t("intro", { deposit: business.depositPercent })}</p>
          {!booking.enabled && (
            <p role="note" className="mt-6 max-w-[62ch] rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm">
              {t("adminPreview")}
            </p>
          )}
          <BookingForm
            services={services}
            business={business}
            initialService={service ?? null}
            today={toLocalDate(new Date(), rules.timeZone)}
            timeZone={rules.timeZone}
          />
        </>
      )}
    </section>
  );
}
