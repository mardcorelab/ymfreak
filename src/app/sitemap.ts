import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

const PATHS = ["", "/portfolio", "/services", "/achievements", "/about", "/faq", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PATHS.map((path) => ({
    url: `${base}/es${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
    alternates: { languages: { es: `${base}/es${path}`, en: `${base}/en${path}` } },
  }));
}
