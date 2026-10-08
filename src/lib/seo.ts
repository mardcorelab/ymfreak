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

/** schema.org ProfessionalService with one Offer per active service (prices from the database). */
export function servicesJsonLd(params: {
  locale: Locale;
  services: { name: string; description: string; priceCents: number; unit: "FLAT" | "PER_SONG" | "PER_HOUR" }[];
}) {
  const unitText = { FLAT: "piece", PER_SONG: "song", PER_HOUR: "hour" } as const;
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "YM Freak",
    url: `${siteUrl()}/${params.locale}/services`,
    image: `${siteUrl()}/images/ymfreak-portrait.jpg`,
    areaServed: "Worldwide",
    address: { "@type": "PostalAddress", addressCountry: "DO" },
    founder: { "@type": "Person", name: "YM Freak" },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: params.locale === "es" ? "Servicios" : "Services",
      itemListElement: params.services.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.name, description: s.description },
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: (s.priceCents / 100).toFixed(2),
          priceCurrency: "USD",
          unitText: unitText[s.unit],
        },
      })),
    },
  };
}
