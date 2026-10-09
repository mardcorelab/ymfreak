import Link from "next/link";
import { db } from "@/server/db";
import { expireStaleHolds } from "@/server/booking/calendar";
import { getSetting } from "@/server/settings";
import { PageHeader } from "@/components/admin/PageHeader";
import { YoutubeStatusRow } from "@/components/admin/YoutubeStatus";
import { agentAvailable } from "@/server/agent/model";
import { paymentStatus } from "@/server/payments";
import { emailAlertsConfigured } from "@/server/notify";
import { voiceEnabled } from "@/server/agent/voice";
import { siteHidden } from "@/server/site-visibility";
import { saveSiteVisibility } from "@/server/admin/actions/settings";
import { AdminForm } from "@/components/admin/AdminForm";
import { Checkbox } from "@/components/admin/fields";
import { whatsappLink } from "@/lib/alerts";
import { fmtDateTime } from "@/lib/admin-format";

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
  const [leads, hidden] = await Promise.all([hotLeads(), siteHidden()]);

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
      <section
        aria-labelledby="visibility-title"
        className={`mb-10 rounded-lg border p-5 ${hidden ? "border-amber-400/50 bg-amber-400/5" : "border-rule"}`}
      >
        <h2 id="visibility-title" className="type-sub text-2xl">
          Visibilidad de la web
        </h2>
        <p className="mt-1 text-sm text-ash">
          {hidden
            ? "Oculta: los visitantes ven una página de «Próximamente» con tu logo y tu contacto. Tú ves la web completa mientras estés conectado al panel."
            : "Visible para todo el mundo."}
        </p>
        {hidden && (
          <p className="mt-2 text-sm">
            <a href="/api/admin/preview" className="underline underline-offset-4 hover:text-bone">
              Ver la web completa (solo tú)
            </a>
          </p>
        )}
        <div className="mt-4">
          <AdminForm action={saveSiteVisibility}>
            <Checkbox
              name="hidden"
              label="Ocultar la web al público (modo Próximamente)"
              defaultChecked={hidden}
              hint="El panel, los pagos y el portal de clientes siguen funcionando."
            />
          </AdminForm>
        </div>
      </section>

      {leads.length > 0 && (
        <section aria-labelledby="leads-title" className="mb-10 rounded-lg border border-amber-400/40 bg-amber-400/5 p-5">
          <h2 id="leads-title" className="type-sub text-2xl">
            Clientes calientes
          </h2>
          <p className="mt-1 text-sm text-ash">
            El asistente les preparó una reserva y aún no la confirmaron. Escríbeles mientras están interesados.
          </p>
          <ul className="mt-4 grid gap-3">
            {leads.map((l) => (
              <li key={l.id} data-testid="hot-lead" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-rule bg-studio px-4 py-3 text-sm">
                <span className="font-medium">{l.name}</span>
                <span className="text-ash">{l.services}</span>
                {l.total && <span className="text-ash">{l.total}</span>}
                <span className="text-ash">{fmtDateTime(l.at)}</span>
                <span className="ms-auto flex gap-3">
                  {l.whatsapp && (
                    <a href={l.whatsapp} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-bone">
                      WhatsApp
                    </a>
                  )}
                  {l.email && (
                    <a href={`mailto:${l.email}`} className="underline underline-offset-4 hover:text-bone">
                      Correo
                    </a>
                  )}
                  <Link href={`/dashboard/conversations/${l.id}`} className="underline underline-offset-4 hover:text-bone">
                    Ver conversación
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
        <Status
          ok={voiceEnabled()}
          label="Voz del asistente (ElevenLabs)"
          detail={voiceEnabled() ? "Notas de voz y respuestas con tu voz clonada (marcada como voz IA)" : "Apagada: añade ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID en Vercel"}
        />
        <YoutubeStatusRow />
        <Status
          ok={emailAlertsConfigured()}
          label="Alertas por correo"
          detail={emailAlertsConfigured() ? "Te escribo cuando hay un cliente caliente, una reserva o un pago" : "Apagadas: añade RESEND_API_KEY en Vercel para recibirlas (los clientes calientes siempre salen aquí)"}
        />
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

/** Conversations where the assistant prepared a booking the visitor hasn't confirmed, last 7 days. */
async function hotLeads() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.conversation.findMany({
    where: { outcome: "LEAD", lastMessageAt: { gte: since } },
    orderBy: { lastMessageAt: "desc" },
    take: 10,
    select: {
      id: true,
      lastMessageAt: true,
      pendingActions: { where: { type: "CREATE_BOOKING" }, orderBy: { createdAt: "desc" }, take: 1, select: { payload: true, summary: true } },
    },
  });
  return rows.map((r) => {
    const a = r.pendingActions[0];
    const payload = (a?.payload ?? {}) as { customer?: { name?: string; email?: string; phone?: string } };
    const summary = (a?.summary ?? {}) as { rows?: { value?: string }[]; total?: string };
    return {
      id: r.id,
      at: r.lastMessageAt,
      name: payload.customer?.name ?? "Visitante",
      email: payload.customer?.email ?? null,
      whatsapp: whatsappLink(payload.customer?.phone),
      services: summary.rows?.[0]?.value ?? "",
      total: summary.total ?? null,
    };
  });
}
