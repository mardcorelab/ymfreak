import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/es/dashboard", "/en/dashboard", "/es/portal", "/en/portal"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
