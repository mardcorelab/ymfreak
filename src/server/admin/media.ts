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
