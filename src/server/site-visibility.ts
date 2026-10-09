import "server-only";
import { cache } from "react";
import { db } from "./db";
import { siteSettingsSchema } from "./settings/schemas";
import { draftMode } from "next/headers";

/** True while YM Freak keeps the public site hidden. Never throws (a database hiccup shows the site). */
export const siteHidden = cache(async (): Promise<boolean> => {
  try {
    const row = await db.setting.findUnique({ where: { key: "site" } });
    const parsed = row ? siteSettingsSchema.safeParse(row.value) : null;
    return parsed?.success ? parsed.data.hidden : false;
  } catch {
    return false;
  }
});

/**
 * "public": normal site. "coming-soon": hidden, visitor sees the coming-soon page.
 * "preview": hidden, but the signed-in owner sees the real site with a banner.
 * The owner's preview uses Next's draft mode (enabled when he signs in to the
 * panel, or from /api/admin/preview): its cookie can't be forged and, unlike the
 * session cookie, reading it keeps the public pages cacheable.
 */
export async function siteGate(): Promise<"public" | "coming-soon" | "preview"> {
  if (!(await siteHidden())) return "public";
  return (await draftMode()).isEnabled ? "preview" : "coming-soon";
}
