/**
 * Builds the alert emails sent to YM Freak. Pure (no I/O) so it can be unit
 * tested; src/server/notify.ts does the sending. Always in Spanish: the
 * reader is the studio owner.
 */

export type AlertEvent =
  | {
      kind: "lead";
      conversationId: string;
      name: string;
      email: string;
      phone?: string | null;
      services: string;
      artist?: string | null;
      song?: string | null;
      total?: string | null;
    }
  | {
      kind: "booking" | "payment";
      code: string;
      bookingId: string;
      name: string;
      email: string;
      phone?: string | null;
      services: string;
      artist?: string | null;
      song?: string | null;
      source?: string | null;
      total?: string | null;
      amount?: string | null;
    };

const SOURCE: Record<string, string> = { WEB: "formulario de la web", AGENT: "asistente", ADMIN: "panel" };

/** wa.me link from a free-form phone number, or null when it has too few digits. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Dominican numbers typed without the country code.
  return `https://wa.me/${digits.length === 10 ? `1${digits}` : digits}`;
}

export function buildAlert(e: AlertEvent, siteUrl: string): { subject: string; text: string } {
  const base = siteUrl.replace(/\/$/, "");
  const who = [e.name, e.artist && e.artist !== e.name ? `(${e.artist})` : ""].filter(Boolean).join(" ");
  const wa = whatsappLink(e.phone);
  const contact = [`Correo: ${e.email}`, e.phone ? `Teléfono: ${e.phone}${wa ? ` · WhatsApp: ${wa}` : ""}` : ""].filter(Boolean);
  const project = [`Servicio: ${e.services}`, e.song ? `Canción: ${e.song}` : "", e.total ? `Total: ${e.total}` : ""].filter(Boolean);

  if (e.kind === "lead") {
    return {
      subject: `🔥 Cliente interesado: ${who} · ${e.services}`,
      text: lines([
        `${who} está a punto de reservar con el asistente (le preparó la reserva para confirmar).`,
        "",
        ...project,
        ...contact,
        "",
        "Si no confirma en los próximos minutos, escríbele tú: es un cliente caliente.",
        `Conversación: ${base}/dashboard/conversations/${e.conversationId}`,
      ]),
    };
  }
  if (e.kind === "booking") {
    return {
      subject: `Nueva reserva ${e.code}: ${who} · ${e.services}`,
      text: lines([
        `${who} reservó${e.source ? ` desde el ${SOURCE[e.source] ?? e.source}` : ""}. Falta el depósito.`,
        "",
        ...project,
        ...contact,
        "",
        `Reserva: ${base}/dashboard/bookings/${e.bookingId}`,
      ]),
    };
  }
  return {
    subject: `💰 Pago recibido ${e.amount ?? ""} · ${e.code} · ${who}`.replace(/\s+/g, " "),
    text: lines([
      `${who} pagó${e.amount ? ` ${e.amount}` : ""} en línea. La reserva ${e.code} está confirmada.`,
      "",
      ...project,
      ...contact,
      "",
      `Reserva: ${base}/dashboard/bookings/${e.bookingId}`,
    ]),
  };
}

function lines(rows: string[]): string {
  return rows.join("\n");
}
