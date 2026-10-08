"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit, requireAdmin } from "@/server/auth/admin";
import { portfolioSchema } from "@/lib/validators/admin";
import { parseMediaLink } from "@/lib/media-link";
import { checkbox, optionalInt, optionalText, slugify, text } from "@/lib/form-data";
import { fetchCoverUrl, fetchPlatformLinks } from "../media";
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
    platformLinks: platformLinks.length ? platformLinks : Prisma.DbNull,
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
