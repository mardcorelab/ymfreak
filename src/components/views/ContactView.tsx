import Image from "next/image";
import { useTranslations } from "next-intl";
import type { BusinessHoursVM, ContactVM } from "@/lib/view-models";
import { socialLinks } from "@/components/site/social";
import portrait from "../../../public/images/ymfreak-portrait.jpg";

export function ContactView({ contact, business }: { contact: ContactVM; business: BusinessHoursVM }) {
  const t = useTranslations();
  const links = socialLinks(contact, t);

  return (
    <section className="mx-auto grid max-w-[90rem] gap-12 px-5 pb-24 pt-36 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20 lg:px-12 lg:pb-32 lg:pt-44">
      <div>
        <h1 className="type-name text-[clamp(1.9rem,5.2vw,3.6rem)]">{t("contact.title")}</h1>
        <p className="mt-8 max-w-[52ch] text-lg text-bone/80">{t("contact.intro")}</p>

        <ul className="mt-12 divide-y divide-rule border-y border-rule">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                {...l.anchorProps}
                className="group flex min-h-16 items-center justify-between gap-6 py-4 transition-colors hover:text-white"
              >
                <span className="text-ash">{l.label}</span>
                <span className="type-sub text-right text-[clamp(1.25rem,2.4vw,1.75rem)] underline decoration-transparent underline-offset-[6px] transition-colors group-hover:decoration-bone/60">
                  {l.display}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-ash">{t("contact.hours", { start: business.workdayStart, end: business.workdayEnd })}</p>
        <p className="mt-2 text-ash">{t("contact.bookingSoon")}</p>
      </div>

      <div className="relative hidden aspect-[1468/1274] self-end lg:block">
        <Image
          src={portrait}
          alt=""
          placeholder="blur"
          fill
          sizes="40vw"
          className="object-cover [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_78%)]"
        />
      </div>
    </section>
  );
}
