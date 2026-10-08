import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/admin";
import { agentAvailable } from "@/server/agent/model";
import { fmtDateTime } from "@/lib/admin-format";
import { PageHeader } from "@/components/admin/PageHeader";
import type { Block } from "@/server/agent/llm";
import { OUTCOME, OutcomeBadge } from "@/components/admin/OutcomeBadge";

export const dynamic = "force-dynamic";

export default async function ConversationsAdmin({ searchParams }: { searchParams: Promise<{ outcome?: string }> }) {
  await requireAdmin();
  const { outcome } = await searchParams;
  const filter = outcome && outcome in OUTCOME ? (outcome as keyof typeof OUTCOME) : undefined;
  const conversations = await db.conversation.findMany({
    where: { userMessages: { gt: 0 }, ...(filter ? { outcome: filter as "NONE" | "LEAD" | "BOOKING" | "PAID" } : {}) },
    include: {
      customer: { select: { name: true, email: true } },
      messages: { where: { role: "user" }, orderBy: { seq: "asc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Conversaciones"
        description={
          agentAvailable()
            ? "Lo que la gente le pregunta al asistente de la web. Las reservas que salen de aquí aparecen también en Reservas."
            : "El asistente está apagado: falta ANTHROPIC_API_KEY en Vercel."
        }
      />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Filtrar">
        <Link href="/dashboard/conversations" className={`rounded-full border px-3 py-1.5 ${!filter ? "border-bone" : "border-rule text-ash hover:text-bone"}`}>
          Todas
        </Link>
        {Object.entries(OUTCOME).map(([k, v]) => (
          <Link key={k} href={`/dashboard/conversations?outcome=${k}`} className={`rounded-full border px-3 py-1.5 ${filter === k ? "border-bone" : "border-rule text-ash hover:text-bone"}`}>
            {v.label}
          </Link>
        ))}
      </nav>
      {conversations.length === 0 ? (
        <p className="text-ash">Todavía no hay conversaciones{filter ? " con ese resultado" : ""}.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {conversations.map((c) => {
            const first = ((c.messages[0]?.content ?? []) as unknown as Block[]).find((b) => b.type === "text");
            return (
              <li key={c.id}>
                <Link href={`/dashboard/conversations/${c.id}`} className="flex items-center justify-between gap-4 py-4 hover:bg-white/[0.02]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{first && first.type === "text" ? first.text : "—"}</span>
                    <span className="block truncate text-sm text-ash">
                      {fmtDateTime(c.lastMessageAt)} · {c.userMessages} {c.userMessages === 1 ? "mensaje" : "mensajes"} · {c.locale.toUpperCase()}
                      {c.customer ? ` · ${c.customer.name} (${c.customer.email})` : ""}
                    </span>
                  </span>
                  <OutcomeBadge outcome={c.outcome} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
