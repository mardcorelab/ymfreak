import "server-only";
import { cache } from "react";
import type { Service } from "@prisma/client";
import { db } from "../db";
import type { ServiceRule } from "../domain/types";

/**
 * The single read path for services. The website, the booking flow, checkout
 * and the assistant all call these functions — nobody queries Service directly.
 */
export const getActiveServices = cache(async (): Promise<Service[]> =>
  db.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
);

export const getServiceBySlug = cache(async (slug: string): Promise<Service | null> =>
  db.service.findFirst({ where: { slug, active: true } }),
);

export function toServiceRule(service: Service): ServiceRule {
  if (service.currency !== "USD") throw new Error(`Unsupported currency ${service.currency} on ${service.slug}`);
  return {
    slug: service.slug,
    priceCents: service.priceCents,
    currency: "USD",
    pricingUnit: service.pricingUnit,
    bookingMode: service.bookingMode,
    turnaroundDays: service.turnaroundDays,
    sessionMinutes: service.sessionMinutes,
    revisionsIncluded: service.revisionsIncluded,
    active: service.active,
  };
}

export async function getServiceRuleMap(): Promise<Map<string, ServiceRule>> {
  const services = await getActiveServices();
  return new Map(services.map((s) => [s.slug, toServiceRule(s)]));
}
