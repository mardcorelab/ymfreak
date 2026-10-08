import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/admin";
import { getSetting } from "@/server/settings";
import { PageHeader } from "@/components/admin/PageHeader";
import { fmtMoney } from "@/lib/admin-format";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

const PAGE_NAMES: Record<string, string> = {
  "/": "Inicio",
  "/portfolio": "Trabajos",
  "/services": "Servicios",
  "/achievements": "Logros",
  "/about": "Sobre mí",
  "/faq": "Preguntas frecuentes",
  "/contact": "Contacto",
  "/book": "Reservar",
  "/checkout": "Página de reserva/pago",
  "/account": "Mi cuenta",
  "/account/project": "Mi cuenta · proyecto",
};

const COUNTRY = new Intl.DisplayNames(["es"], { type: "region" });
const countryName = (c: string) => {
  try {
    return COUNTRY.of(c) ?? c;
  } catch {
    return c;
  }
};

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireAdmin();
  const { d } = await searchParams;
  const days = RANGES.find((r) => String(r) === d) ?? 30;
  const rules = await getSetting("business_rules");
  const tz = rules.timeZone;
  const since = new Date(Date.now() - days * 864e5);
  const pv = { type: "pageview", createdAt: { gte: since } } as const;

  const [daily, pages, referrers, countries, devices, bookVisits, agentOpens, bookings, deposits, collected, conversations, agentBookings] = await Promise.all([
    db.$queryRaw<{ day: string; views: bigint; visitors: bigint }[]>(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day,
             count(*) AS views, count(DISTINCT visitor) AS visitors
      FROM "AnalyticsEvent"
      WHERE type = 'pageview' AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`),
    db.analyticsEvent.groupBy({ by: ["path"], where: pv, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 12 }),
    db.analyticsEvent.groupBy({ by: ["referrer"], where: { ...pv, referrer: { not: null } }, _count: { _all: true }, orderBy: { _count: { referrer: "desc" } }, take: 10 }),
    db.analyticsEvent.groupBy({ by: ["country"], where: { ...pv, country: { not: null } }, _count: { _all: true }, orderBy: { _count: { country: "desc" } }, take: 10 }),
    db.analyticsEvent.groupBy({ by: ["device"], where: pv, _count: { _all: true } }),
    db.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT count(*) AS n FROM (
        SELECT DISTINCT visitor FROM "AnalyticsEvent" WHERE type = 'pageview' AND path = '/book' AND "createdAt" >= ${since}
      ) t`),
    db.analyticsEvent.count({ where: { type: "agent_open", createdAt: { gte: since } } }),
    db.booking.count({ where: { createdAt: { gte: since }, source: { in: ["WEB", "AGENT"] } } }),
    db.payment.aggregate({ where: { kind: "DEPOSIT", status: "SUCCEEDED", provider: { not: "manual" }, paidAt: { gte: since } }, _count: { _all: true } }),
    db.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: since } }, _sum: { amountCents: true } }),
    db.conversation.count({ where: { startedAt: { gte: since }, userMessages: { gt: 0 } } }),
    db.conversation.count({ where: { startedAt: { gte: since }, outcome: { in: ["BOOKING", "PAID"] } } }),
  ]);

  // Fill every day of the range so gaps show as zero.
  const byDay = new Map(daily.map((r) => [r.day, { views: Number(r.views), visitors: Number(r.visitors) }]));
  const series: { day: string; visitors: number; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(Date.now() - i * 864e5));
    series.push({ day, ...(byDay.get(day) ?? { views: 0, visitors: 0 }) });
  }
  const visits = series.reduce((s, x) => s + x.visitors, 0);
  const views = series.reduce((s, x) => s + x.views, 0);
  const bookViews = Number(bookVisits[0]?.n ?? 0);
  const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)} %` : "—");
  const max = Math.max(1, ...series.map((s) => s.visitors));
  const deviceTotal = devices.reduce((s, x) => s + x._count._all, 0);
  const fmtDay = (day: string) => new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

  return (
    <>
      <PageHeader
        title="Analíticas"
        description="Visitas contadas sin cookies ni datos personales (tus propias visitas con sesión abierta no cuentan). Reservas y pagos salen directamente de la base de datos."
        actions={
          <nav aria-label="Periodo" className="flex gap-2 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/dashboard/analytics?d=${r}`}
                aria-current={r === days ? "page" : undefined}
                className={`rounded-full border px-3 py-1.5 ${r === days ? "border-bone" : "border-rule text-ash hover:text-bone"}`}
              >
                {r} días
              </Link>
            ))}
          </nav>
        }
      />

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Visitas" value={visits} hint={`${views} páginas vistas`} />
        <Stat label="Entraron a Reservar" value={bookViews} hint={`${pct(bookViews, visits)} de las visitas`} />
        <Stat label="Reservas en línea" value={bookings} hint={`${deposits._count._all} con depósito pagado`} />
        <Stat label="Cobrado" value={fmtMoney(collected._sum.amountCents ?? 0)} hint="Todos los pagos del periodo" />
      </section>

      <section className="mt-10 rounded-lg border border-rule p-5" aria-labelledby="visits-chart">
        <h2 id="visits-chart" className="type-sub text-xl">
          Visitas por día
        </h2>
        {visits === 0 ? (
          <p className="mt-4 text-sm text-ash">Todavía no hay visitas registradas en este periodo.</p>
        ) : (
          <>
            <div className="mt-6 flex h-44 items-end gap-[2px]" role="img" aria-label={`Visitas por día, máximo ${max}`}>
              {series.map((s) => (
                <div key={s.day} className="group relative flex h-full flex-1 items-end" title={`${fmtDay(s.day)}: ${s.visitors} visitas, ${s.views} páginas`}>
                  <div
                    className="w-full rounded-t-[4px] bg-bone/80 transition-colors group-hover:bg-bone"
                    style={{ height: `${s.visitors === 0 ? 0 : Math.max(3, (s.visitors / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-rule pt-2 text-xs text-ash">
              <span>{fmtDay(series[0]!.day)}</span>
              <span>máx. {max} visitas en un día</span>
              <span>{fmtDay(series.at(-1)!.day)}</span>
            </div>
          </>
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Funnel
          title="De visita a cliente"
          rows={[
            ["Visitas", visits],
            ["Entraron a Reservar", bookViews],
            ["Reservaron", bookings],
            ["Pagaron el depósito", deposits._count._all],
          ]}
        />
        <Funnel
          title="Asistente"
          rows={[
            ["Abrieron el chat", agentOpens],
            ["Escribieron", conversations],
            ["Reservaron con el asistente", agentBookings],
          ]}
          link={{ href: "/dashboard/conversations", label: "Ver conversaciones" }}
        />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <Table title="Páginas más vistas" rows={pages.map((p) => [PAGE_NAMES[p.path] ?? p.path, p._count._all])} />
        <Table title="De dónde llegan" empty="Nadie llegó desde otro sitio todavía." rows={referrers.map((r) => [r.referrer ?? "—", r._count._all])} />
        <Table
          title="Países"
          empty="Sin datos de país."
          rows={countries.map((c) => [countryName(c.country ?? ""), c._count._all])}
          footer={
            deviceTotal > 0
              ? `Móvil ${pct(devices.find((x) => x.device === "mobile")?._count._all ?? 0, deviceTotal)} · Computadora ${pct(
                  devices.find((x) => x.device === "desktop")?._count._all ?? 0,
                  deviceTotal,
                )} · Tableta ${pct(devices.find((x) => x.device === "tablet")?._count._all ?? 0, deviceTotal)}`
              : undefined
          }
        />
      </section>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="rounded-lg border border-rule p-5">
      <p className="text-sm text-ash">{label}</p>
      <p className="type-head num mt-2 text-4xl">{value}</p>
      <p className="mt-1 text-xs text-ash">{hint}</p>
    </div>
  );
}

function Funnel({ title, rows, link }: { title: string; rows: [string, number][]; link?: { href: string; label: string } }) {
  const top = Math.max(1, rows[0]?.[1] ?? 1);
  return (
    <div className="rounded-lg border border-rule p-5">
      <h2 className="type-sub text-xl">{title}</h2>
      <ol className="mt-4 grid gap-3">
        {rows.map(([label, n], i) => (
          <li key={label}>
            <div className="flex justify-between gap-3 text-sm">
              <span>{label}</span>
              <span className="num">
                {n}
                {i > 0 && <span className="ml-2 text-ash">{rows[i - 1]![1] > 0 ? `${Math.round((n / rows[i - 1]![1]) * 100)} %` : "—"}</span>}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-key">
              <div className="h-2 rounded-full bg-bone/80" style={{ width: `${(n / top) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>
      {link && (
        <Link href={link.href} className="mt-4 inline-block text-sm underline underline-offset-4">
          {link.label}
        </Link>
      )}
    </div>
  );
}

function Table({ title, rows, empty = "Sin datos todavía.", footer }: { title: string; rows: [string, number][]; empty?: string; footer?: string }) {
  return (
    <div className="rounded-lg border border-rule p-5">
      <h2 className="type-sub text-xl">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ash">{empty}</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {rows.map(([k, n]) => (
              <tr key={k} className="border-b border-rule last:border-0">
                <td className="py-2 pr-3">{k}</td>
                <td className="num py-2 text-right">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {footer && <p className="mt-4 text-xs text-ash">{footer}</p>}
    </div>
  );
}
