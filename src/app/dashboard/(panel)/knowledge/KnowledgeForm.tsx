import type { KnowledgeEntry } from "@prisma/client";
import { AdminForm } from "@/components/admin/AdminForm";
import { Checkbox, Pair, Select, TextArea, TextField } from "@/components/admin/fields";
import { saveKnowledgeEntry } from "@/server/admin/actions/knowledge";

export const KNOWLEDGE_KIND = {
  FAQ: "Pregunta frecuente",
  POLICY: "Política",
  PROCESS: "Proceso",
  DOC: "Documento",
} as const;

export function KnowledgeForm({ item }: { item: KnowledgeEntry | null }) {
  const k = item;
  return (
    <AdminForm action={saveKnowledgeEntry.bind(null, k?.id ?? null)} submitLabel={k ? "Guardar cambios" : "Añadir pregunta"}>
      <Pair>
        <TextField name="questionEs" label="Pregunta (español)" defaultValue={k?.questionEs} />
        <TextField name="questionEn" label="Pregunta (inglés)" defaultValue={k?.questionEn} />
      </Pair>
      <Pair>
        <TextArea name="answerEs" label="Respuesta (español)" defaultValue={k?.answerEs} rows={6} />
        <TextArea name="answerEn" label="Respuesta (inglés)" defaultValue={k?.answerEn} rows={6} />
      </Pair>
      <div className="grid gap-6 sm:grid-cols-[14rem_1fr]">
        <Select
          name="kind"
          label="Tipo"
          defaultValue={k?.kind ?? "FAQ"}
          options={Object.entries(KNOWLEDGE_KIND).map(([value, label]) => ({ value, label }))}
        />
        <TextField
          name="tags"
          label="Palabras clave (opcional)"
          defaultValue={k?.tags.join(", ")}
          hint="Separadas por comas. Ayudan al asistente a encontrar esta respuesta."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Checkbox name="active" label="Activa" defaultChecked={k?.active ?? true} hint="Las inactivas no se muestran ni las usa el asistente." />
        <TextField name="sortOrder" label="Orden" defaultValue={k?.sortOrder ?? 100} inputMode="numeric" />
      </div>
    </AdminForm>
  );
}
