"use server";

import { db } from "../db";
import { parseSetting } from "../settings/schemas";
import { currentAdmin, clientIp } from "../auth/admin";
import { allowRate } from "../rate-limit";
import { bookingRequestSchema } from "@/lib/validators/booking";
import { createBooking, quoteDelivery, sessionAvailability, type DeliveryQuote, type EngineError, type SessionAvailability } from "./engine";
import { z } from "zod";
import { currentChannel } from "../analytics/attribution";

/** Online booking is open to the public only when switched on; the admin can always preview it. */
export async function bookingOpen(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: "booking" } });
  const enabled = row ? parseSetting("booking", row.value).enabled : false;
  return enabled || (await currentAdmin()) !== null;
}

const locale = z.enum(["es", "en"]);

const deliveryInput = z.object({
  services: z.array(z.string().max(60)).min(1).max(4),
  songs: z.number().int().min(1).max(20),
  requestedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locale,
});

const sessionInput = z.object({
  service: z.string().max(60),
  hours: z.number().int().min(1).max(4),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locale,
});

async function underLimit(scope: string, limit: number, windowMs: number): Promise<boolean> {
  return allowRate(`${scope}:${await clientIp()}`, limit, windowMs);
}

export async function getDeliveryQuote(input: unknown): Promise<DeliveryQuote> {
  if (!(await bookingOpen())) return { ok: false, error: "BOOKING_CLOSED" };
  const parsed = deliveryInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_QUANTITY" };
  if (!(await underLimit("quote", 120, 60 * 60_000))) return { ok: false, error: "BOOKING_CLOSED" };
  return quoteDelivery(parsed.data);
}

export async function getSessionAvailability(input: unknown): Promise<SessionAvailability> {
  if (!(await bookingOpen())) return { ok: false, error: "BOOKING_CLOSED" };
  const parsed = sessionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_DATE" };
  if (!(await underLimit("quote", 120, 60 * 60_000))) return { ok: false, error: "BOOKING_CLOSED" };
  return sessionAvailability(parsed.data);
}

export type CreateBookingResponse =
  | { ok: true; orderId: string; code: string }
  | { ok: false; error: EngineError | "INVALID" | "RATE_LIMITED"; issues?: string[] };

export async function submitBooking(input: unknown, honeypot: string): Promise<CreateBookingResponse> {
  if (!(await bookingOpen())) return { ok: false, error: "BOOKING_CLOSED" };
  // Bots fill every field; people never see this one.
  if (honeypot) return { ok: false, error: "INVALID" };
  const parsed = bookingRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID", issues: parsed.error.issues.map((i) => i.path.join(".")) };
  if (!(await underLimit("booking", 6, 60 * 60_000))) return { ok: false, error: "RATE_LIMITED" };

  const result = await createBooking(parsed.data, { source: "WEB" });
  if (!result.ok) return result;
  await recordChannel(result.bookingId);
  return { ok: true, orderId: result.orderId, code: result.code };
}

/** Remembers which channel (Instagram, YouTube…) brought this client, for the analytics. */
async function recordChannel(bookingId: string) {
  const channel = await currentChannel();
  if (channel) await db.booking.update({ where: { id: bookingId }, data: { channel } }).catch(() => null);
}
