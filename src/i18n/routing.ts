import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  // Spanish lives at /es, English at /en; "/" redirects by browser language.
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
