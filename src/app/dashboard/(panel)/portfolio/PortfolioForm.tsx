import type { PortfolioItem } from "@prisma/client";
import { AdminForm } from "@/components/admin/AdminForm";
import { Checkbox, Group, Pair, TextArea, TextField } from "@/components/admin/fields";
import { mediaLinkUrl } from "@/lib/media-link";
import { savePortfolioItem } from "@/server/admin/actions/portfolio";

export function PortfolioForm({ item }: { item: PortfolioItem | null }) {
  const p = item;
  return (
    <AdminForm action={savePortfolioItem.bind(null, p?.id ?? null)} submitLabel={p ? "Guardar cambios" : "Añadir trabajo"}>
      <Group title="Lanzamiento">
        <TextField
          name="link"
          label="Enlace de Spotify o YouTube"
          type="url"
          defaultValue={mediaLinkUrl(p?.embedProvider ?? null, p?.embedId ?? null)}
          placeholder="https://open.spotify.com/album/…"
          hint="Desde Spotify: Compartir → Copiar enlace. Se reproducirá dentro de tu web."
        />
        <Pair>
          <TextField name="title" label="Título" defaultValue={p?.title} />
          <TextField name="artist" label="Artista" defaultValue={p?.artist} />
        </Pair>
        <div className="grid gap-6 sm:grid-cols-3">
          <TextField name="creditEs" label="Tu crédito (español)" defaultValue={p?.creditEs} placeholder="Mezcla y mastering" />
          <TextField name="creditEn" label="Tu crédito (inglés)" defaultValue={p?.creditEn} placeholder="Mixing and mastering" />
          <TextField name="year" label="Año" defaultValue={p?.year} inputMode="numeric" />
        </div>
      </Group>

      <Group title="Opcional">
        <Pair>
          <TextArea name="descriptionEs" label="Descripción (español)" defaultValue={p?.descriptionEs} rows={3} />
          <TextArea name="descriptionEn" label="Descripción (inglés)" defaultValue={p?.descriptionEn} rows={3} />
        </Pair>
        <TextField
          name="coverUrl"
          label="Portada personalizada"
          type="url"
          defaultValue={p?.coverUrl}
          hint="Déjalo vacío para usar la portada de Spotify o YouTube."
        />
      </Group>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_12rem]">
        <Checkbox name="published" label="Publicado" defaultChecked={p?.published ?? true} />
        <Checkbox name="featured" label="Mostrar en la portada" defaultChecked={p?.featured ?? false} />
        <TextField name="sortOrder" label="Orden" defaultValue={p?.sortOrder ?? 100} inputMode="numeric" />
      </div>
    </AdminForm>
  );
}
