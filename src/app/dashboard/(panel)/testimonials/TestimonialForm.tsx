import type { Testimonial } from "@prisma/client";
import { AdminForm } from "@/components/admin/AdminForm";
import { Checkbox, Pair, TextArea, TextField } from "@/components/admin/fields";
import { saveTestimonial } from "@/server/admin/actions/testimonials";

export function TestimonialForm({ item }: { item: Testimonial | null }) {
  const q = item;
  return (
    <AdminForm action={saveTestimonial.bind(null, q?.id ?? null)} submitLabel={q ? "Guardar cambios" : "Añadir testimonio"}>
      <Pair>
        <TextField name="author" label="Nombre del artista" defaultValue={q?.author} />
        <TextField name="role" label="Rol (opcional)" defaultValue={q?.role} placeholder="Cantante, productor, sello…" />
      </Pair>
      <Pair>
        <TextArea name="quoteEs" label="Testimonio (español)" defaultValue={q?.quoteEs} />
        <TextArea name="quoteEn" label="Testimonio (inglés)" defaultValue={q?.quoteEn} />
      </Pair>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Checkbox name="published" label="Publicado" defaultChecked={q?.published ?? true} hint="Publica solo testimonios con permiso de la persona." />
        <TextField name="sortOrder" label="Orden" defaultValue={q?.sortOrder ?? 100} inputMode="numeric" />
      </div>
    </AdminForm>
  );
}
