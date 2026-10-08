/** Pure helpers for YouTube's public channel feed (unit-tested). */

export interface YoutubeVideo {
  id: string;
  title: string;
  published: string;
  url: string;
  short: boolean;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** Parses YouTube's public channel feed (Atom). Pure, unit-tested. */
export function parseYoutubeFeed(xml: string): YoutubeVideo[] {
  const entries = xml.split("<entry>").slice(1);
  return entries.flatMap((e) => {
    const id = /<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/.exec(e)?.[1];
    const title = /<title>([\s\S]*?)<\/title>/.exec(e)?.[1];
    const url = /<link rel="alternate" href="([^"]+)"/.exec(e)?.[1] ?? "";
    const published = /<published>([^<]+)<\/published>/.exec(e)?.[1] ?? "";
    if (!id || !title) return [];
    return [{ id, title: decode(title.trim()), published, url: decode(url), short: url.includes("/shorts/") }];
  });
}

/** The channel id (UC…) from a channel URL, reading the channel page when the URL is a @handle. */
export function channelIdFromHtml(html: string): string | null {
  return (
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(html)?.[1] ??
    /"externalId":"(UC[\w-]{22})"/.exec(html)?.[1] ??
    /<meta itemprop="identifier" content="(UC[\w-]{22})"/.exec(html)?.[1] ??
    null
  );
}

