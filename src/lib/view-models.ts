/**
 * Plain, already-localised shapes that UI components receive as props.
 * Components never touch the database; pages load data on the server and map
 * it to these types with the helpers in src/server/site-data.ts.
 */

export type Locale = "es" | "en";

export interface ServiceVM {
  slug: string;
  name: string;
  description: string;
  includes: string[];
  /** Already formatted, e.g. "$150". */
  price: string;
  pricingUnit: "FLAT" | "PER_SONG" | "PER_HOUR";
  bookingMode: "DELIVERY" | "SESSION";
  turnaroundDays: number | null;
  sessionMinutes: number | null;
  revisionsIncluded: number;
}

export interface PortfolioVM {
  slug: string;
  title: string;
  artist: string;
  workTypes: string[];
  year: number | null;
  credit: string | null;
  description: string | null;
  coverUrl: string | null;
  embed: { provider: "SPOTIFY" | "YOUTUBE"; id: string } | null;
  externalUrl: string | null;
}

export interface AchievementVM {
  id: string;
  kind: "NOMINATION" | "AWARD" | "CERTIFICATION" | "MILESTONE";
  title: string;
  detail: string;
  year: number | null;
  highlight: boolean;
}

export interface TestimonialVM {
  id: string;
  author: string;
  role: string | null;
  quote: string;
  rating: number | null;
  /** True for reviews written by clients after a completed project. */
  verified: boolean;
}

export interface FaqVM {
  id: string;
  question: string;
  answer: string;
}

export interface ContactVM {
  email: string;
  whatsapp: string;
  instagram: string;
  youtube: string;
  spotify: string;
  tiktok: string;
  other: { label: string; url: string }[];
}

export interface BusinessHoursVM {
  workdayStart: string;
  workdayEnd: string;
  depositPercent: number;
  revisionFee: string;
  cancellationWindowHours: number;
}

export interface NextAvailableVM {
  serviceName: string;
  /** Already formatted, e.g. "miércoles, 14 de octubre". */
  label: string;
}
