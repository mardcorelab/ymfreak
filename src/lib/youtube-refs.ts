/**
 * Finds YouTube videos and playlists (albums on YouTube Music are playlists)
 * in a list of links. Pure, unit-tested.
 */
export interface YoutubeRefs {
  videos: string[];
  playlists: string[];
}

const VIDEO = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST = /^[A-Za-z0-9_-]{10,64}$/;

export function youtubeRefs(urls: (string | null | undefined)[]): YoutubeRefs {
  const videos = new Set<string>();
  const playlists = new Set<string>();
  for (const raw of urls) {
    if (!raw) continue;
    let u: URL;
    try {
      u = new URL(raw.trim());
    } catch {
      continue;
    }
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0] ?? "";
      if (VIDEO.test(id)) videos.add(id);
      continue;
    }
    if (host !== "youtube.com" && host !== "music.youtube.com" && host !== "youtube-nocookie.com") continue;
    const v = u.searchParams.get("v");
    const path = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname)?.[1];
    const list = u.searchParams.get("list");
    if (v && VIDEO.test(v)) videos.add(v);
    else if (path) videos.add(path);
    else if (list && PLAYLIST.test(list)) playlists.add(list);
  }
  return { videos: [...videos], playlists: [...playlists] };
}

/** "1,2 M" style numbers for display, with the exact figure kept for titles. */
export function compactNumber(n: number, locale: "es" | "en"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-DO" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
