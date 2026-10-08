export const OUTCOME: Record<string, { label: string; cls: string }> = {
  NONE: { label: "Consulta", cls: "border-rule text-ash" },
  LEAD: { label: "Interesado", cls: "border-sky-400/40 text-sky-200" },
  BOOKING: { label: "Reservó", cls: "border-amber-300/40 text-amber-100" },
  PAID: { label: "Pagó", cls: "border-emerald-400/40 text-emerald-200" },
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const o = OUTCOME[outcome] ?? OUTCOME.NONE!;
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${o.cls}`}>{o.label}</span>;
}
