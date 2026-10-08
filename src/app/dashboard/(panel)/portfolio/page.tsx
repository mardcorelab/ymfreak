import Link from "next/link";
import { db } from "@/server/db";
import { NewLink, Notice, PageHeader } from "@/components/admin/PageHeader";

export default async function PortfolioAdmin({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { saved, deleted } = await searchParams;
  const items = await db.portfolioItem.findMany({ orderBy: [{ sortOrder: "asc" }, { year: "desc" }] });

  return (
    <>
      <PageHeader
        title="Trabajos"
        description="Pega el enlace de Spotify o YouTube de cada lanzamiento; la portada se toma de la plataforma."
        actions={<NewLink href="/dashboard/portfolio/new" label="Añadir trabajo" />}
      />
      {saved && <Notice>Trabajo añadido.</Notice>}
      {deleted && <Notice>Trabajo eliminado.</Notice>}
      {items.length === 0 ? (
        <p className="text-ash">Todavía no hay trabajos. Añade el primero.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/portfolio/${p.id}`} className="flex items-center gap-4 py-3 hover:bg-white/[0.02]">
                {p.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                  <img src={p.coverUrl} alt="" width={56} height={56} className="size-14 rounded object-cover" />
                ) : (
                  <span className="size-14 rounded bg-key" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block truncate text-sm text-ash">
                    {p.artist}
                    {p.year ? `, ${p.year}` : ""}
                    {p.creditEs ? `. ${p.creditEs}` : ""}
                  </span>
                </span>
                <span className="ml-auto flex shrink-0 gap-2 text-xs text-ash">
                  {p.featured && <span className="rounded-full border border-rule px-2 py-0.5">En portada</span>}
                  {!p.published && <span className="rounded-full border border-rule px-2 py-0.5">Oculto</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
