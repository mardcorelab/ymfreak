import type { Achievement } from "@prisma/client";
import { AdminForm } from "@/components/admin/AdminForm";
import { Checkbox, Group, Pair, Select, TextArea, TextField } from "@/components/admin/fields";
import { saveAchievement } from "@/server/admin/actions/achievements";

export const KIND_LABEL = {
  NOMINATION: "Nominación",
  AWARD: "Premio",
  CERTIFICATION: "Certificación",
  MILESTONE: "Hito",
} as const;

export function AchievementForm({
  item,
  portfolio,
}: {
  item: Achievement | null;
  portfolio: { id: string; title: string; artist: string }[];
}) {
  const a = item;
  return (
    <AdminForm action={saveAchievement.bind(null, a?.id ?? null)} submitLabel={a ? "Guardar cambios" : "Añadir logro"}>
      <div className="grid gap-6 sm:grid-cols-3">
        <Select
          name="kind"
          label="Tipo"
          defaultValue={a?.kind ?? "CERTIFICATION"}
          options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <TextField name="year" label="Año" defaultValue={a?.year} inputMode="numeric" />
        <Select
          name="portfolioId"
          label="Trabajo relacionado"
          defaultValue={a?.portfolioId ?? ""}
          options={[{ value: "", label: "Ninguno" }, ...portfolio.map((p) => ({ value: p.id, label: `${p.title} (${p.artist})` }))]}
        />
      </div>
      <Group title="Textos">
        <Pair>
          <TextField name="titleEs" label="Título (español)" defaultValue={a?.titleEs} placeholder="Disco de Platino en…" />
          <TextField name="titleEn" label="Título (inglés)" defaultValue={a?.titleEn} placeholder="Platinum record in…" />
        </Pair>
        <Pair>
          <TextArea name="detailEs" label="Detalle (español)" defaultValue={a?.detailEs} rows={2} />
          <TextArea name="detailEn" label="Detalle (inglés)" defaultValue={a?.detailEn} rows={2} />
        </Pair>
      </Group>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_12rem]">
        <Checkbox name="published" label="Publicado" defaultChecked={a?.published ?? true} />
        <Checkbox name="highlight" label="Destacado" defaultChecked={a?.highlight ?? false} hint="Aparece en la franja bajo la portada (se muestran los dos primeros)." />
        <TextField name="sortOrder" label="Orden" defaultValue={a?.sortOrder ?? 100} inputMode="numeric" />
      </div>
    </AdminForm>
  );
}
