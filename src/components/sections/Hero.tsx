import Image from "next/image";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Slogan, Wordmark } from "@/components/brand/Logo";
import type { NextAvailableVM } from "@/lib/view-models";
import profile from "../../../public/images/ymfreak-profile.jpg";

/**
 * The portrait's backdrop is the page colour, so the photo is masked into the
 * page rather than framed. YM Freak looks left, toward his name.
 */
export function Hero({ nextAvailable }: { nextAvailable: NextAvailableVM | null }) {
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
          quality={90}
          sizes="(min-width: 1024px) 54vw, 100vw"
          className="animate-settle h-full w-full object-cover object-[50%_18%] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] lg:[mask-image:linear-gradient(to_right,transparent,black_28%,black_80%,transparent),linear-gradient(to_bottom,black_75%,transparent)] lg:[mask-composite:intersect]"
        />
      </div>

      <div className="mx-auto flex min-h-[100svh] max-w-[90rem] flex-col justify-end px-5 pb-14 pt-[52svh] sm:px-8 lg:px-12 lg:pb-20 lg:pt-40">
        <p className="animate-fade text-sm text-bone/75 [animation-delay:500ms] sm:text-base">{t("roles")}</p>

        <h1 className="mt-5">
          <span className="sr-only">YM Freak</span>
          <span className="block overflow-hidden pb-[0.5%]">
            <Wordmark className="animate-rise block h-auto w-[min(100%,62rem)] lg:w-[min(40vw,44rem)] [animation-delay:150ms]" />
          </span>
        </h1>
        <p className="animate-fade mt-[clamp(0.75rem,1.6vw,1.4rem)] [animation-delay:450ms]">
          <Slogan className="block h-auto w-[min(100%,62rem)] text-bone/90 lg:w-[min(40vw,44rem)]" />
        </p>

        <div className="animate-fade mt-8 max-w-xl [animation-delay:700ms]">
          <p className="max-w-[46ch] text-bone/75">{t("lede")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/book">{t("ctaPrimary")}</ButtonLink>
            <ButtonLink href="/#trabajos" variant="line">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
          {nextAvailable && (
            <p className="mt-6 flex items-center gap-2.5 text-sm text-bone/80" data-testid="next-available">
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <span>
                {t("nextAvailable", { date: nextAvailable.label })} <span className="text-ash">· {nextAvailable.serviceName}</span>
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
