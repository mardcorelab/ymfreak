import { useTranslations } from "next-intl";

/** The four real steps of a project, in order — the numbers mean something here. */
export function Process({ depositPercent }: { depositPercent: number }) {
  const t = useTranslations("process");
  const steps = [1, 2, 3, 4] as const;

  return (
    <ol className="grid gap-10 md:grid-cols-4 md:gap-6" data-stagger>
      {steps.map((n) => (
        <li key={n} className="relative border-t border-bone/30 pt-6" data-reveal>
          <span aria-hidden="true" className="absolute -top-[5px] left-0 size-[9px] rounded-full bg-bone" />
          <p className="type-figure num text-5xl text-bone/35">{n}</p>
          <h3 className="type-sub mt-4 text-2xl">{t(`s${n}t`)}</h3>
          <p className="mt-2 text-bone/75">{t(`s${n}d`, { deposit: depositPercent })}</p>
        </li>
      ))}
    </ol>
  );
}
