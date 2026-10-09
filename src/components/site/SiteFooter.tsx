import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ContactVM } from "@/lib/view-models";
import { NAV_ITEMS } from "./SiteHeader";
import { socialLinks } from "./social";
import { Slogan, Wordmark } from "@/components/brand/Logo";

export function SiteFooter({ contact }: { contact: ContactVM }) {
  const t = useTranslations();
  const links = socialLinks(contact, t);

  return (
    <footer className="border-t border-rule bg-studio-deep">
      <div className="mx-auto grid max-w-[90rem] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_auto_auto] lg:gap-24 lg:px-12">
        <div>
          <Wordmark title="YM Freak" className="h-auto w-[min(100%,26rem)]" />
          <Slogan className="mt-3 h-auto w-[min(100%,26rem)] text-bone/70" />
          <p className="mt-4 text-ash">{t("hero.roles")}</p>
        </div>

        <nav aria-label="Footer" className="grid content-start gap-3 text-bone/80">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-bone">
              {t(`nav.${item.key}`)}
            </Link>
          ))}
          <Link href="/analyzer" className="hover:text-bone">
            {t("analyzer.navLabel")}
          </Link>
          <Link href="/press" className="hover:text-bone">
            {t("nav.press")}
          </Link>
        </nav>

        {links.length > 0 && (
          <div className="grid content-start gap-3">
            <p className="text-ash">{t("footer.follow")}</p>
            {links.map((l) => (
              <a key={l.href} href={l.href} className="text-bone/80 hover:text-bone" {...l.anchorProps}>
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-6 gap-y-2 px-5 pb-10 text-sm text-ash sm:px-8 lg:px-12">
        <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
        <Link href="/terms" className="hover:text-bone">
          {t("legal.footerTerms")}
        </Link>
        <Link href="/privacy" className="hover:text-bone">
          {t("legal.footerPrivacy")}
        </Link>
      </div>
    </footer>
  );
}
