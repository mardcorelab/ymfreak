import { getTranslations } from "next-intl/server";

/** Plain, readable legal page: numbered sections from the "legal" messages. */
export async function LegalPage({ kind, values, locale }: { kind: "privacy" | "terms"; values: Record<string, string | number>; locale: "es" | "en" }) {
  const t = await getTranslations("legal");
  const updated = new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date("2026-10-08T12:00:00Z"),
  );
  return (
    <article className="mx-auto max-w-3xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
      <h1 className="type-name text-[clamp(1.9rem,5.2vw,3.6rem)]">{t(`${kind}.title`)}</h1>
      <p className="mt-4 text-sm text-ash">{t("updated", { date: updated })}</p>
      <p className="mt-8 max-w-[62ch] text-lg text-bone/90">{t(`${kind}.intro`)}</p>
      <ol className="mt-12 grid gap-10">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <li key={n} className="grid gap-2 sm:grid-cols-[3rem_1fr]">
            <span className="num text-ash">{String(n).padStart(2, "0")}</span>
            <div>
              <h2 className="type-sub text-2xl">{t(`${kind}.s${n}t`)}</h2>
              <p className="mt-2 max-w-[62ch] leading-relaxed text-bone/85">{t(`${kind}.s${n}`, values)}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
