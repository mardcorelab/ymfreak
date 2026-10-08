import { useTranslations } from "next-intl";
import type { TestimonialVM } from "@/lib/view-models";

/** Renders nothing until real, published testimonials exist. */
export function Testimonials({ items }: { items: TestimonialVM[] }) {
  const t = useTranslations("testimonials");
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[90rem] px-5 py-24 sm:px-8 lg:px-12">
      <h2 className="type-head text-[clamp(2.4rem,5vw,4rem)]">{t("title")}</h2>
      <ul className="mt-12 grid gap-12 md:grid-cols-2">
        {items.map((q) => (
          <li key={q.id}>
            <figure>
              <blockquote className="type-sub text-2xl leading-snug">“{q.quote}”</blockquote>
              <figcaption className="mt-4 text-ash">
                {q.author}
                {q.role && <>, {q.role}</>}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
