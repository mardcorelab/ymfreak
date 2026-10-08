import type { PortfolioVM } from "./view-models";

/** Builds the official embed URL. Ids are validated so nothing else can be injected. */
export function embedUrl(embed: NonNullable<PortfolioVM["embed"]>): string | null {
  if (embed.provider === "SPOTIFY") {
    const match = /^(album|track|playlist)\/([A-Za-z0-9]{22})$/.exec(embed.id);
    return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0&autoplay=1` : null;
  }
  return /^[A-Za-z0-9_-]{11}$/.test(embed.id)
    ? `https://www.youtube-nocookie.com/embed/${embed.id}?autoplay=1&rel=0`
    : null;
}
