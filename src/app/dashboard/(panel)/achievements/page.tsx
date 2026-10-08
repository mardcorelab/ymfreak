import Link from "next/link";
import { db } from "@/server/db";
import { NewLink, Notice, PageHeader } from "@/components/admin/PageHeader";
import { KIND_LABEL } from "./AchievementForm";

export default async function AchievementsAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { saved, deleted } = await searchParams;
  const items = await db.achievement.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader
        title="Logros"
        description="Nominaciones, premios y certificaciones. Los marcados como destacados aparecen en la franja bajo la portada."
        actions={<NewLink href="/dashboard/achievements/new" label="Añadir logro" />}
      />
      {saved && <Notice>Logro añadido.</Notice>}
      {deleted && <Notice>Logro eliminado.</Notice>}
      <ul className="divide-y divide-rule border-y border-rule">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/dashboard/achievements/${a.id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-white/[0.02]">
              <span>
                <span className="font-medium">{a.titleEs}</span>
                <span className="block text-sm text-ash">
                  {KIND_LABEL[a.kind]}
                  {a.year ? `, ${a.year}` : ""}
                </span>
              </span>
              <span className="flex gap-2 text-xs text-ash">
                {a.highlight && <span className="rounded-full border border-brass/50 px-2 py-0.5 text-brass">Destacado</span>}
                {!a.published && <span className="rounded-full border border-rule px-2 py-0.5">Oculto</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
