/**
 * Turns a Spotify or YouTube link pasted in the dashboard into the provider +
 * id the site stores. Anything else is rejected, so only official players can
 * ever be embedded.
 */
export type MediaLink =
  | { provider: "SPOTIFY"; id: string; url: string }
  | { provider: "YOUTUBE"; id: string; url: string };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseMediaLink(input: string): MediaLink | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "open.spotify.com") {
    // Optional locale prefix: /intl-es/album/<id>
    const p = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
    const [kind, id] = p;
    if ((kind === "album" || kind === "track") && id && SPOTIFY_ID.test(id)) {
      return { provider: "SPOTIFY", id: `${kind}/${id}`, url: `https://open.spotify.com/${kind}/${id}` };
    }
    return null;
  }

  let ytId: string | null = null;
  if (host === "youtu.be") ytId = parts[0] ?? null;
  else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (parts[0] === "watch") ytId = url.searchParams.get("v");
    else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") ytId = parts[1] ?? null;
  }
  if (ytId && YOUTUBE_ID.test(ytId)) {
    return { provider: "YOUTUBE", id: ytId, url: `https://www.youtube.com/watch?v=${ytId}` };
  }
  return null;
}

/** Rebuilds the public link for a stored provider + id (used to pre-fill the edit form). */
export function mediaLinkUrl(provider: "SPOTIFY" | "YOUTUBE" | null, id: string | null): string {
  if (!provider || !id) return "";
  return provider === "SPOTIFY" ? `https://open.spotify.com/${id}` : `https://www.youtube.com/watch?v=${id}`;
}
