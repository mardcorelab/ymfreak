import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/ButtonLink";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <section className="mx-auto flex min-h-[80svh] max-w-[90rem] flex-col justify-center px-5 pt-32 sm:px-8 lg:px-12">
      <h1 className="type-head text-[clamp(2.8rem,6vw,5rem)]">{t("title")}</h1>
      <p className="mt-4 text-lg text-bone/75">{t("body")}</p>
      <div className="mt-8">
        <ButtonLink href="/">{t("home")}</ButtonLink>
      </div>
    </section>
  );
}
