import { useTranslations } from "next-intl";
import type { AchievementVM, BusinessHoursVM, ContactVM, NextAvailableVM, PortfolioVM, ServiceVM, TestimonialVM } from "@/lib/view-models";
import { Hero } from "@/components/sections/Hero";
import { Credits } from "@/components/sections/Credits";
import { Section } from "@/components/sections/Section";
import { WorkGrid } from "@/components/sections/WorkGrid";
import { ServiceCards } from "@/components/sections/ServiceCards";
import { ServiceGuide } from "@/components/sections/ServiceGuide";
import { Highlights } from "@/components/sections/Highlights";
import { About } from "@/components/sections/About";
import { Process } from "@/components/sections/Process";
import { Testimonials } from "@/components/sections/Testimonials";
import { ClosingCta } from "@/components/sections/ClosingCta";
import { ButtonAnchor, ButtonLink } from "@/components/ui/ButtonLink";
import { VideoGrid } from "@/components/sections/VideoGrid";
import { SongTimeline } from "@/components/motion/SongTimeline";

export interface HomeData {
  featured: PortfolioVM[];
  services: ServiceVM[];
  achievements: AchievementVM[];
  testimonials: TestimonialVM[];
  contact: ContactVM;
  business: BusinessHoursVM;
  nextAvailable: NextAvailableVM | null;
  videos: PortfolioVM[];
  youtubeViews: { total: number; bySlug: Record<string, number> } | null;
}

export function HomeView({ data }: { data: HomeData }) {
  const t = useTranslations();
  const parts = [
    { id: "inicio", label: t("timeline.intro") },
    { id: "trabajos", label: t("timeline.work") },
    ...(data.videos.length > 0 ? [{ id: "youtube", label: t("timeline.videos") }] : []),
    { id: "servicios", label: t("timeline.services") },
    ...(data.achievements.length > 0 ? [{ id: "logros", label: t("timeline.highlights") }] : []),
    { id: "sobre-mi", label: t("timeline.about") },
    { id: "proceso", label: t("timeline.process") },
    ...(data.testimonials.length > 0 ? [{ id: "opiniones", label: t("timeline.reviews") }] : []),
    { id: "outro", label: t("timeline.outro") },
  ];

  return (
    <>
      <SongTimeline parts={parts} label={t("timeline.label")} />
      <Hero nextAvailable={data.nextAvailable} />
      <Credits achievements={data.achievements} youtubeViews={data.youtubeViews?.total ?? null} />

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
        <WorkGrid items={data.featured} views={data.youtubeViews?.bySlug} />
        {data.featured.some((f) => f.embed?.provider === "SPOTIFY") && (
          <p className="mt-10 text-sm text-ash">{t("work.embedNote")}</p>
        )}
      </Section>

      {data.videos.length > 0 && (
        <Section
          id="youtube"
          title={t("youtube.title")}
          intro={t("youtube.intro")}
          aside={
            data.contact.youtube ? (
              <ButtonAnchor href={data.contact.youtube} variant="line">
                {t("youtube.subscribe")}
              </ButtonAnchor>
            ) : undefined
          }
        >
          <VideoGrid items={data.videos} />
        </Section>
      )}

      <Section
        id="servicios"
        tone="deep"
        title={t("services.title")}
        intro={t("services.introHome")}
      >
        <ServiceGuide services={data.services} />
        <ServiceCards services={data.services} />
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
          <ButtonLink href="/book">{t("services.cta")}</ButtonLink>
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

      <section id="sobre-mi" className="scroll-mt-8 bg-key">
        <div className="mx-auto max-w-[90rem] px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28">
          <About />
        </div>
      </section>

      <Section id="proceso" title={t("process.title")}>
        <Process depositPercent={data.business.depositPercent} />
      </Section>

      <div id="opiniones" className="scroll-mt-8">
        <Testimonials items={data.testimonials} />
      </div>
      <div id="outro" className="scroll-mt-8 border-t border-rule">
        <ClosingCta contact={data.contact} />
      </div>
    </>
  );
}
