import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { nextStatuses } from "@/server/domain/booking-status";
import { expireStaleHolds } from "@/server/booking/calendar";
import { addProjectLink, cancelWithRefund, changeBookingStatus, deleteProjectLink, markBalancePaid } from "@/server/admin/actions/bookings";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { AdminForm } from "@/components/admin/AdminForm";
import { Select, TextArea, TextField } from "@/components/admin/fields";
import { Notice, PageHeader } from "@/components/admin/PageHeader";
import { BOOKING_LABEL, BookingBadge } from "@/components/admin/BookingBadge";
import { fmtDateTime, fmtDay, fmtMoney } from "@/lib/admin-format";

type Project = { songTitle?: string; artistName?: string; notes?: string; referenceLinks?: string[]; requestedDeliveryDate?: string };

export default async function BookingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  await expireStaleHolds(db, new Date());
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { service: true } },
      order: { include: { items: true, payments: { orderBy: { createdAt: "asc" } } } },
      events: { orderBy: { createdAt: "desc" } },
      links: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!b) notFound();
  const project = (b.projectDetails ?? {}) as Project;
  const next = nextStatuses(b.status, "admin");
  const paid = b.order?.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amountCents, 0) ?? 0;
  const paidOnline = b.order?.payments.filter((p) => p.status === "SUCCEEDED" && p.provider !== "manual").reduce((s, p) => s + p.amountCents, 0) ?? 0;

  return (
    <>
      <PageHeader
        title={`Reserva ${b.code}`}
        back={{ href: "/dashboard/bookings", label: "Reservas" }}
        actions={<BookingBadge status={b.status} />}
      />
      {created && <Notice>Reserva creada.</Notice>}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-8">
          <section className="rounded-lg border border-rule p-5">
            <h2 className="type-sub text-xl">Trabajo</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Item label="Servicio">{b.items.map((i) => i.service.nameEs).join(" + ")} × {b.quantity}</Item>
              {b.bookingMode === "DELIVERY" ? (
                <>
                  <Item label="Entrega">{fmtDay(b.deliveryDate)}</Item>
                  <Item label="Empieza">{fmtDay(b.firstStartDate)}</Item>
                  {project.requestedDeliveryDate && <Item label="El cliente la pidió para">{project.requestedDeliveryDate}</Item>}
                </>
              ) : (
                <Item label="Sesión">{fmtDateTime(b.startsAt)}</Item>
              )}
              <Item label="Canción">{project.songTitle || "—"}</Item>
              <Item label="Artista">{project.artistName || "—"}</Item>
              <Item label="Revisiones usadas">{b.revisionsUsed}</Item>
              <Item label="Origen">{b.source === "WEB" ? "Web" : b.source === "ADMIN" ? "Panel" : "Asistente"}</Item>
            </dl>
            {project.notes && <p className="mt-4 whitespace-pre-wrap rounded-md bg-studio p-4 text-sm text-bone/85">{project.notes}</p>}
            {project.referenceLinks && project.referenceLinks.length > 0 && (
              <ul className="mt-3 text-sm">
                {project.referenceLinks.map((l) => (
                  <li key={l}>
                    <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-ash underline underline-offset-4 hover:text-bone">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-rule p-5" aria-labelledby="links">
            <h2 id="links" className="type-sub text-xl">
              Archivos del proyecto
            </h2>
            <p className="mt-1 text-sm text-ash">
              El cliente comparte aquí sus archivos y pide revisiones desde su portal. Tú compartes versiones para escuchar y los archivos finales (el cliente
              los ve cuando paga el saldo).
            </p>
            {b.links.length === 0 ? (
              <p className="mt-4 text-sm text-ash">Todavía no hay enlaces.</p>
            ) : (
              <ul className="mt-4 divide-y divide-rule border-y border-rule">
                {b.links.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm" data-link-kind={l.kind}>
                    <div className="min-w-0">
                      <p className="text-xs text-ash">
                        {LINK_LABEL[l.kind]} · {l.author === "admin" ? "tú" : "cliente"} · {fmtDateTime(l.createdAt)}
                      </p>
                      {l.label && <p className="font-medium">{l.label}</p>}
                      {l.url && (
                        <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-4">
                          {l.url}
                        </a>
                      )}
                      {l.note && <p className="mt-1 whitespace-pre-wrap text-bone/85">{l.note}</p>}
                    </div>
                    {l.author === "admin" && <DeleteForm action={deleteProjectLink.bind(null, l.id, b.id)} what="este enlace" />}
                  </li>
                ))}
              </ul>
            )}
            {!["CANCELLED", "EXPIRED"].includes(b.status) && (
              <div className="mt-5">
                <AdminForm action={addProjectLink.bind(null, b.id)} submitLabel="Compartir enlace">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Select
                      name="kind"
                      label="Tipo"
                      options={[
                        { value: "PREVIEW", label: "Versión para escuchar" },
                        { value: "FINAL", label: "Archivos finales" },
                      ]}
                    />
                    <TextField name="label" label="Nombre (opcional)" placeholder="Mezcla v1, Master final…" />
                  </div>
                  <TextField name="url" label="Enlace" type="url" placeholder="https://drive.google.com/…" />
                  <TextArea name="linkNote" label="Nota para el cliente (opcional)" />
                </AdminForm>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-rule p-5">
            <h2 className="type-sub text-xl">Cambiar estado</h2>
            {next.length === 0 ? (
              <p className="mt-3 text-sm text-ash">Esta reserva está cerrada; no admite más cambios.</p>
            ) : (
              <div className="mt-4">
                <AdminForm action={changeBookingStatus.bind(null, b.id)} submitLabel="Cambiar estado">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Select name="to" label="Nuevo estado" options={next.map((s) => ({ value: s, label: BOOKING_LABEL[s] }))} />
                    <TextField name="note" label="Nota (opcional)" />
                  </div>
                </AdminForm>
                {next.includes("REVISION") && (
                  <p className="mt-3 text-xs text-ash">Desde la revisión que supere las incluidas se añade automáticamente el cargo al pedido.</p>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="type-sub text-xl">Historial</h2>
            <ol className="mt-4 grid gap-3 border-l border-rule pl-5">
              {b.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="text-ash">{fmtDateTime(e.createdAt)}</span>{" "}
                  {e.from ? `${BOOKING_LABEL[e.from]} → ` : ""}
                  {BOOKING_LABEL[e.to]} <span className="text-ash">({e.actor === "admin" ? "tú" : e.actor === "client" ? "cliente" : "sistema"})</span>
                  {e.note && <span className="block text-bone/80">{e.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="grid content-start gap-8">
          <section className="rounded-lg border border-rule p-5">
            <h2 className="type-sub text-xl">Cliente</h2>
            <dl className="mt-4 grid gap-3">
              <Item label="Nombre">{b.customer.name}</Item>
              <Item label="Correo">
                <a href={`mailto:${b.customer.email}`} className="underline underline-offset-4">
                  {b.customer.email}
                </a>
              </Item>
              {b.customer.phone && <Item label="Teléfono">{b.customer.phone}</Item>}
              <Item label="Idioma">{b.customer.locale === "es" ? "Español" : "Inglés"}</Item>
            </dl>
          </section>

          {b.order && (
            <section className="rounded-lg border border-rule p-5">
              <h2 className="type-sub text-xl">Pago</h2>
              <dl className="mt-4 grid gap-2 text-sm">
                {b.order.items.map((i) => (
                  <div key={i.id} className="flex justify-between gap-3">
                    <dt>
                      {i.nameSnapshot} × {i.quantity}
                    </dt>
                    <dd className="num">{fmtMoney(i.unitPriceCents * i.quantity)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-rule pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="num">{fmtMoney(b.order.totalCents)}</dd>
                </div>
                <div className="flex justify-between gap-3 text-ash">
                  <dt>Depósito</dt>
                  <dd className="num">{fmtMoney(b.order.depositCents)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Pagado</dt>
                  <dd className="num">{fmtMoney(paid)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Pendiente</dt>
                  <dd className="num">{fmtMoney(Math.max(0, b.order.totalCents - paid))}</dd>
                </div>
              </dl>
              {b.order.payments.length > 0 && (
                <ul className="mt-4 grid gap-1 text-xs text-ash">
                  {b.order.payments.map((p) => (
                    <li key={p.id}>
                      {p.kind === "DEPOSIT" ? "Depósito" : p.kind === "BALANCE" ? "Saldo" : "Revisión"}: {fmtMoney(p.amountCents)} ({p.provider === "manual" ? "fuera de la web" : p.provider}, {p.status === "SUCCEEDED" ? "pagado" : p.status.toLowerCase()})
                    </li>
                  ))}
                </ul>
              )}
              {paidOnline > 0 && next.includes("CANCELLED") && (
                <div className="mt-5 border-t border-rule pt-5">
                  <AdminForm action={cancelWithRefund.bind(null, b.id)} submitLabel={`Cancelar y reembolsar ${fmtMoney(paidOnline)}`}>
                    <p className="text-xs text-ash">Devuelve por PayPal lo pagado en línea y cancela la reserva.</p>
                  </AdminForm>
                </div>
              )}
              {b.order.status !== "PAID_IN_FULL" && !["CANCELLED", "EXPIRED"].includes(b.status) && paid > 0 && (
                <div className="mt-5">
                  <AdminForm action={markBalancePaid.bind(null, b.id)} submitLabel="Registrar saldo pagado">
                    <p className="text-xs text-ash">Úsalo si el cliente te pagó el resto fuera de la web (transferencia, PayPal directo…).</p>
                  </AdminForm>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

const LINK_LABEL: Record<string, string> = {
  CLIENT_FILES: "Archivos del cliente",
  REVISION_REQUEST: "Revisión pedida",
  PREVIEW: "Versión para escuchar",
  FINAL: "Archivos finales",
};

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ash">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
