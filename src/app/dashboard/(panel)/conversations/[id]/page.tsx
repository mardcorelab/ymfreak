import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/admin";
import { fmtDateTime } from "@/lib/admin-format";
import { PageHeader } from "@/components/admin/PageHeader";
import type { Block } from "@/server/agent/llm";
import type { AgentCard } from "@/lib/agent-types";
import { OutcomeBadge } from "@/components/admin/OutcomeBadge";

export const dynamic = "force-dynamic";

const TOOL_LABELS: Record<string, string> = {
  get_services: "consultó servicios y precios",
  get_business_info: "consultó reglas del negocio",
  search_knowledge: "buscó en preguntas frecuentes",
  get_portfolio: "consultó trabajos y logros",
  get_contact: "mostró tus datos de contacto",
  quote_delivery: "calculó precio y fecha de entrega",
  check_session_slots: "consultó horarios libres",
  get_booking_status: "consultó el estado de una reserva",
  propose_booking: "preparó una reserva para confirmar",
};

function cardText(card: AgentCard): string {
  switch (card.kind) {
    case "proposal":
      return `Propuesta de reserva: ${card.rows.map((r) => `${r.label}: ${r.value}`).join(" · ")} · Total ${card.total}`;
    case "booked":
      return `Reserva creada ${card.code} · depósito ${card.deposit}`;
    case "quote":
      return `Cotización: total ${card.total}, entrega ${card.deliveryDate}`;
    case "slots":
      return `Horarios ${card.dateLabel}: ${card.slots.map((s) => s.label).join(", ")}`;
    case "status":
      return `Estado ${card.code}: ${card.status}`;
    case "services":
      return `Lista de servicios (${card.items.length})`;
    case "contact":
      return "Datos de contacto";
  }
}

export default async function ConversationDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const c = await db.conversation.findUnique({
    where: { id },
    include: { customer: true, messages: { orderBy: { seq: "asc" } } },
  });
  if (!c) notFound();
  const booking = c.bookingId ? await db.booking.findUnique({ where: { id: c.bookingId }, select: { id: true, code: true } }) : null;

  return (
    <>
      <PageHeader
        title="Conversación"
        back={{ href: "/dashboard/conversations", label: "Conversaciones" }}
        description={
          <>
            Empezó {fmtDateTime(c.startedAt)} · {c.userMessages} mensajes del visitante · página en {c.locale.toUpperCase()}
          </>
        }
        actions={<OutcomeBadge outcome={c.outcome} />}
      />
      {(c.customer || booking) && (
        <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-rule p-4 text-sm">
          {c.customer && (
            <Link href={`/dashboard/clients/${c.customer.id}`} className="underline underline-offset-4">
              {c.customer.name} · {c.customer.email}
            </Link>
          )}
          {booking && (
            <Link href={`/dashboard/bookings/${booking.id}`} className="underline underline-offset-4">
              Reserva {booking.code}
            </Link>
          )}
        </div>
      )}
      <ol className="max-w-3xl space-y-3">
        {c.messages.map((m) => {
          if (m.role === "card") {
            return (
              <li key={m.id} className="rounded-md border border-dashed border-rule px-3 py-2 text-sm text-ash">
                Tarjeta · {cardText(m.content as unknown as AgentCard)}
              </li>
            );
          }
          const blocks = m.content as unknown as Block[];
          if (m.role === "tool") {
            const errors = blocks.filter((b) => b.type === "tool_result" && b.is_error).length;
            return errors ? (
              <li key={m.id} className="text-xs text-amber-200/80">
                {errors === 1 ? "Una herramienta devolvió un aviso" : `${errors} herramientas devolvieron avisos`} (datos incompletos o no disponibles).
              </li>
            ) : null;
          }
          return (
            <li key={m.id} className="space-y-1">
              {blocks.map((b, i) =>
                b.type === "text" ? (
                  <div key={i} className={m.role === "user" ? "rounded-lg bg-key px-4 py-3" : "px-4 py-1"}>
                    <p className="text-xs text-ash">
                      {m.role === "user" ? "Visitante" : "Asistente"} · {fmtDateTime(m.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{b.text}</p>
                  </div>
                ) : b.type === "tool_use" ? (
                  <p key={i} className="px-4 text-xs text-ash">
                    → El asistente {TOOL_LABELS[b.name] ?? b.name}
                  </p>
                ) : null,
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
