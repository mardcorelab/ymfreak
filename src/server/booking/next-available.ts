import "server-only";
import { cache } from "react";
import { db } from "../db";
import { quoteDelivery } from "./engine";

import type { NextAvailableVM } from "@/lib/view-models";

export interface NextAvailable extends NextAvailableVM {
  /** YYYY-MM-DD in YM Freak's time zone. */
  deliveryDate: string;
}

/**
 * The earliest real delivery date for the flagship service (the first active
 * delivered service), from the same calendar the booking form uses.
 */
export const getNextAvailable = cache(async (locale: "es" | "en"): Promise<NextAvailable | null> => {
  try {
    const service = await db.service.findFirst({ where: { active: true, bookingMode: "DELIVERY" }, orderBy: { sortOrder: "asc" } });
    if (!service) return null;
    const q = await quoteDelivery({ services: [service.slug], songs: 1, locale });
    if (!q.ok) return null;
    const label = new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${q.deliveryDate}T12:00:00Z`),
    );
    return { serviceName: locale === "es" ? service.nameEs : service.nameEn, deliveryDate: q.deliveryDate, label };
  } catch {
    return null;
  }
});
