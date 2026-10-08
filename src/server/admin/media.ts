import "server-only";
import type { MediaLink } from "@/lib/media-link";

/**
 * Returns the release cover from the platform itself: Spotify's oEmbed
 * thumbnail or YouTube's standard thumbnail. Returns null on any problem;
 * a missing cover never blocks saving.
 */
export async function fetchCoverUrl(media: MediaLink): Promise<string | null> {
  if (media.provider === "YOUTUBE") return `https://i.ytimg.com/vi/${media.id}/hqdefault.jpg`;
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(media.url)}`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { thumbnail_url?: unknown };
    const url = typeof body.thumbnail_url === "string" ? new URL(body.thumbnail_url) : null;
    return url && url.protocol === "https:" && url.hostname === "i.scdn.co" ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface PlatformLink {
  platform: string;
  url: string;
}

/** Platforms shown on release pages, in this order. */
export const PLATFORMS: { key: string; label: string }[] = [
  { key: "spotify", label: "Spotify" },
  { key: "appleMusic", label: "Apple Music" },
  { key: "youtubeMusic", label: "YouTube Music" },
  { key: "youtube", label: "YouTube" },
  { key: "amazonMusic", label: "Amazon Music" },
  { key: "tidal", label: "Tidal" },
  { key: "deezer", label: "Deezer" },
  { key: "soundcloud", label: "SoundCloud" },
  { key: "audiomack", label: "Audiomack" },
];

/**
 * Finds the same release on every streaming platform through song.link
 * (Odesli). Never throws: on a problem it returns no links and says why.
 */
export async function lookupPlatformLinks(url: string, fetchFn: typeof fetch = fetch): Promise<{ links: PlatformLink[]; error: string | null }> {
  // song.link's public API now needs a key (SONGLINK_API_KEY); without it, links are added by hand.
  const key = process.env.SONGLINK_API_KEY?.trim();
  if (!key) return { links: [], error: "La búsqueda automática necesita una clave de song.link (SONGLINK_API_KEY)" };
  try {
    const res = await fetchFn(`https://api.song.link/v1-alpha.1/links?userCountry=US&key=${encodeURIComponent(key)}&url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) return { links: [], error: "song.link rechazó la clave (SONGLINK_API_KEY)" };
    if (!res.ok) return { links: [], error: `song.link respondió ${res.status}` };
    const body = (await res.json()) as { linksByPlatform?: Record<string, { url?: unknown }> };
    const found = body.linksByPlatform ?? {};
    const links = PLATFORMS.flatMap(({ key }) => {
      const u = found[key]?.url;
      if (typeof u !== "string") return [];
      try {
        const parsed = new URL(u);
        return parsed.protocol === "https:" ? [{ platform: key, url: parsed.toString() }] : [];
      } catch {
        return [];
      }
    });
    return { links, error: links.length ? null : "song.link no encontró este lanzamiento en otras plataformas" };
  } catch (e) {
    return { links: [], error: e instanceof Error && e.name === "TimeoutError" ? "song.link tardó demasiado" : "No se pudo contactar con song.link" };
  }
}

export async function fetchPlatformLinks(url: string, fetchFn: typeof fetch = fetch): Promise<PlatformLink[]> {
  if (!process.env.SONGLINK_API_KEY) return [];
  const r = await lookupPlatformLinks(url, fetchFn);
  if (r.error) console.warn("[media] platform links:", r.error, url);
  return r.links;
}

/** Host each platform's links must be on (hand-entered links are checked against it). */
export const PLATFORM_HOSTS: Record<string, RegExp> = {
  spotify: /(^|\.)spotify\.com$/,
  appleMusic: /(^|\.)music\.apple\.com$/,
  youtubeMusic: /^music\.youtube\.com$/,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/,
  amazonMusic: /(^|\.)music\.amazon\.[a-z.]+$|(^|\.)amazon\.[a-z.]+$/,
  tidal: /(^|\.)tidal\.com$/,
  deezer: /(^|\.)deezer\.(com|page\.link)$/,
  soundcloud: /(^|\.)soundcloud\.com$/,
  audiomack: /(^|\.)audiomack\.com$/,
};
