import type { ReactNode } from "react";

/** Standard section frame: heading, optional intro, content. */
export function Section({
  id,
  title,
  intro,
  tone = "studio",
  headingLevel = "h2",
  aside,
  children,
}: {
  id?: string;
  title: string;
  intro?: ReactNode;
  tone?: "studio" | "deep" | "key";
  headingLevel?: "h1" | "h2";
  aside?: ReactNode;
  children: ReactNode;
}) {
  const bg = { studio: "bg-studio", deep: "bg-studio-deep", key: "bg-key" }[tone];
  const Heading = headingLevel;

  return (
    <section id={id} className={`${bg} scroll-mt-8`}>
      {/* An h1 section opens an inner page, so it clears the overlaid header. */}
      <div
        className={`mx-auto max-w-[90rem] px-5 py-24 sm:px-8 lg:px-12 lg:py-32 ${headingLevel === "h1" ? "pt-36 lg:pt-44" : ""}`}
      >
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6 lg:mb-16">
          <div>
            <Heading className="type-head text-[clamp(2.8rem,6vw,5rem)]">{title}</Heading>
            {intro && <p className="mt-4 max-w-[56ch] text-lg text-bone/75">{intro}</p>}
          </div>
          {aside}
        </div>
        {children}
      </div>
    </section>
  );
}
