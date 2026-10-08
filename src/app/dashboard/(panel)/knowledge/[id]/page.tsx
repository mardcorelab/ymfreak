import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { deleteKnowledgeEntry } from "@/server/admin/actions/knowledge";
import { KnowledgeForm } from "../KnowledgeForm";

export default async function EditKnowledge({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.knowledgeEntry.findUnique({ where: { id } });
  if (!item) notFound();
  return (
    <>
      <PageHeader
        title={item.questionEs ?? "Pregunta"}
        back={{ href: "/dashboard/knowledge", label: "Preguntas frecuentes" }}
        actions={<DeleteForm action={deleteKnowledgeEntry.bind(null, item.id)} what="esta pregunta" />}
      />
      <KnowledgeForm item={item} />
    </>
  );
}
