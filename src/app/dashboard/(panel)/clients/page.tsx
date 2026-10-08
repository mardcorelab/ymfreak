import Link from "next/link";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";

export default async function ClientsAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const customers = await db.customer.findMany({
    where: query
      ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }, { artistName: { contains: query, mode: "insensitive" } }] }
      : {},
    include: { _count: { select: { bookings: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader title="Clientes" description="Se crean solos cuando alguien reserva." />
      <form className="mb-6 flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Buscar cliente
        </label>
        <input id="q" name="q" defaultValue={query} placeholder="Buscar por nombre, artista o correo" className="w-full rounded-md border border-rule bg-studio-deep px-3 py-2.5" />
        <button className="rounded-full border border-rule px-4 text-sm hover:border-bone/40">Buscar</button>
      </form>
      {customers.length === 0 ? (
        <p className="text-ash">{query ? "Ningún cliente coincide con la búsqueda." : "Todavía no hay clientes."}</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {customers.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/clients/${c.id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-white/[0.02]">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {c.name}
                    {c.artistName && c.artistName !== c.name ? <span className="text-ash"> ({c.artistName})</span> : null}
                  </span>
                  <span className="block truncate text-sm text-ash">{c.email}</span>
                </span>
                <span className="num shrink-0 text-sm text-ash">
                  {c._count.bookings} {c._count.bookings === 1 ? "reserva" : "reservas"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
