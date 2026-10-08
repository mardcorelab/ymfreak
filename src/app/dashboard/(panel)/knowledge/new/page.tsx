import { PageHeader } from "@/components/admin/PageHeader";
import { KnowledgeForm } from "../KnowledgeForm";

export default function NewKnowledge() {
  return (
    <>
      <PageHeader title="Añadir pregunta" back={{ href: "/dashboard/knowledge", label: "Preguntas frecuentes" }} />
      <KnowledgeForm item={null} />
    </>
  );
}
