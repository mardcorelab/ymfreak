import "server-only";
import { after } from "next/server";
import { env } from "@/server/env";
import { db } from "@/server/db";
import { formatMoney } from "@/server/domain/money";
import { buildAlert, type AlertEvent } from "@/lib/alerts";

/**
 * Alerts to YM Freak when something needs him: a visitor the assistant got
 * close to booking, a new booking, a payment. Sent by email through Resend
 * only when RESEND_API_KEY is set; otherwise the dashboard is the only place
 * they show (it always lists recent leads). Never throws and never delays the
 * visitor: the email goes out after the response.
 */

export function emailAlertsConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && alertRecipient());
}

function alertRecipient(): string | null {
  const to = (env.ALERT_EMAIL || env.ADMIN_EMAIL || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ? to : null;
}

export function alertOwner(event: AlertEvent): void {
  if (!emailAlertsConfigured()) return;
  const job = () => sendAlert(event).catch((e) => console.error("[alerts] failed", e instanceof Error ? e.message : e));
  try {
    after(job);
  } catch {
    // Outside a request (scripts, tests): send right away.
    void job();
  }
}

async function sendAlert(event: AlertEvent): Promise<void> {
  const to = alertRecipient();
  if (!env.RESEND_API_KEY || !to) return;
  const { subject, text } = buildAlert(event, env.NEXT_PUBLIC_SITE_URL);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "YM Freak <onboarding@resend.dev>", to: [to], subject, text }),
      signal: ctrl.signal,
    });
    if (!res.ok) console.error("[alerts] resend", res.status, (await res.text()).slice(0, 300));
  } finally {
    clearTimeout(timer);
  }
}

/** Alert for a booking that was just created or paid, read fresh from the database. */
export async function alertBooking(bookingId: string, kind: "booking" | "payment", amountCents?: number): Promise<void> {
  if (!emailAlertsConfigured()) return;
  try {
    const b = await db.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, order: true, items: { include: { service: true } } },
    });
    if (!b) return;
    const details = (b.projectDetails ?? {}) as { artistName?: string; songTitle?: string };
    alertOwner({
      kind,
      code: b.code,
      bookingId: b.id,
      name: b.customer.name,
      email: b.customer.email,
      phone: b.customer.phone,
      services: b.items.map((i) => i.service.nameEs).join(" + "),
      artist: details.artistName ?? null,
      song: details.songTitle ?? null,
      source: b.source,
      total: b.order ? formatMoney(b.order.totalCents, "USD", "es") : null,
      amount: amountCents !== undefined ? formatMoney(amountCents, "USD", "es") : null,
    });
  } catch (e) {
    console.error("[alerts] booking lookup failed", e instanceof Error ? e.message : e);
  }
}
