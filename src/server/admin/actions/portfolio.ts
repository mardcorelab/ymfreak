"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit, requireAdmin } from "@/server/auth/admin";
import { portfolioSchema } from "@/lib/validators/admin";
import { parseMediaLink } from "@/lib/media-link";
import { checkbox, optionalInt, optionalText, slugify, text } from "@/lib/form-data";
import { fetchCoverUrl, fetchPlatformLinks, lookupPlatformLinks, PLATFORM_HOSTS, PLATFORMS, type PlatformLink } from "../media";
import { failure, invalid, refreshSite, type ActionState } from "../common";

export async function savePortfolioItem(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();

  const linkInput = text(fd, "link");
  const media = linkInput ? parseMediaLink(linkInput) : null;
  if (linkInput && !media) {
    return failure("Enlace: pega un enlace de un álbum o canción de Spotify, o de un video de YouTube.");
  }

  const parsed = portfolioSchema.safeParse({
    title: text(fd, "title"),
    artist: text(fd, "artist"),
    creditEs: optionalText(fd, "creditEs"),
    creditEn: optionalText(fd, "creditEn"),
    year: optionalInt(fd, "year"),
    descriptionEs: optionalText(fd, "descriptionEs"),
    descriptionEn: optionalText(fd, "descriptionEn"),
    coverUrl: optionalText(fd, "coverUrl"),
    featured: checkbox(fd, "featured"),
    published: checkbox(fd, "published"),
    sortOrder: optionalInt(fd, "sortOrder") ?? 0,
  });
  if (!parsed.success) return invalid(parsed.error);

  // Use the platform's own cover when none was given.
  const coverUrl = parsed.data.coverUrl ?? (media ? await fetchCoverUrl(media) : null);
  // The same release on every platform, for its release page (ymfreak.com/r/…).
  const platformLinks = media ? await fetchPlatformLinks(media.url) : [];
  const data = {
    ...parsed.data,
    coverUrl,
    embedProvider: media?.provider ?? null,
    embedId: media?.id ?? null,
    externalUrl: media?.url ?? null,
    platformLinks: platformLinks.length ? (platformLinks as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
  };

  if (id) {
    if (!(await db.portfolioItem.findUnique({ where: { id }, select: { id: true } }))) return failure("Este trabajo ya no existe.");
    await db.portfolioItem.update({ where: { id }, data });
    await audit("portfolio.update", "PortfolioItem", id, { ...data, platformLinks: platformLinks.length });
    refreshSite();
    return { status: "ok", message: "Cambios guardados." };
  }

  const base = slugify(`${data.title}-${data.artist}`) || "trabajo";
  let slug = base;
  for (let i = 2; await db.portfolioItem.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  const created = await db.portfolioItem.create({ data: { ...data, slug } });
  await audit("portfolio.create", "PortfolioItem", created.id, { ...data, platformLinks: platformLinks.length });
  refreshSite();
  redirect("/dashboard/portfolio?saved=1");
}

export async function deletePortfolioItem(id: string): Promise<void> {
  await requireAdmin();
  await db.portfolioItem.delete({ where: { id } }).catch(() => null);
  await audit("portfolio.delete", "PortfolioItem", id);
  refreshSite();
  redirect("/dashboard/portfolio?deleted=1");
}

/** Looks the release up again on every platform (for its page at /r/…) and says what was found. */
export async function refreshPlatformLinks(id: string, _prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  const item = await db.portfolioItem.findUnique({ where: { id } });
  if (!item) return failure("Este trabajo ya no existe.");
  if (!item.externalUrl) return failure("Primero pega el enlace de Spotify o YouTube del lanzamiento.");
  const { links, error } = await lookupPlatformLinks(item.externalUrl);
  if (!links.length) return failure(`${error ?? "No se encontraron enlaces"}. La página del lanzamiento seguirá mostrando el enlace original.`);
  await db.portfolioItem.update({ where: { id }, data: { platformLinks: links as unknown as Prisma.InputJsonValue } });
  await audit("portfolio.platform_links", "PortfolioItem", id, { count: links.length });
  refreshSite();
  const names = links.map((l) => PLATFORMS.find((p) => p.key === l.platform)?.label ?? l.platform).join(", ");
  return { status: "ok", message: `Encontrado en: ${names}.` };
}

/** Saves the platform links typed by hand (empty fields remove that platform). */
export async function savePlatformLinks(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const item = await db.portfolioItem.findUnique({ where: { id }, select: { id: true } });
  if (!item) return failure("Este trabajo ya no existe.");
  const links: PlatformLink[] = [];
  const errors: string[] = [];
  for (const p of PLATFORMS) {
    const raw = text(fd, `pl_${p.key}`);
    if (!raw) continue;
    let url: URL | null = null;
    try {
      url = new URL(raw);
    } catch {
      url = null;
    }
    if (!url || url.protocol !== "https:" || !PLATFORM_HOSTS[p.key]!.test(url.hostname)) {
      errors.push(`${p.label}: pega un enlace de ${p.label} que empiece por https://`);
      continue;
    }
    links.push({ platform: p.key, url: url.toString() });
  }
  if (errors.length) return { status: "error", errors };
  await db.portfolioItem.update({ where: { id }, data: { platformLinks: links.length ? (links as unknown as Prisma.InputJsonValue) : Prisma.DbNull } });
  await audit("portfolio.platform_links", "PortfolioItem", id, { count: links.length });
  refreshSite();
  return { status: "ok", message: links.length ? `Guardado: ${links.length} plataformas.` : "Enlaces quitados." };
}
