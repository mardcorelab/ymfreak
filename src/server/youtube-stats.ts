import "server-only";
import { cache } from "react";
import { db } from "./db";
import { youtubeRefs } from "@/lib/youtube-refs";

/**
 * Real YouTube view counts for the releases in the portfolio, from the
 * official YouTube Data API (needs YOUTUBE_API_KEY). Counted per release:
 * its YouTube video, or every video of its album playlist. Refreshed hourly.
 */
export interface ReleaseViews {
  slug: string;
  title: string;
  views: number;
  videos: number;
}
export interface YoutubeViews {
  total: number;
  releases: ReleaseViews[];
  /** When the numbers were read. */
  at: string;
}

const API = "https://www.googleapis.com/youtube/v3";
const HOUR = 3600;

function key(): string | null {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

export function youtubeViewsConfigured(): boolean {
  return key() !== null;
}

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: key()! });
  const res = await fetch(`${API}/${path}?${qs}`, { next: { revalidate: HOUR }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function playlistVideos(listId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 4; page++) {
    const r = await api<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }>("playlistItems", {
      part: "contentDetails",
      playlistId: listId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const it of r.items ?? []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  return ids;
}

async function videoViews(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const r = await api<{ items?: { id: string; statistics?: { viewCount?: string } }[] }>("videos", { part: "statistics", id: ids.slice(i, i + 50).join(",") });
    for (const it of r.items ?? []) out.set(it.id, Number(it.statistics?.viewCount ?? 0));
  }
  return out;
}

function linksOf(item: { embedProvider: string | null; embedId: string | null; platformLinks: unknown }): string[] {
  const urls: string[] = [];
  if (item.embedProvider === "YOUTUBE" && item.embedId) urls.push(`https://www.youtube.com/watch?v=${item.embedId}`);
  if (Array.isArray(item.platformLinks)) {
    for (const l of item.platformLinks as { platform?: string; url?: string }[]) {
      if ((l?.platform === "youtube" || l?.platform === "youtubeMusic") && typeof l.url === "string") urls.push(l.url);
    }
  }
  return urls;
}

async function load(): Promise<YoutubeViews | { error: string }> {
  const items = await db.portfolioItem.findMany({
    where: { published: true },
    select: { slug: true, title: true, embedProvider: true, embedId: true, platformLinks: true },
    orderBy: { sortOrder: "asc" },
  });
  // Videos per release (a video counted once per release, even if linked twice).
  const perRelease = new Map<string, Set<string>>();
  for (const it of items) {
    const refs = youtubeRefs(linksOf(it));
    const vids = new Set(refs.videos);
    for (const list of refs.playlists) for (const v of await playlistVideos(list)) vids.add(v);
    if (vids.size) perRelease.set(it.slug, vids);
  }
  const all = [...new Set([...perRelease.values()].flatMap((s) => [...s]))];
  const views = await videoViews(all);
  const releases: ReleaseViews[] = items
    .filter((it) => perRelease.has(it.slug))
    .map((it) => {
      const vids = [...perRelease.get(it.slug)!];
      return { slug: it.slug, title: it.title, videos: vids.length, views: vids.reduce((s, v) => s + (views.get(v) ?? 0), 0) };
    });
  // A video shared by two releases is counted once in the total.
  const total = all.reduce((s, v) => s + (views.get(v) ?? 0), 0);
  return { total, releases, at: new Date().toISOString() };
}

/** For the public pages: null when not configured or on any problem (the number simply doesn't show). */
export const getYoutubeViews = cache(async (): Promise<YoutubeViews | null> => {
  if (!key()) return null;
  try {
    const r = await Promise.race([load(), new Promise<{ error: string }>((res) => setTimeout(() => res({ error: "timeout" }), 12000))]);
    return "error" in r ? null : r;
  } catch (e) {
    console.warn("[youtube-stats]", e);
    return null;
  }
});

/** For the dashboard: the numbers, or why they can't be read. */
export async function youtubeViewsStatus(): Promise<{ ok: true; data: YoutubeViews } | { ok: false; reason: string }> {
  if (!key()) return { ok: false, reason: "Falta YOUTUBE_API_KEY en Vercel." };
  try {
    const r = await Promise.race([load(), new Promise<{ error: string }>((res) => setTimeout(() => res({ error: "YouTube no respondió a tiempo." }), 12000))]);
    return "error" in r ? { ok: false, reason: r.error } : { ok: true, data: r };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason: /403/.test(msg) ? "YouTube rechazó la clave: revisa que la «YouTube Data API v3» esté activada y que la clave permita usarla." : msg.slice(0, 160),
    };
  }
}
