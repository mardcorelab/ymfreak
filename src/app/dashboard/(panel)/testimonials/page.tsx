import Link from "next/link";
import { db } from "@/server/db";
import { NewLink, Notice, PageHeader } from "@/components/admin/PageHeader";

export default async function TestimonialsAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { saved, deleted } = await searchParams;
  const items = await db.testimonial.findMany({ orderBy: [{ published: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }] });
  const pending = items.filter((q) => q.fromClient && !q.published).length;
  return (
    <>
      <PageHeader
        title="Testimonios"
        description="Palabras reales de artistas con los que has trabajado. La sección aparece en la web en cuanto haya al menos uno publicado."
        actions={<NewLink href="/dashboard/testimonials/new" label="Añadir testimonio" />}
      />
      {saved && <Notice>Testimonio añadido.</Notice>}
      {pending > 0 && (
        <p role="status" className="mb-6 rounded-lg border border-brass/40 bg-brass/10 px-4 py-3 text-sm">
          {pending === 1 ? "Tienes 1 reseña de cliente pendiente de aprobar." : `Tienes ${pending} reseñas de clientes pendientes de aprobar.`} Ábrela, revísala
          y marca «Publicado» para que salga en la web.
        </p>
      )}
      {deleted && <Notice>Testimonio eliminado.</Notice>}
      {items.length === 0 ? (
        <p className="text-ash">Todavía no hay testimonios.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {items.map((q) => (
            <li key={q.id}>
              <Link href={`/dashboard/testimonials/${q.id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-white/[0.02]">
                <span className="min-w-0">
                  <span className="font-medium">
                    {q.author}
                    {q.rating !== null && <span className="ml-2 text-brass">{"★".repeat(q.rating)}</span>}
                  </span>
                  <span className="block truncate text-sm text-ash">{q.quoteEs}</span>
                </span>
                {!q.published &&
                  (q.fromClient ? (
                    <span className="shrink-0 rounded-full border border-brass/50 px-2 py-0.5 text-xs text-brass">Pendiente de aprobar</span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-rule px-2 py-0.5 text-xs text-ash">Oculto</span>
                  ))}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
