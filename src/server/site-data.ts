import "server-only";
import { cache } from "react";
import type { Achievement, KnowledgeEntry, PortfolioItem, Service, Testimonial } from "@prisma/client";
import { db } from "./db";
import { getActiveServices } from "./catalog";
import { getSetting } from "./settings";
import { formatMoney } from "./domain/money";
import type {
  AchievementVM,
  BusinessHoursVM,
  ContactVM,
  FaqVM,
  Locale,
  PortfolioVM,
  ServiceVM,
  TestimonialVM,
} from "@/lib/view-models";

/** Read-only loaders for the public site, returning localised view models. */

const pick = <T,>(locale: Locale, es: T, en: T): T => (locale === "es" ? es : en);

export function toServiceVM(s: Service, locale: Locale): ServiceVM {
  return {
    slug: s.slug,
    name: pick(locale, s.nameEs, s.nameEn),
    description: pick(locale, s.descriptionEs, s.descriptionEn),
    includes: pick(locale, s.includesEs, s.includesEn),
    price: formatMoney(s.priceCents, s.currency, locale),
    pricingUnit: s.pricingUnit,
    bookingMode: s.bookingMode,
    turnaroundDays: s.turnaroundDays,
    sessionMinutes: s.sessionMinutes,
    revisionsIncluded: s.revisionsIncluded,
  };
}

export function toPortfolioVM(p: PortfolioItem, locale: Locale): PortfolioVM {
  return {
    slug: p.slug,
    title: p.title,
    artist: p.artist,
    workTypes: p.workTypes,
    year: p.year,
    credit: pick(locale, p.creditEs, p.creditEn),
    description: pick(locale, p.descriptionEs, p.descriptionEn),
    coverUrl: p.coverUrl,
    embed: p.embedProvider && p.embedId ? { provider: p.embedProvider, id: p.embedId } : null,
    externalUrl: p.externalUrl,
  };
}

export function toAchievementVM(a: Achievement, locale: Locale): AchievementVM {
  return {
    id: a.id,
    kind: a.kind,
    title: pick(locale, a.titleEs, a.titleEn),
    detail: pick(locale, a.detailEs, a.detailEn),
    year: a.year,
    highlight: a.highlight,
  };
}

export const getServicesVM = cache(async (locale: Locale) =>
  (await getActiveServices()).map((s) => toServiceVM(s, locale)),
);

export const getPortfolioVM = cache(async (locale: Locale, opts: { featuredOnly?: boolean } = {}) => {
  const rows = await db.portfolioItem.findMany({
    where: { published: true, ...(opts.featuredOnly ? { featured: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { year: "desc" }],
  });
  return rows.map((p) => toPortfolioVM(p, locale));
});

export const getAchievementsVM = cache(async (locale: Locale) => {
  const rows = await db.achievement.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } });
  return rows.map((a) => toAchievementVM(a, locale));
});

export const getTestimonialsVM = cache(async (locale: Locale): Promise<TestimonialVM[]> => {
  const rows: Testimonial[] = await db.testimonial.findMany({ where: { published: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return rows.map((t) => ({
    id: t.id,
    author: t.author,
    role: t.role,
    quote: pick(locale, t.quoteEs, t.quoteEn),
    rating: t.rating,
    verified: t.fromClient && t.bookingId !== null,
  }));
});

export const getFaqVM = cache(async (locale: Locale): Promise<FaqVM[]> => {
  const rows: KnowledgeEntry[] = await db.knowledgeEntry.findMany({
    where: { active: true, kind: { in: ["FAQ", "POLICY", "PROCESS"] } },
    orderBy: { sortOrder: "asc" },
  });
  return rows.flatMap((k) => {
    const question = pick(locale, k.questionEs, k.questionEn);
    return question ? [{ id: k.id, question, answer: pick(locale, k.answerEs, k.answerEn) }] : [];
  });
});

export const getContactVM = cache(async (): Promise<ContactVM> => getSetting("contact"));

export const getBusinessVM = cache(async (locale: Locale): Promise<BusinessHoursVM> => {
  const rules = await getSetting("business_rules");
  return {
    workdayStart: rules.workdayStart,
    workdayEnd: rules.workdayEnd,
    depositPercent: rules.depositPercent,
    revisionFee: formatMoney(rules.revisionFeeCents, "USD", locale),
    cancellationWindowHours: rules.cancellationWindowHours,
  };
});
