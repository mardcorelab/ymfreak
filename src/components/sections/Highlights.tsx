import { useTranslations } from "next-intl";
import type { AchievementVM } from "@/lib/view-models";
import { RecordMark } from "@/components/ui/RecordMark";

const KIND_KEY = {
  NOMINATION: "nomination",
  CERTIFICATION: "certification",
  AWARD: "award",
  MILESTONE: "milestone",
} as const;

/** Career highlights: large, quiet, one per row — the brass is the only colour. */
export function Highlights({ achievements }: { achievements: AchievementVM[] }) {
  const t = useTranslations("highlights");
  if (achievements.length === 0) return null;

  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {achievements.map((a) => (
        <li key={a.id} className="grid gap-4 py-10 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10 md:py-14">
          <div className="flex items-center gap-3 text-brass md:block">
            <RecordMark className="size-10 md:size-14" />
            <p className="text-sm md:mt-4">
              {t(KIND_KEY[a.kind])}
              {a.year !== null && <span className="num">, {a.year}</span>}
            </p>
          </div>
          <div>
            <h3 className="type-head text-[clamp(1.6rem,3.6vw,2.8rem)]">{a.title}</h3>
            <p className="mt-3 max-w-[52ch] text-lg text-bone/80">{a.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
