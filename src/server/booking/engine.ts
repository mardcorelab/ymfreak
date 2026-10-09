import "server-only";
import { Prisma, type Service } from "@prisma/client";
import { db } from "../db";
import { toServiceRule } from "../catalog";
import { parseSetting } from "../settings/schemas";
import { buildQuote, PricingError, type Quote } from "../domain/pricing";
import { combinedTurnaroundDays, scheduleDelivery } from "../domain/delivery-scheduling";
import { listSessionSlots } from "../domain/session-slots";
import { addDays, CalendarError, isValidLocalDate, toLocalDate } from "../domain/calendar";
import type { ServiceRule } from "../domain/types";
import type { BookingRequest } from "@/lib/validators/booking";
import { expireStaleHolds, loadCalendar, type Db } from "./calendar";
import { dateColumn, newBookingCode } from "./code";
import { alertBooking } from "../notify";

/** How far ahead clients can pick a session date. */
export const SESSION_HORIZON_DAYS = 60;

export type EngineError =
  | "UNKNOWN_SERVICE"
  | "WRONG_MODE"
  | "INVALID_QUANTITY"
  | "NO_CAPACITY"
  | "INVALID_DATE"
  | "SLOT_TAKEN"
  | "BOOKING_CLOSED";

export interface QuoteSummary {
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  depositPercent: number;
  lines: { serviceSlug: string; name: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[];
}

export type DeliveryQuote =
  | {
      ok: true;
      quote: QuoteSummary;
      turnaroundDays: number;
      firstStartDate: string;
      deliveryDate: string;
      requested: { date: string; feasible: boolean } | null;
    }
  | { ok: false; error: EngineError };

export type SessionAvailability =
  | { ok: true; quote: QuoteSummary; durationMinutes: number; date: string; slots: string[]; timeZone: string }
  | { ok: false; error: EngineError };

function summarize(quote: Quote, services: Service[], locale: "es" | "en"): QuoteSummary {
  return {
    totalCents: quote.totalCents,
    depositCents: quote.depositCents,
    balanceCents: quote.balanceCents,
    depositPercent: quote.depositPercent,
    lines: quote.lines.map((l) => {
      const s = services.find((x) => x.slug === l.serviceSlug);
      return { ...l, name: s ? (locale === "es" ? s.nameEs : s.nameEn) : l.serviceSlug };
    }),
  };
}

async function activeServices(tx: Db, slugs: string[]): Promise<{ rows: Service[]; rules: Map<string, ServiceRule> } | null> {
  const rows = await tx.service.findMany({ where: { slug: { in: slugs }, active: true } });
  if (rows.length !== new Set(slugs).size) return null;
  return { rows, rules: new Map(rows.map((r) => [r.slug, toServiceRule(r)])) };
}

function quoteOrError(lines: { serviceSlug: string; quantity: number }[], rules: Map<string, ServiceRule>, depositPercent: number) {
  try {
    return buildQuote(lines, rules, { depositPercent });
  } catch (e) {
    if (e instanceof PricingError) return e.code === "INVALID_QUANTITY" ? ("INVALID_QUANTITY" as const) : ("UNKNOWN_SERVICE" as const);
    throw e;
  }
}

export async function quoteDelivery(
  input: { services: string[]; songs: number; requestedDeliveryDate?: string | undefined; locale: "es" | "en" },
  now = new Date(),
): Promise<DeliveryQuote> {
  await expireStaleHolds(db, now);
  const svc = await activeServices(db, input.services);
  if (!svc) return { ok: false, error: "UNKNOWN_SERVICE" };
  if (svc.rows.some((s) => s.bookingMode !== "DELIVERY")) return { ok: false, error: "WRONG_MODE" };

  const cal = await loadCalendar(db, now);
  const quote = quoteOrError(
    input.services.map((slug) => ({ serviceSlug: slug, quantity: input.songs })),
    svc.rules,
    cal.rules.depositPercent,
  );
  if (typeof quote === "string") return { ok: false, error: quote };
  if (input.requestedDeliveryDate && !isValidLocalDate(input.requestedDeliveryDate)) return { ok: false, error: "INVALID_DATE" };

  try {
    const turnaroundDays = combinedTurnaroundDays([...svc.rules.values()]);
    const schedule = scheduleDelivery({
      today: cal.today,
      songs: input.songs,
      turnaroundDays,
      startsUsed: cal.startsUsed,
      rules: cal.rules,
      blocked: cal.blocked,
      ...(input.requestedDeliveryDate ? { requestedDeliveryDate: input.requestedDeliveryDate } : {}),
    });
    return {
      ok: true,
      quote: summarize(quote, svc.rows, input.locale),
      turnaroundDays,
      firstStartDate: schedule.firstStartDate,
      deliveryDate: schedule.deliveryDate,
      requested: schedule.requested ?? null,
    };
  } catch (e) {
    if (e instanceof CalendarError) return { ok: false, error: "NO_CAPACITY" };
    throw e;
  }
}

export async function sessionAvailability(
  input: { service: string; hours: number; date: string; locale: "es" | "en" },
  now = new Date(),
): Promise<SessionAvailability> {
  await expireStaleHolds(db, now);
  const svc = await activeServices(db, [input.service]);
  const service = svc?.rows[0];
  if (!svc || !service) return { ok: false, error: "UNKNOWN_SERVICE" };
  if (service.bookingMode !== "SESSION" || !service.sessionMinutes) return { ok: false, error: "WRONG_MODE" };

  const cal = await loadCalendar(db, now);
  if (!isValidLocalDate(input.date) || input.date < cal.today || input.date > addDays(cal.today, SESSION_HORIZON_DAYS)) {
    return { ok: false, error: "INVALID_DATE" };
  }
  const quote = quoteOrError([{ serviceSlug: input.service, quantity: input.hours }], svc.rules, cal.rules.depositPercent);
  if (typeof quote === "string") return { ok: false, error: quote };

  const durationMinutes = service.sessionMinutes * input.hours;
  const slots = listSessionSlots({ date: input.date, durationMinutes, now, rules: cal.rules, blocked: cal.blocked, busy: cal.busy });
  return {
    ok: true,
    quote: summarize(quote, svc.rows, input.locale),
    durationMinutes,
    date: input.date,
    slots: slots.map((s) => s.start.toISOString()),
    timeZone: cal.rules.timeZone,
  };
}

export type CreateResult =
  | { ok: true; bookingId: string; code: string; orderId: string }
  | { ok: false; error: EngineError };

class Abort extends Error {
  constructor(public readonly code: EngineError) {
    super(code);
  }
}

/**
 * Creates customer + order + booking atomically, re-checking price and
 * availability inside a serializable transaction so two clients can never
 * take the same capacity or session slot.
 *
 * WEB and AGENT (assistant, after the visitor confirms) bookings are held for
 * `holdMinutes` while the client pays the deposit.
 * ADMIN bookings (arranged directly with YM Freak) start CONFIRMED with the
 * deposit recorded as paid outside the website.
 */
export async function createBooking(
  req: BookingRequest,
  opts: { source: "WEB" | "AGENT" | "ADMIN"; now?: Date },
): Promise<CreateResult> {
  const now = opts.now ?? new Date();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await db.$transaction(
        async (tx) => {
          await expireStaleHolds(tx, now);
          const slugs = req.mode === "DELIVERY" ? req.services : [req.service];
          const quantity = req.mode === "DELIVERY" ? req.songs : req.hours;
          const svc = await activeServices(tx, slugs);
          if (!svc) throw new Abort("UNKNOWN_SERVICE");
          if (svc.rows.some((s) => s.bookingMode !== req.mode)) throw new Abort("WRONG_MODE");

          const cal = await loadCalendar(tx, now);
          const quote = quoteOrError(slugs.map((s) => ({ serviceSlug: s, quantity })), svc.rules, cal.rules.depositPercent);
          if (typeof quote === "string") throw new Abort(quote);

          // Availability, decided again here — never trusted from the browser.
          let delivery: { firstStartDate: string; deliveryDate: string; starts: { date: string; projects: number }[] } | null = null;
          let session: { start: Date; end: Date } | null = null;
          if (req.mode === "DELIVERY") {
            try {
              const s = scheduleDelivery({
                today: cal.today,
                songs: req.songs,
                turnaroundDays: combinedTurnaroundDays([...svc.rules.values()]),
                startsUsed: cal.startsUsed,
                rules: cal.rules,
                blocked: cal.blocked,
              });
              delivery = { firstStartDate: s.firstStartDate, deliveryDate: s.deliveryDate, starts: s.starts };
            } catch (e) {
              if (e instanceof CalendarError) throw new Abort("NO_CAPACITY");
              throw e;
            }
          } else {
            const start = new Date(req.startsAt);
            const service = svc.rows[0]!;
            const date = toLocalDate(start, cal.rules.timeZone);
            const slots = listSessionSlots({
              date,
              durationMinutes: (service.sessionMinutes ?? 60) * req.hours,
              now,
              rules: cal.rules,
              blocked: cal.blocked,
              busy: cal.busy,
            });
            const match = slots.find((s) => s.start.getTime() === start.getTime());
            if (!match) throw new Abort("SLOT_TAKEN");
            session = match;
          }

          const bookingSetting = await tx.setting.findUnique({ where: { key: "booking" } });
          const holdMinutes = bookingSetting ? parseSetting("booking", bookingSetting.value).holdMinutes : 30;

          const email = req.customer.email;
          const customer =
            (await tx.customer.findUnique({ where: { email } })) ??
            (await tx.customer.create({
              data: {
                email,
                name: req.customer.name,
                artistName: req.project.artistName || null,
                phone: req.customer.phone ?? null,
                country: req.customer.country ?? null,
                locale: req.customer.locale,
              },
            }));

          const admin = opts.source === "ADMIN";
          const order = await tx.order.create({
            data: {
              customerId: customer.id,
              status: admin ? "DEPOSIT_PAID" : "AWAITING_DEPOSIT",
              totalCents: quote.totalCents,
              depositCents: quote.depositCents,
              balanceCents: quote.balanceCents,
              items: {
                create: quote.lines.map((l) => {
                  const s = svc.rows.find((x) => x.slug === l.serviceSlug)!;
                  return { serviceId: s.id, nameSnapshot: s.nameEs, unitPriceCents: l.unitPriceCents, quantity: l.quantity };
                }),
              },
              ...(admin
                ? {
                    payments: {
                      create: {
                        kind: "DEPOSIT",
                        provider: "manual",
                        providerRef: `manual-${crypto.randomUUID()}`,
                        amountCents: quote.depositCents,
                        status: "SUCCEEDED",
                        paidAt: now,
                      },
                    },
                  }
                : {}),
            },
          });

          let code = newBookingCode();
          while (await tx.booking.findUnique({ where: { code }, select: { id: true } })) code = newBookingCode();

          const status = admin ? "CONFIRMED" : "AWAITING_PAYMENT";
          const booking = await tx.booking.create({
            data: {
              code,
              customerId: customer.id,
              bookingMode: req.mode,
              status,
              source: opts.source,
              quantity,
              orderId: order.id,
              holdExpiresAt: admin ? null : new Date(now.getTime() + holdMinutes * 60_000),
              startsAt: session?.start ?? null,
              endsAt: session?.end ?? null,
              firstStartDate: delivery ? dateColumn(delivery.firstStartDate) : null,
              deliveryDate: delivery ? dateColumn(delivery.deliveryDate) : null,
              projectDetails: {
                ...req.project,
                ...(req.mode === "DELIVERY" && req.requestedDeliveryDate ? { requestedDeliveryDate: req.requestedDeliveryDate } : {}),
              },
              items: { create: svc.rows.map((s) => ({ serviceId: s.id, quantity })) },
              capacity: delivery ? { create: delivery.starts.map((s) => ({ day: dateColumn(s.date), projects: s.projects })) } : undefined,
              events: {
                create: { from: null, to: status, actor: admin ? "admin" : "client", note: admin ? "Reserva creada desde el panel" : opts.source === "AGENT" ? "Reserva creada con el asistente (confirmada por el cliente)" : "Reserva creada en la web" },
              },
            },
          });

          return { ok: true as const, bookingId: booking.id, code, orderId: order.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 },
      );
      if (res.ok && opts.source !== "ADMIN") await alertBooking(res.bookingId, "booking");
      return res;
    } catch (e) {
      if (e instanceof Abort) return { ok: false, error: e.code };
      // Serialization conflict: another booking landed at the same time. Retry with fresh data.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034" && attempt < 3) continue;
      // Exclusion constraint: the session slot was taken concurrently.
      if (e instanceof Prisma.PrismaClientUnknownRequestError && /booking_session_no_overlap|23P01/.test(e.message)) {
        return { ok: false, error: "SLOT_TAKEN" };
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && /booking_session_no_overlap|23P01/.test(e.message)) {
        return { ok: false, error: "SLOT_TAKEN" };
      }
      throw e;
    }
  }
  return { ok: false, error: "NO_CAPACITY" };
}
