import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Section } from "@/components/sections/Section";
import { ButtonAnchor, ButtonLink } from "@/components/ui/ButtonLink";
import { getContactVM, getFaqVM } from "@/server/site-data";
import { alternates, jsonLdScript } from "@/lib/seo";

export const revalidate = 60;
type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("faq"), description: t("faqDescription"), alternates: alternates(locale, "/faq") };
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [faq, contact, t] = await Promise.all([getFaqVM(locale), getContactVM(), getTranslations("faq")]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };

  return (
    <Section headingLevel="h1" title={t("title")} intro={t("intro")}>
      {faq.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />}
      {faq.length === 0 ? (
        <p className="text-ash">{t("empty")}</p>
      ) : (
        <div className="max-w-3xl divide-y divide-rule border-y border-rule">
          {faq.map((f) => (
            <details key={f.id} className="group py-2">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-3 type-sub text-xl [&::-webkit-details-marker]:hidden">
                {f.question}
                <span aria-hidden="true" className="text-2xl text-ash transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-[62ch] pb-5 text-bone/80">{f.answer}</p>
            </details>
          ))}
        </div>
      )}
      <div className="mt-12">
        {contact.email ? (
          <ButtonAnchor href={`mailto:${contact.email}`}>{t("contact")}</ButtonAnchor>
        ) : (
          <ButtonLink href="/contact">{t("contact")}</ButtonLink>
        )}
      </div>
    </Section>
  );
}
