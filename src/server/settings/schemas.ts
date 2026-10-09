/**
 * Shapes of the values stored in the Setting table. Every read goes through
 * these schemas, so a bad edit in the dashboard can never break pricing or
 * scheduling silently.
 */
import { z } from "zod";

const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario: usa el formato HH:mm, por ejemplo 08:00");
const int = (label: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${label}: escribe un número entero`, required_error: `${label}: obligatorio` })
    .int(`${label}: escribe un número entero`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);

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
    workingWeekdays: z.array(z.number().int().min(1).max(7)).min(1, "Días laborables: elige al menos uno"),
    workdayStart: localTime,
    workdayEnd: localTime,
    dailyProjectStarts: int("Proyectos nuevos por día", 1, 50),
    leadWorkingDays: int("Días antes de empezar", 0, 30),
    sessionLeadHours: int("Horas de antelación para sesiones", 0, 24 * 14),
    depositPercent: int("Depósito (%)", 0, 100),
    revisionFeeCents: z
      .number({ invalid_type_error: "Revisión adicional: escribe un monto válido, por ejemplo 20" })
      .int("Revisión adicional: monto no válido")
      .min(0, "Revisión adicional: no puede ser negativo"),
    cancellationWindowHours: int("Horas para cancelar", 0, 24 * 30),
  })
  .refine((r) => r.workdayStart < r.workdayEnd, { message: "Horario: la hora de cierre debe ser posterior a la de inicio", path: ["workdayEnd"] });

const optionalUrl = (label: string) =>
  z.union([z.literal(""), z.string().url(`${label}: enlace no válido`).startsWith("https://", `${label}: debe empezar por https://`)], {
    errorMap: () => ({ message: `${label}: pega el enlace completo, empezando por https://` }),
  });

export const contactSchema = z.object({
  email: z.union([z.literal(""), z.string().email()], { errorMap: () => ({ message: "Correo: no es una dirección válida" }) }),
  /** Digits only, with country code, e.g. 18095551234. */
  whatsapp: z.union([z.literal(""), z.string().regex(/^\d{8,15}$/)], {
    errorMap: () => ({ message: "WhatsApp: escribe el número con código de país, por ejemplo 18095551234" }),
  }),
  instagram: optionalUrl("Instagram"),
  youtube: optionalUrl("YouTube"),
  spotify: optionalUrl("Spotify"),
  tiktok: optionalUrl("TikTok"),
  other: z.array(z.object({ label: z.string().min(1).max(40), url: z.string().url().startsWith("https://") })).max(10),
});

export const paymentSettingsSchema = z.object({
  provider: z.enum(["paypal"]),
  paypalAccountEmail: z.string().email(),
});

/** Public booking switch: off until online payment is live, so nobody books without paying. */
export const bookingSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Minutes a slot/capacity is held while the client pays the deposit. */
  holdMinutes: z.number().int().min(10).max(24 * 60),
});

/** The assistant's name and YM Freak's own guidance on how it should talk and sell. */
export const agentSettingsSchema = z.object({
  name: z.string().trim().max(30, "Nombre: máximo 30 caracteres"),
  notes: z.string().trim().max(4000, "Instrucciones: máximo 4000 caracteres"),
});

/** Hides the public site behind a "coming soon" page while YM Freak polishes it (he still sees everything signed in). */
export const siteSettingsSchema = z.object({
  hidden: z.boolean(),
});

export const SETTING_SCHEMAS = {
  business_rules: businessRulesSchema,
  contact: contactSchema,
  payment: paymentSettingsSchema,
  booking: bookingSettingsSchema,
  agent: agentSettingsSchema,
  site: siteSettingsSchema,
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_SCHEMAS)[K]>;

export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return SETTING_SCHEMAS[key].parse(value) as SettingValue<K>;
}
