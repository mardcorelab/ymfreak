import Link from "next/link";
import { db } from "@/server/db";
import { formatMoney } from "@/server/domain/money";
import { NewLink, Notice, PageHeader } from "@/components/admin/PageHeader";

const UNIT = { PER_SONG: "por canción", PER_HOUR: "por hora", FLAT: "por pieza" } as const;

export default async function ServicesAdmin({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const services = await db.service.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <PageHeader
        title="Servicios y precios"
        description="Los precios que pongas aquí son los únicos que usa la web (y, más adelante, el asistente y el pago)."
        actions={<NewLink href="/dashboard/services/new" label="Nuevo servicio" />}
      />
      {saved && <Notice>Servicio creado.</Notice>}
      <ul className="divide-y divide-rule border-y border-rule">
        {services.map((s) => (
          <li key={s.id}>
            <Link href={`/dashboard/services/${s.id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-white/[0.02]">
              <span>
                <span className="font-medium">{s.nameEs}</span>
                {!s.active && <span className="ml-2 rounded-full border border-rule px-2 py-0.5 text-xs text-ash">Oculto</span>}
                <span className="block text-sm text-ash">
                  {s.bookingMode === "SESSION" ? `Sesión de ${s.sessionMinutes} min` : `Entrega en ${s.turnaroundDays} días laborables`}
                </span>
              </span>
              <span className="whitespace-nowrap text-right">
                <span className="type-head num text-2xl">{formatMoney(s.priceCents, s.currency, "es")}</span>
                <span className="block text-xs text-ash">{UNIT[s.pricingUnit]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
