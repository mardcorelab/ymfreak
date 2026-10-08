"use server";

import { db } from "@/server/db";
import { audit, requireAdmin } from "@/server/auth/admin";
import { businessRulesSchema, contactSchema, parseSetting } from "@/server/settings/schemas";
import { checkbox, dollarsToCents, optionalInt, text } from "@/lib/form-data";
import { invalid, refreshSite, type ActionState } from "../common";

const SOCIAL = ["instagram", "youtube", "spotify", "tiktok"] as const;

export async function saveContact(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const current = await db.setting.findUnique({ where: { key: "contact" } });
  const other = current ? parseSetting("contact", current.value).other : [];

  const parsed = contactSchema.safeParse({
    email: text(fd, "email").toLowerCase(),
    whatsapp: text(fd, "whatsapp").replace(/[^\d]/g, ""),
    ...Object.fromEntries(SOCIAL.map((k) => [k, text(fd, k)])),
    other,
  });
  if (!parsed.success) return invalid(parsed.error);

  await db.setting.upsert({ where: { key: "contact" }, update: { value: parsed.data }, create: { key: "contact", value: parsed.data } });
  await audit("settings.contact", "Setting", "contact", parsed.data);
  refreshSite();
  return { status: "ok", message: "Contacto actualizado." };
}

export async function saveBusinessRules(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const current = await db.setting.findUnique({ where: { key: "business_rules" } });
  const base = current ? parseSetting("business_rules", current.value) : null;

  const parsed = businessRulesSchema.safeParse({
    timeZone: base?.timeZone ?? "America/Santo_Domingo",
    workingWeekdays: [1, 2, 3, 4, 5, 6, 7].filter((d) => checkbox(fd, `day${d}`)),
    workdayStart: text(fd, "workdayStart"),
    workdayEnd: text(fd, "workdayEnd"),
    dailyProjectStarts: optionalInt(fd, "dailyProjectStarts"),
    leadWorkingDays: optionalInt(fd, "leadWorkingDays"),
    sessionLeadHours: optionalInt(fd, "sessionLeadHours"),
    depositPercent: optionalInt(fd, "depositPercent"),
    revisionFeeCents: dollarsToCents(text(fd, "revisionFee")),
    cancellationWindowHours: optionalInt(fd, "cancellationWindowHours"),
  });
  if (!parsed.success) return invalid(parsed.error);

  await db.setting.upsert({
    where: { key: "business_rules" },
    update: { value: parsed.data },
    create: { key: "business_rules", value: parsed.data },
  });
  await audit("settings.business_rules", "Setting", "business_rules", parsed.data);
  refreshSite();
  return { status: "ok", message: "Reglas del negocio actualizadas." };
}
