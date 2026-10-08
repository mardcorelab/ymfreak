import { useTranslations } from "next-intl";
import type { AchievementVM, BusinessHoursVM, ContactVM, PortfolioVM, ServiceVM, TestimonialVM } from "@/lib/view-models";
import { Hero } from "@/components/sections/Hero";
import { Credits } from "@/components/sections/Credits";
import { Section } from "@/components/sections/Section";
import { WorkGrid } from "@/components/sections/WorkGrid";
import { ServiceList } from "@/components/sections/ServiceList";
import { Highlights } from "@/components/sections/Highlights";
import { About } from "@/components/sections/About";
import { Process } from "@/components/sections/Process";
import { Testimonials } from "@/components/sections/Testimonials";
import { ClosingCta } from "@/components/sections/ClosingCta";
import { ButtonLink } from "@/components/ui/ButtonLink";

export interface HomeData {
  featured: PortfolioVM[];
  services: ServiceVM[];
  achievements: AchievementVM[];
  testimonials: TestimonialVM[];
  contact: ContactVM;
  business: BusinessHoursVM;
}

export function HomeView({ data }: { data: HomeData }) {
  const t = useTranslations();

  return (
    <>
      <Hero />
      <Credits achievements={data.achievements} />

      <Section
        id="trabajos"
        title={t("work.title")}
        intro={t("work.intro")}
        aside={
          <ButtonLink href="/portfolio" variant="line">
            {t("work.all")}
          </ButtonLink>
        }
      >
        <WorkGrid items={data.featured} />
        {data.featured.some((f) => f.embed?.provider === "SPOTIFY") && (
          <p className="mt-10 text-sm text-ash">{t("work.embedNote")}</p>
        )}
      </Section>

      <Section
        id="servicios"
        tone="deep"
        title={t("services.title")}
        intro={t("services.intro", { deposit: data.business.depositPercent })}
      >
        <ServiceList services={data.services} business={data.business} />
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
          <ButtonLink href="/contact">{t("services.cta")}</ButtonLink>
          <ButtonLink href="/services" variant="line">
            {t("services.all")}
          </ButtonLink>
        </div>
      </Section>

      {data.achievements.length > 0 && (
        <Section id="logros" title={t("highlights.title")}>
          <Highlights achievements={data.achievements} />
        </Section>
      )}

      <section className="bg-key">
        <div className="mx-auto max-w-[90rem] px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28">
          <About />
        </div>
      </section>

      <Section title={t("process.title")}>
        <Process depositPercent={data.business.depositPercent} />
      </Section>

      <Testimonials items={data.testimonials} />
      <div className="border-t border-rule">
        <ClosingCta contact={data.contact} />
      </div>
    </>
  );
}
