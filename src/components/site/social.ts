import type { ContactVM } from "@/lib/view-models";

type T = (key: string, values?: Record<string, string | number>) => string;

export interface SocialLink {
  key: "email" | "instagram" | "youtube" | "spotify" | "tiktok" | "whatsapp" | "other";
  label: string;
  /** Visible handle or address, e.g. "@ymfreak_". */
  display: string;
  href: string;
  anchorProps: { target?: string; rel?: string };
}

const external = { target: "_blank", rel: "noopener noreferrer" };

function handleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    return path.startsWith("@") ? path : `@${path}`;
  } catch {
    return url;
  }
}

/** Only links that are actually configured are returned — empty ones are hidden. */
export function socialLinks(c: ContactVM, t: T): SocialLink[] {
  const links: SocialLink[] = [];
  if (c.email) links.push({ key: "email", label: t("contact.emailLabel"), display: c.email, href: `mailto:${c.email}`, anchorProps: {} });
  if (c.instagram) links.push({ key: "instagram", label: t("contact.instagramLabel"), display: handleFromUrl(c.instagram), href: c.instagram, anchorProps: external });
  if (c.whatsapp) links.push({ key: "whatsapp", label: t("contact.whatsappLabel"), display: `+${c.whatsapp}`, href: `https://wa.me/${c.whatsapp}`, anchorProps: external });
  if (c.youtube) links.push({ key: "youtube", label: t("contact.youtubeLabel"), display: handleFromUrl(c.youtube), href: c.youtube, anchorProps: external });
  if (c.spotify) links.push({ key: "spotify", label: t("contact.spotifyLabel"), display: "Spotify", href: c.spotify, anchorProps: external });
  if (c.tiktok) links.push({ key: "tiktok", label: t("contact.tiktokLabel"), display: handleFromUrl(c.tiktok), href: c.tiktok, anchorProps: external });
  for (const o of c.other) links.push({ key: "other", label: o.label, display: o.label, href: o.url, anchorProps: external });
  return links;
}
