import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

const PATHS = ["", "/portfolio", "/services", "/achievements", "/about", "/faq", "/contact", "/book", "/links", "/analyzer", "/privacy", "/terms"];

/** Every public page in both languages, each pointing at its translation. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PATHS.flatMap((path) =>
    (["es", "en"] as const).map((locale) => ({
      url: `${base}/${locale}${path}`,
      changeFrequency: path === "/privacy" || path === "/terms" ? ("yearly" as const) : ("weekly" as const),
      priority: path === "" ? 1 : path === "/privacy" || path === "/terms" ? 0.2 : 0.7,
      alternates: { languages: { es: `${base}/es${path}`, en: `${base}/en${path}`, "x-default": `${base}/es${path}` } },
    })),
  );
}
