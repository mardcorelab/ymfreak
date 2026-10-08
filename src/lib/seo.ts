import type { Metadata } from "next";
import type { Locale } from "./view-models";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Canonical + hreflang alternates for a path like "/services". */
export function alternates(locale: Locale, path: string): Metadata["alternates"] {
  const clean = path === "/" ? "" : path;
  return {
    canonical: `/${locale}${clean}`,
    languages: { es: `/es${clean}`, en: `/en${clean}`, "x-default": `/es${clean}` },
  };
}

/** schema.org data describing YM Freak, embedded on the home page. */
export function personJsonLd(params: { locale: Locale; sameAs: string[]; email: string; description: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "YM Freak",
    url: `${siteUrl()}/${params.locale}`,
    image: `${siteUrl()}/images/ymfreak-portrait.jpg`,
    jobTitle: ["Music Producer", "Mixing Engineer", "Mastering Engineer"],
    description: params.description,
    ...(params.email ? { email: `mailto:${params.email}` } : {}),
    address: { "@type": "PostalAddress", addressCountry: "DO" },
    sameAs: params.sameAs,
    award: ["Latin Grammy nominee 2026 — Best Merengue-Bachata Album (co-producer)"],
  };
}

/** Serialises JSON-LD safely for a <script> tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
