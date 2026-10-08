/**
 * Shapes of the values stored in the Setting table. Every read goes through
 * these schemas, so a bad edit in the dashboard can never break pricing or
 * scheduling silently.
 */
import { z } from "zod";

const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const businessRulesSchema = z
  .object({
    timeZone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone"),
    workingWeekdays: z.array(z.number().int().min(1).max(7)).min(1),
    workdayStart: localTime,
    workdayEnd: localTime,
    dailyProjectStarts: z.number().int().min(1).max(50),
    leadWorkingDays: z.number().int().min(0).max(30),
    sessionLeadHours: z.number().int().min(0).max(24 * 14),
    depositPercent: z.number().int().min(0).max(100),
    revisionFeeCents: z.number().int().min(0),
    cancellationWindowHours: z.number().int().min(0).max(24 * 30),
  })
  .refine((r) => r.workdayStart < r.workdayEnd, { message: "workdayEnd must be after workdayStart", path: ["workdayEnd"] });

const optionalUrl = z.union([z.literal(""), z.string().url().startsWith("https://")]);

export const contactSchema = z.object({
  email: z.union([z.literal(""), z.string().email()]),
  /** Digits only, with country code, e.g. 18095551234. */
  whatsapp: z.union([z.literal(""), z.string().regex(/^\d{8,15}$/, "Digits only, with country code")]),
  instagram: optionalUrl,
  youtube: optionalUrl,
  spotify: optionalUrl,
  tiktok: optionalUrl,
  other: z.array(z.object({ label: z.string().min(1).max(40), url: z.string().url().startsWith("https://") })).max(10),
});

export const paymentSettingsSchema = z.object({
  provider: z.enum(["paypal"]),
  paypalAccountEmail: z.string().email(),
});

export const SETTING_SCHEMAS = {
  business_rules: businessRulesSchema,
  contact: contactSchema,
  payment: paymentSettingsSchema,
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;

export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return SETTING_SCHEMAS[key].parse(value) as SettingValue<K>;
}
