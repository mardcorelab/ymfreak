import "server-only";
import { cache } from "react";
import { getSetting } from "./settings";
import type { PortfolioVM } from "@/lib/view-models";

import { channelIdFromHtml, parseYoutubeFeed, type YoutubeVideo } from "@/lib/youtube-feed";

export type { YoutubeVideo };

async function channelId(channelUrl: string): Promise<string | null> {
  const direct = /youtube\.com\/channel\/(UC[\w-]{22})/.exec(channelUrl)?.[1];
  if (direct) return direct;
  try {
    const res = await fetch(channelUrl, {
      headers: { "accept-language": "en-US,en;q=0.8", "user-agent": "Mozilla/5.0 (compatible; ymfreak.com)" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? channelIdFromHtml(await res.text()) : null;
  } catch {
    return null;
  }
}

/** Latest videos from the YouTube channel set in the dashboard (contact → YouTube). Refreshed every hour. */
export const getYoutubeVideos = cache(async (): Promise<YoutubeVideo[]> => {
  try {
    const contact = await getSetting("contact");
    if (!contact.youtube) return [];
    const id = await channelId(contact.youtube);
    if (!id) return [];
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    return parseYoutubeFeed(await res.text());
  } catch {
    return [];
  }
});

/** Videos shaped like portfolio items, so the same lazy player shows them. */
export function videoToVM(v: YoutubeVideo): PortfolioVM {
  return {
    slug: `yt-${v.id}`,
    title: v.title,
    artist: "YM Freak",
    workTypes: [],
    year: v.published ? Number(v.published.slice(0, 4)) : null,
    credit: null,
    description: null,
    coverUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    embed: { provider: "YOUTUBE", id: v.id },
    externalUrl: v.url || `https://www.youtube.com/watch?v=${v.id}`,
  };
}
