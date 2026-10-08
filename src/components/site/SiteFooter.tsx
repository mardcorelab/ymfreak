import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ContactVM } from "@/lib/view-models";
import { NAV_ITEMS } from "./SiteHeader";
import { socialLinks } from "./social";

export function SiteFooter({ contact }: { contact: ContactVM }) {
  const t = useTranslations();
  const links = socialLinks(contact, t);

  return (
    <footer className="border-t border-rule bg-studio-deep">
      <div className="mx-auto grid max-w-[90rem] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_auto_auto] lg:gap-24 lg:px-12">
        <div>
          <p className="type-name text-[clamp(3.5rem,9vw,6rem)]">YM Freak</p>
          <p className="mt-4 text-ash">{t("hero.roles")}</p>
        </div>

        <nav aria-label="Footer" className="grid content-start gap-3 text-bone/80">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-bone">
              {t(`nav.${item.key}`)}
            </Link>
          ))}
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
      <p className="mx-auto max-w-[90rem] px-5 pb-10 text-sm text-ash sm:px-8 lg:px-12">
        {t("footer.rights", { year: new Date().getFullYear() })}
      </p>
    </footer>
  );
}
