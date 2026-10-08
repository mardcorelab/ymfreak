import { useTranslations } from "next-intl";
import type { ContactVM } from "@/lib/view-models";
import { ButtonAnchor, ButtonLink } from "@/components/ui/ButtonLink";

export function ClosingCta({ contact }: { contact: ContactVM }) {
  const t = useTranslations();

  return (
    <section className="mx-auto max-w-[90rem] px-5 py-28 sm:px-8 lg:px-12 lg:py-36">
      <h2 className="type-name max-w-[14ch] text-[clamp(3.4rem,9vw,8rem)] leading-[0.95]">{t("closing.title")}</h2>
      <p className="mt-8 max-w-[46ch] text-lg text-bone/80">{t("closing.body")}</p>
      <div className="mt-10 flex flex-wrap gap-3">
        {contact.email ? (
          <ButtonAnchor href={`mailto:${contact.email}`}>{t("closing.email", { email: contact.email })}</ButtonAnchor>
        ) : (
          <ButtonLink href="/contact">{t("hero.ctaPrimary")}</ButtonLink>
        )}
        {contact.instagram && (
          <ButtonAnchor href={contact.instagram} variant="line">
            {t("closing.instagram")}
          </ButtonAnchor>
        )}
      </div>
    </section>
  );
}
