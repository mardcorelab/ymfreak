import Link from "next/link";
import { db } from "@/server/db";
import { NewLink, Notice, PageHeader } from "@/components/admin/PageHeader";

export default async function TestimonialsAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { saved, deleted } = await searchParams;
  const items = await db.testimonial.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader
        title="Testimonios"
        description="Palabras reales de artistas con los que has trabajado. La sección aparece en la web en cuanto haya al menos uno publicado."
        actions={<NewLink href="/dashboard/testimonials/new" label="Añadir testimonio" />}
      />
      {saved && <Notice>Testimonio añadido.</Notice>}
      {deleted && <Notice>Testimonio eliminado.</Notice>}
      {items.length === 0 ? (
        <p className="text-ash">Todavía no hay testimonios.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {items.map((q) => (
            <li key={q.id}>
              <Link href={`/dashboard/testimonials/${q.id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-white/[0.02]">
                <span className="min-w-0">
                  <span className="font-medium">{q.author}</span>
                  <span className="block truncate text-sm text-ash">{q.quoteEs}</span>
                </span>
                {!q.published && <span className="shrink-0 rounded-full border border-rule px-2 py-0.5 text-xs text-ash">Oculto</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
