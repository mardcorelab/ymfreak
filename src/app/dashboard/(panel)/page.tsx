import Link from "next/link";
import { db } from "@/server/db";
import { expireStaleHolds } from "@/server/booking/calendar";
import { getSetting } from "@/server/settings";
import { PageHeader } from "@/components/admin/PageHeader";

export default async function DashboardHome() {
  await expireStaleHolds(db, new Date());
  const [activeBookings, awaiting, clients, booking, services, activeServices, portfolio, achievements, testimonials, faqs] = await Promise.all([
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
  ]);

  const cards = [
    { href: "/dashboard/bookings", title: "Reservas", value: `${activeBookings} activas${awaiting ? `, ${awaiting} esperando pago` : ""}` },
    { href: "/dashboard/clients", title: "Clientes", value: `${clients} en total` },
    { href: "/dashboard/availability", title: "Disponibilidad", value: booking.enabled ? "Reservas en línea abiertas" : "Reservas en línea cerradas al público" },
    { href: "/dashboard/services", title: "Servicios y precios", value: `${activeServices} de ${services} visibles` },
    { href: "/dashboard/portfolio", title: "Trabajos", value: `${portfolio} publicados` },
    { href: "/dashboard/achievements", title: "Logros", value: `${achievements} publicados` },
    { href: "/dashboard/testimonials", title: "Testimonios", value: testimonials === 0 ? "Ninguno publicado: la sección está oculta" : `${testimonials} publicados` },
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
    </>
  );
}
