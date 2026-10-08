import { db } from "@/server/db";
import { getSetting } from "@/server/settings";
import { expireStaleHolds, loadCalendar } from "@/server/booking/calendar";
import { addDays, isBlocked, isWorkingDay, toLocalDate } from "@/server/domain/calendar";
import { fromDateColumn } from "@/server/booking/code";
import { addBlockedPeriod, deleteBlockedPeriod, saveBookingSwitch } from "@/server/admin/actions/bookings";
import { AdminForm } from "@/components/admin/AdminForm";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { Checkbox, TextField } from "@/components/admin/fields";
import { Notice, PageHeader } from "@/components/admin/PageHeader";
import Link from "next/link";

const DAY = new Intl.DateTimeFormat("es-DO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = (d: string) => DAY.format(new Date(`${d}T12:00:00Z`));

export default async function AvailabilityAdmin({ searchParams }: { searchParams: Promise<{ unblocked?: string }> }) {
  const { unblocked } = await searchParams;
  const now = new Date();
  await expireStaleHolds(db, now);
  const [cal, booking, blocks] = await Promise.all([
    loadCalendar(db, now),
    getSetting("booking"),
    db.blockedPeriod.findMany({ where: { toDate: { gte: new Date(Date.now() - 864e5) } }, orderBy: { fromDate: "asc" } }),
  ]);

  const days = Array.from({ length: 35 }, (_, i) => addDays(cal.today, i));
  const sessionsByDay = new Map<string, number>();
  for (const s of cal.busy) {
    const d = toLocalDate(s.start, cal.rules.timeZone);
    sessionsByDay.set(d, (sessionsByDay.get(d) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title="Disponibilidad" description="Lo que ven tus clientes al reservar sale de aquí y de tus reglas de horario." />
      {unblocked && <Notice>Bloqueo eliminado.</Notice>}

      <section aria-labelledby="switch-h" className="mb-12 rounded-lg border border-rule p-5">
        <h2 id="switch-h" className="type-sub text-xl">Reservas en línea</h2>
        <p className="mt-1 text-sm text-ash">
          {booking.enabled
            ? "Abiertas: cualquier visitante puede reservar desde la web."
            : "Cerradas al público: la página de reservas muestra tu contacto. Tú puedes probarla igualmente estando conectado."}
        </p>
        <div className="mt-4">
          <AdminForm action={saveBookingSwitch}>
            <div className="grid gap-5 sm:grid-cols-[1fr_16rem]">
              <Checkbox
                name="enabled"
                label="Abrir las reservas en línea al público"
                defaultChecked={booking.enabled}
                hint="Recomendado cuando el pago en línea esté activo."
              />
              <TextField name="holdMinutes" label="Minutos para pagar el depósito" defaultValue={booking.holdMinutes} inputMode="numeric" hint="Tiempo que se guarda la fecha mientras el cliente paga." />
            </div>
          </AdminForm>
        </div>
      </section>

      <section aria-labelledby="cal-h" className="mb-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="cal-h" className="type-sub text-xl">Próximas 5 semanas</h2>
            <p className="text-sm text-ash">
              Proyectos que empiezan cada día (capacidad: {cal.rules.dailyProjectStarts}) y sesiones.{" "}
              <Link href="/dashboard/settings" className="underline underline-offset-4 hover:text-bone">
                Cambiar horario y capacidad
              </Link>
            </p>
          </div>
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((d) => {
            const working = isWorkingDay(d, cal.rules, cal.blocked);
            const blocked = isBlocked(d, cal.blocked);
            const used = cal.startsUsed.get(d) ?? 0;
            const sessions = sessionsByDay.get(d) ?? 0;
            const full = used >= cal.rules.dailyProjectStarts;
            return (
              <li
                key={d}
                className={`rounded-md border p-3 text-sm ${
                  !working ? "border-rule/50 text-ash/60" : full ? "border-amber-400/50 bg-amber-500/10" : "border-rule"
                }`}
              >
                <p className="first-letter:uppercase">{dayLabel(d)}</p>
                {blocked ? (
                  <p className="mt-1 text-xs">Bloqueado</p>
                ) : !working ? (
                  <p className="mt-1 text-xs">No laborable</p>
                ) : (
                  <p className="num mt-1 text-xs text-ash">
                    {used}/{cal.rules.dailyProjectStarts} proyectos
                    {sessions > 0 && `, ${sessions} ${sessions === 1 ? "sesión" : "sesiones"}`}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="block-h">
        <h2 id="block-h" className="type-sub text-xl">Días bloqueados</h2>
        <p className="mb-4 text-sm text-ash">Vacaciones, viajes o días que no quieras trabajar. No se empiezan proyectos ni se ofrecen sesiones esos días.</p>
        {blocks.length > 0 && (
          <ul className="mb-6 divide-y divide-rule border-y border-rule">
            {blocks.map((b) => {
              const from = fromDateColumn(b.fromDate);
              const to = fromDateColumn(b.toDate);
              return (
                <li key={b.id} className="flex items-center justify-between gap-4 py-3">
                  <span>
                    <span className="first-letter:uppercase">{from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`}</span>
                    {b.reason && <span className="block text-sm text-ash">{b.reason}</span>}
                  </span>
                  <DeleteForm action={deleteBlockedPeriod.bind(null, b.id)} what="este bloqueo" />
                </li>
              );
            })}
          </ul>
        )}
        <AdminForm action={addBlockedPeriod} submitLabel="Bloquear días">
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField name="from" label="Desde" type="date" />
            <TextField name="to" label="Hasta (incluido)" type="date" hint="Vacío = solo un día." />
            <TextField name="reason" label="Motivo (solo lo ves tú)" />
          </div>
        </AdminForm>
      </section>
    </>
  );
}
