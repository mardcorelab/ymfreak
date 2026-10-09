import { getTranslations } from "next-intl/server";
import { Slogan, Wordmark } from "@/components/brand/Logo";
import { getSetting } from "@/server/settings";

/** Shown to visitors while the site is hidden from the dashboard. Not indexed by search engines. */
export async function ComingSoon({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "comingSoon" });
  const contact = await getSetting("contact").catch(() => null);
  const links = [
    contact?.email ? { href: `mailto:${contact.email}`, label: t("email") } : null,
    contact?.instagram ? { href: contact.instagram, label: t("instagram") } : null,
    contact?.whatsapp ? { href: `https://wa.me/${contact.whatsapp}`, label: t("whatsapp") } : null,
    contact?.youtube ? { href: contact.youtube, label: t("youtube") } : null,
  ].filter((l): l is { href: string; label: string } => l !== null);

  return (
    <main className="grid min-h-dvh place-items-center bg-studio-deep px-6 py-16 text-center" data-testid="coming-soon">
      <meta name="robots" content="noindex, nofollow" />
      <div className="w-full max-w-xl">
        <Wordmark className="mx-auto h-auto w-[min(80%,26rem)]" title="YM Freak" />
        <Slogan className="mx-auto mt-4 h-auto w-[min(70%,22rem)] text-bone/85" />
        <p className="mt-12 text-xs font-semibold tracking-[0.3em] text-ash uppercase">{t("eyebrow")}</p>
        <h1 className="type-head mt-3 text-2xl sm:text-3xl">{t("title")}</h1>
        <p className="mt-4 text-ash">{t("text")}</p>
        {links.length > 0 && (
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  target={l.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-full border border-rule-key px-5 text-sm hover:border-bone/60 hover:bg-bone/5"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
