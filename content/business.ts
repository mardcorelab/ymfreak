/**
 * INITIAL DATA ONLY — seeded into the Setting table, then edited from the dashboard.
 */
import type { BusinessRules } from "../src/server/domain/types";

export const businessRulesSeed: BusinessRules = {
  timeZone: "America/Santo_Domingo",
  workingWeekdays: [1, 2, 3, 4, 5], // Monday–Friday
  workdayStart: "08:00",
  workdayEnd: "18:00",
  dailyProjectStarts: 2,
  leadWorkingDays: 1,
  sessionLeadHours: 12,
  depositPercent: 50,
  revisionFeeCents: 2000,
  cancellationWindowHours: 24,
};

/**
 * Public links. Leave a value empty until you have the real URL — empty links
 * are hidden on the site and never mentioned by the assistant.
 */
export const contactSeed = {
  email: "",
  whatsapp: "",
  instagram: "",
  youtube: "",
  spotify: "",
  tiktok: "",
  other: [] as { label: string; url: string }[],
};

/** Payment account reference shown in the dashboard only. Credentials live in env vars. */
export const paymentSeed = {
  provider: "paypal" as const,
  paypalAccountEmail: "davianmd@gmail.com",
};
