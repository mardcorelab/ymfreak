import "server-only";
import type { BookingStatus, Prisma, PrismaClient } from "@prisma/client";
import { parseSetting } from "../settings/schemas";
import { toLocalDate } from "../domain/calendar";
import type { BlockedPeriod, BusinessRules, BusyInterval, LocalDate } from "../domain/types";
import { dateColumn, fromDateColumn } from "./code";

export type Db = PrismaClient | Prisma.TransactionClient;

/** Bookings in these statuses always occupy the calendar. */
const FIRM: BookingStatus[] = ["PAID", "CONFIRMED", "IN_PROGRESS", "DELIVERED", "REVISION"];

/** Firm bookings, plus bookings whose payment hold has not expired yet. */
export function occupyingBookings(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [{ status: { in: FIRM } }, { status: "AWAITING_PAYMENT", holdExpiresAt: { gt: now } }],
  };
}

export interface CalendarContext {
  rules: BusinessRules;
  today: LocalDate;
  blocked: BlockedPeriod[];
  startsUsed: Map<LocalDate, number>;
  busy: BusyInterval[];
}

export async function loadCalendar(db: Db, now: Date): Promise<CalendarContext> {
  const row = await db.setting.findUnique({ where: { key: "business_rules" } });
  if (!row) throw new Error('Missing setting "business_rules". Run the seed.');
  const rules = parseSetting("business_rules", row.value);
  const today = toLocalDate(now, rules.timeZone);
  const todayCol = dateColumn(today);

  const [blockedRows, capacity, sessions] = await Promise.all([
    db.blockedPeriod.findMany({ where: { toDate: { gte: todayCol } } }),
    db.capacityUse.findMany({ where: { day: { gte: todayCol }, booking: occupyingBookings(now) }, select: { day: true, projects: true } }),
    db.booking.findMany({
      where: { bookingMode: "SESSION", endsAt: { gt: now }, ...occupyingBookings(now) },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const startsUsed = new Map<LocalDate, number>();
  for (const c of capacity) {
    const day = fromDateColumn(c.day);
    startsUsed.set(day, (startsUsed.get(day) ?? 0) + c.projects);
  }

  return {
    rules,
    today,
    blocked: blockedRows.map((b) => ({ from: fromDateColumn(b.fromDate), to: fromDateColumn(b.toDate) })),
    startsUsed,
    busy: sessions.flatMap((s) => (s.startsAt && s.endsAt ? [{ start: s.startsAt, end: s.endsAt }] : [])),
  };
}

/**
 * Marks bookings whose payment hold ran out as EXPIRED (and their orders as
 * cancelled). Runs before every availability check and booking, so expired
 * holds never block the calendar or the session no-overlap constraint.
 */
export async function expireStaleHolds(db: Db, now: Date): Promise<number> {
  const stale = await db.booking.findMany({
    where: { status: "AWAITING_PAYMENT", holdExpiresAt: { lte: now } },
    select: { id: true, orderId: true },
  });
  for (const b of stale) {
    await db.booking.update({ where: { id: b.id }, data: { status: "EXPIRED" } });
    await db.bookingEvent.create({
      data: { bookingId: b.id, from: "AWAITING_PAYMENT", to: "EXPIRED", actor: "system", note: "Payment hold expired" },
    });
    if (b.orderId) {
      await db.order.updateMany({ where: { id: b.orderId, status: "AWAITING_DEPOSIT" }, data: { status: "CANCELLED" } });
    }
  }
  return stale.length;
}
