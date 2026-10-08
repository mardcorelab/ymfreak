import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { toPortfolioVM } from "./site-data";
import { fetchPlatformLinks, PLATFORMS, type PlatformLink } from "./admin/media";
import type { Locale, PortfolioVM } from "@/lib/view-models";

export interface ReleaseVM extends PortfolioVM {
  links: { platform: string; label: string; url: string }[];
}

function asLinks(value: unknown): PlatformLink[] {
  if (!Array.isArray(value)) return [];
  return value.filter((l): l is PlatformLink => typeof l?.platform === "string" && typeof l?.url === "string" && l.url.startsWith("https://"));
}

/**
 * One release with its links on every platform. Links found through song.link
 * are stored the first time, so later visits never wait on it.
 */
export const getRelease = cache(async (slug: string, locale: Locale): Promise<ReleaseVM | null> => {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const item = await db.portfolioItem.findFirst({ where: { slug, published: true } });
  if (!item) return null;

  let links = asLinks(item.platformLinks);
  if (links.length === 0 && item.externalUrl) {
    links = await fetchPlatformLinks(item.externalUrl);
    if (links.length) {
      await db.portfolioItem
        .update({ where: { id: item.id }, data: { platformLinks: links as unknown as Prisma.InputJsonValue } })
        .catch(() => null);
    }
  }
  if (links.length === 0 && item.externalUrl) {
    links = [{ platform: item.embedProvider === "YOUTUBE" ? "youtube" : "spotify", url: item.externalUrl }];
  }
  return {
    ...toPortfolioVM(item, locale),
    links: PLATFORMS.flatMap((p) => links.filter((l) => l.platform === p.key).map((l) => ({ platform: p.key, label: p.label, url: l.url }))),
  };
});

/** Published releases for the link-in-bio page: featured first. */
export const getLinkReleases = cache(async (locale: Locale): Promise<PortfolioVM[]> => {
  const rows = await db.portfolioItem.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { year: "desc" }],
    take: 3,
  });
  return rows.map((p) => toPortfolioVM(p, locale));
});
