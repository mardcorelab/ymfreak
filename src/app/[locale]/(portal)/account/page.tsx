import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { currentClient } from "@/server/portal/session";
import { getClientBookings } from "@/server/portal/data";
import { signOutClient } from "@/server/portal/actions";
import { LoginForm } from "@/components/portal/PortalForms";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("title"), description: t("metaDescription"), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tc, client] = await Promise.all([getTranslations("account"), getTranslations("checkout"), currentClient()]);

  if (!client) {
    return (
      <section className="mx-auto max-w-3xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
        <h1 className="type-name text-[clamp(1.9rem,5.2vw,3.6rem)]">{t("loginTitle")}</h1>
        <p className="mt-6 max-w-[56ch] text-lg text-bone/85">{t("loginIntro")}</p>
        <LoginForm locale={locale} />
        <p className="mt-12 text-ash">
          {t("noBooking")}{" "}
          <Link href="/book" className="text-bone underline underline-offset-4">
            {t("bookNow")}
          </Link>
        </p>
      </section>
    );
  }

  const bookings = await getClientBookings(client.id, locale);
  return (
    <section className="mx-auto max-w-4xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="type-name text-[clamp(1.8rem,5vw,3.4rem)]">{t("hello", { name: client.name.split(" ")[0] ?? client.name })}</h1>
        <form action={signOutClient}>
          <input type="hidden" name="locale" value={locale} />
          <button className="min-h-11 rounded-full border border-bone/30 px-5 text-sm hover:border-bone">{t("signOut")}</button>
        </form>
      </div>
      <p className="mt-6 max-w-[60ch] text-lg text-bone/85">{t("intro")}</p>

      {bookings.length === 0 ? (
        <div className="mt-10">
          <p className="text-ash">{t("empty")}</p>
          <div className="mt-6">
            <ButtonLink href="/book">{t("bookNow")}</ButtonLink>
          </div>
        </div>
      ) : (
        <ul className="mt-12 grid gap-4">
          {bookings.map((b) => (
            <li key={b.code} className="rounded-xl border border-rule p-5 sm:p-6" data-booking={b.code}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="num text-sm text-ash">
                    {b.code} · {t("booked", { date: b.createdAt })}
                  </p>
                  <h2 className="type-sub mt-1 text-2xl">{b.title}</h2>
                  <p className="mt-1 text-bone/80">{b.services}</p>
                </div>
                <span className="inline-flex shrink-0 rounded-full border border-rule px-3 py-1 text-sm" data-status={b.status}>
                  {tc(`status.${b.status}`)}
                </span>
              </div>
              {b.when && (
                <p className="mt-4 text-sm">
                  <span className="text-ash">{b.when.kind === "delivery" ? t("delivery") : t("session")}: </span>
                  <span className="first-letter:uppercase">{b.when.label}</span>
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/account/${b.code}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-bone px-5 text-sm font-semibold text-studio hover:bg-white"
                >
                  {t("open")}
                </Link>
                {b.due && b.checkoutPath && (
                  <a href={b.checkoutPath} className="inline-flex min-h-11 items-center rounded-full border border-bone/40 px-5 text-sm hover:bg-bone/5">
                    {t("payDue", { amount: b.due.amount })}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
