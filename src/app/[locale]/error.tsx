"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
      <h1 className="type-name text-[clamp(3.4rem,8vw,6rem)] leading-[0.95]">{t("title")}</h1>
      <p className="mt-6 max-w-[56ch] text-lg text-bone/85">{t("body")}</p>
      {error.digest && <p className="num mt-2 text-xs text-ash">Ref. {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={reset} className="inline-flex min-h-12 items-center rounded-full bg-bone px-6 font-semibold text-studio hover:bg-white">
          {t("retry")}
        </button>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-full border border-bone/40 px-6 hover:bg-bone/5">
          {t("home")}
        </Link>
      </div>
    </section>
  );
}
