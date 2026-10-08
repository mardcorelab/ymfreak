import Link from "next/link";
import { db } from "@/server/db";
import { NewLink, Notice, PageHeader } from "@/components/admin/PageHeader";
import { KNOWLEDGE_KIND } from "./KnowledgeForm";

export default async function KnowledgeAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { saved, deleted } = await searchParams;
  const items = await db.knowledgeEntry.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader
        title="Preguntas frecuentes"
        description="Se muestran en la página de Preguntas y son lo que consultará tu asistente. No repitas precios ni días aquí: el asistente los toma de Servicios."
        actions={<NewLink href="/dashboard/knowledge/new" label="Añadir pregunta" />}
      />
      {saved && <Notice>Pregunta añadida.</Notice>}
      {deleted && <Notice>Pregunta eliminada.</Notice>}
      <ul className="divide-y divide-rule border-y border-rule">
        {items.map((k) => (
          <li key={k.id}>
            <Link href={`/dashboard/knowledge/${k.id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-white/[0.02]">
              <span className="min-w-0">
                <span className="font-medium">{k.questionEs ?? "(sin pregunta)"}</span>
                <span className="block text-sm text-ash">{KNOWLEDGE_KIND[k.kind]}</span>
              </span>
              {!k.active && <span className="shrink-0 rounded-full border border-rule px-2 py-0.5 text-xs text-ash">Inactiva</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
