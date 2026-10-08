import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/server/db";
import { expireStaleHolds } from "@/server/booking/calendar";
import { getSetting } from "@/server/settings";
import { PageHeader } from "@/components/admin/PageHeader";
import { youtubeStatus } from "@/server/youtube";
import { agentAvailable } from "@/server/agent/model";
import { paymentStatus } from "@/server/payments";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  await expireStaleHolds(db, new Date());
  const [activeBookings, awaiting, clients, booking, services, activeServices, portfolio, achievements, testimonials, faqs, pendingReviews] = await Promise.all([
    db.booking.count({ where: { status: { in: ["PAID", "CONFIRMED", "IN_PROGRESS", "DELIVERED", "REVISION"] } } }),
    db.booking.count({ where: { status: "AWAITING_PAYMENT" } }),
    db.customer.count(),
    getSetting("booking"),
    db.service.count(),
    db.service.count({ where: { active: true } }),
    db.portfolioItem.count({ where: { published: true } }),
    db.achievement.count({ where: { published: true } }),
    db.testimonial.count({ where: { published: true } }),
    db.knowledgeEntry.count({ where: { active: true } }),
    db.testimonial.count({ where: { fromClient: true, published: false } }),
  ]);
  const pay = paymentStatus();

  const cards = [
    { href: "/dashboard/bookings", title: "Reservas", value: `${activeBookings} activas${awaiting ? `, ${awaiting} esperando pago` : ""}` },
    { href: "/dashboard/clients", title: "Clientes", value: `${clients} en total` },
    { href: "/dashboard/availability", title: "Disponibilidad", value: booking.enabled ? "Reservas en línea abiertas" : "Reservas en línea cerradas al público" },
    { href: "/dashboard/services", title: "Servicios y precios", value: `${activeServices} de ${services} visibles` },
    { href: "/dashboard/portfolio", title: "Trabajos", value: `${portfolio} publicados` },
    { href: "/dashboard/achievements", title: "Logros", value: `${achievements} publicados` },
    { href: "/dashboard/testimonials", title: "Testimonios", value: `${testimonials === 0 ? "Ninguno publicado: la sección está oculta" : `${testimonials} publicados`}${pendingReviews ? ` · ${pendingReviews} reseña${pendingReviews === 1 ? "" : "s"} por aprobar` : ""}` },
    { href: "/dashboard/knowledge", title: "Preguntas frecuentes", value: `${faqs} activas` },
    { href: "/dashboard/settings", title: "Contacto y reglas", value: "Redes, correo, depósito, horario" },
  ];

  return (
    <>
      <PageHeader
        title="Tu panel"
        description="Todo lo que cambies aquí se ve en la web en español e inglés en cuanto guardas."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block h-full rounded-lg border border-rule bg-studio p-5 transition-colors hover:border-bone/40">
              <p className="type-sub text-xl">{c.title}</p>
              <p className="mt-2 text-sm text-ash">{c.value}</p>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="type-sub mt-12 text-2xl">Conexiones</h2>
      <ul className="mt-4 grid gap-3 text-sm">
        <Status ok={pay.configured} label="PayPal" detail={pay.configured ? `Conectado (${pay.mode === "live" ? "dinero real" : pay.mode === "sandbox" ? "modo de prueba" : pay.mode})${pay.webhook ? "" : " · falta el webhook"}` : "Sin configurar"} />
        <Status ok={agentAvailable()} label="Asistente (Claude)" detail={agentAvailable() ? "Activo en la web" : "Falta ANTHROPIC_API_KEY"} />
        <Suspense fallback={<Status ok={false} label="YouTube" detail="Comprobando…" />}>
          <YoutubeStatus />
        </Suspense>
      </ul>
    </>
  );
}

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-rule px-4 py-3">
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      <span>
        <span className="font-medium">{label}</span> <span className="text-ash">· {detail}</span>
      </span>
    </li>
  );
}

/** Streams in after the rest of the page, so a slow YouTube never delays the dashboard. */
async function YoutubeStatus() {
  const yt = await youtubeStatus();
  return (
    <Status
      ok={yt.ok}
      label="YouTube"
      detail={
        yt.ok
          ? `Canal ${yt.channelId}: ${yt.videos} videos${yt.shorts ? ` y ${yt.shorts} shorts` : ""} recientes${yt.videos === 0 ? " (la sección de la web aparece cuando subas un video)" : ""}`
          : yt.reason
      }
    />
  );
}
