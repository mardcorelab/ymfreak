import { useTranslations } from "next-intl";
import type { TestimonialVM } from "@/lib/view-models";

/** Renders nothing until real, published testimonials exist. */
export function Testimonials({ items }: { items: TestimonialVM[] }) {
  const t = useTranslations("testimonials");
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[90rem] px-5 py-24 sm:px-8 lg:px-12">
      <h2 className="type-head text-[clamp(1.6rem,3.6vw,2.8rem)]">{t("title")}</h2>
      <ul className="mt-12 grid gap-12 md:grid-cols-2">
        {items.map((q) => (
          <li key={q.id}>
            <figure>
              {q.rating !== null && (
                <p className="mb-3 text-lg tracking-widest text-brass" aria-label={t("stars", { count: q.rating })}>
                  {"★".repeat(q.rating)}
                  <span className="text-bone/20">{"★".repeat(5 - q.rating)}</span>
                </p>
              )}
              <blockquote className="type-sub text-2xl leading-snug">“{q.quote}”</blockquote>
              <figcaption className="mt-4 text-ash">
                {q.author}
                {q.role && <>, {q.role}</>}
                {q.verified && <span className="ml-2 rounded-full border border-rule px-2 py-0.5 text-xs">{t("verified")}</span>}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
