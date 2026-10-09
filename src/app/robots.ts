import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { siteHidden } from "@/server/site-visibility";

export const revalidate = 300;

export default async function robots(): Promise<MetadataRoute.Robots> {
  // While the site is hidden, ask search engines to stay away.
  if (await siteHidden()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/es/account", "/en/account", "/es/checkout", "/en/checkout"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
