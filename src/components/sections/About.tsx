import Image from "next/image";
import { useTranslations } from "next-intl";
import seated from "../../../public/images/ymfreak-seated.jpg";

/**
 * The one "lit" section: its background is the lighter backdrop of the seated
 * portrait, so the photo sits on the page without a frame.
 */
export function About({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const t = useTranslations("about");
  const Heading = headingLevel;

  return (
    <div className="grid items-end gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
      <div className="relative mx-auto aspect-[2/3] w-full max-w-md md:max-w-none">
        <Image
          src={seated}
          alt={t("photoAlt")}
          placeholder="blur"
          fill
          sizes="(min-width: 768px) 45vw, 100vw"
          className="object-cover [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,black_78%,transparent),linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]"
        />
      </div>
      <div className="pb-4 md:pb-16">
        <Heading className="type-head text-[clamp(2.8rem,6vw,5rem)]">{t("title")}</Heading>
        <div className="mt-8 max-w-[58ch] space-y-5 text-lg text-bone/85">
          <p>{t("p1")}</p>
          <p>{t("p2")}</p>
          <p>{t("p3")}</p>
        </div>
      </div>
    </div>
  );
}
