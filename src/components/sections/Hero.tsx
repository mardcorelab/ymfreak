import Image from "next/image";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import profile from "../../../public/images/ymfreak-profile.jpg";

/**
 * The portrait's backdrop is the page colour, so the photo is masked into the
 * page rather than framed. YM Freak looks left, toward his name.
 */
export function Hero() {
  const t = useTranslations("hero");

  return (
    <section className="relative isolate overflow-hidden bg-studio">
      {/* Portrait */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[68svh] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-[54%]">
        <Image
          src={profile}
          alt={t("photoAlt")}
          priority
          placeholder="blur"
          sizes="(min-width: 1024px) 54vw, 100vw"
          className="animate-settle h-full w-full object-cover object-[50%_18%] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] lg:[mask-image:linear-gradient(to_right,transparent,black_28%,black_80%,transparent),linear-gradient(to_bottom,black_75%,transparent)] lg:[mask-composite:intersect]"
        />
      </div>

      <div className="mx-auto flex min-h-[100svh] max-w-[90rem] flex-col justify-end px-5 pb-14 pt-[52svh] sm:px-8 lg:px-12 lg:pb-20 lg:pt-40">
        <p className="animate-fade text-sm text-bone/75 [animation-delay:500ms] sm:text-base">{t("roles")}</p>

        <h1 className="type-name mt-4 text-[clamp(6.5rem,24vw,20rem)]">
          <span className="block overflow-hidden pb-[0.04em]">
            <span className="animate-rise block [animation-delay:120ms]">YM</span>
          </span>
          <span className="block overflow-hidden pb-[0.04em]">
            <span className="animate-rise block [animation-delay:240ms]">Freak</span>
          </span>
        </h1>

        <div className="animate-fade mt-8 max-w-xl [animation-delay:700ms]">
          <p className="type-sub text-[clamp(1.6rem,3.2vw,2.4rem)]">{t("tagline")}</p>
          <p className="mt-4 max-w-[46ch] text-bone/75">{t("lede")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/book">{t("ctaPrimary")}</ButtonLink>
            <ButtonLink href="/#trabajos" variant="line">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
