import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitch } from "./LocaleSwitch";

export const NAV_ITEMS = [
  { href: "/portfolio", key: "work" },
  { href: "/services", key: "services" },
  { href: "/achievements", key: "achievements" },
  { href: "/about", key: "about" },
  { href: "/faq", key: "faq" },
  { href: "/contact", key: "contact" },
  { href: "/book", key: "book" },
] as const;

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-bone focus:px-4 focus:py-2 focus:text-studio"
      >
        {t("skip")}
      </a>
      <div className="mx-auto flex max-w-[90rem] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="type-name text-[1.6rem] tracking-[0.02em]" aria-label="YM Freak — inicio">
          YM Freak
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-7 text-[0.95rem] text-bone/80 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-bone">
              {t(item.key)}
            </Link>
          ))}
          <LocaleSwitch label={t("language")} />
        </nav>

        {/* Mobile menu: native <details>, works without JavaScript. */}
        <details className="group relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-full border border-bone/30 px-4 text-sm [&::-webkit-details-marker]:hidden">
            {t("menu")}
          </summary>
          <nav
            aria-label="Principal"
            className="absolute right-0 mt-3 flex w-60 flex-col rounded-2xl border border-rule bg-studio-deep p-2 shadow-2xl shadow-black/50"
          >
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-xl px-4 py-3 hover:bg-white/5">
                {t(item.key)}
              </Link>
            ))}
            <div className="mt-1 border-t border-rule px-4 pb-2 pt-3">
              <LocaleSwitch label={t("language")} />
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}
