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
 * (Odesli). Returns [] on any problem; the release page then falls back to
 * the original link.
 */
export async function fetchPlatformLinks(url: string, fetchFn: typeof fetch = fetch): Promise<PlatformLink[]> {
  try {
    const res = await fetchFn(`https://api.song.link/v1-alpha.1/links?userCountry=US&url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { linksByPlatform?: Record<string, { url?: unknown }> };
    const links = body.linksByPlatform ?? {};
    return PLATFORMS.flatMap(({ key }) => {
      const u = links[key]?.url;
      if (typeof u !== "string") return [];
      try {
        const parsed = new URL(u);
        return parsed.protocol === "https:" ? [{ platform: key, url: parsed.toString() }] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
