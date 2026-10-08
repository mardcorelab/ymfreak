/**
 * Domain types shared by pricing, scheduling and booking logic.
 *
 * These types are deliberately independent of Prisma so the business rules
 * can be unit-tested without a database. Mappers in the data layer convert
 * Prisma rows into these shapes.
 */

/** A calendar date in the business time zone, formatted YYYY-MM-DD. */
export type LocalDate = string;

/** A wall-clock time in the business time zone, formatted HH:mm. */
export type LocalTime = string;

export type PricingUnit = "FLAT" | "PER_SONG" | "PER_HOUR";

/**
 * DELIVERY: work done off-line and delivered by a date (mix, beat, ad…).
 * SESSION: a live remote session at a specific time (coaching, vocal recording).
 */
export type BookingMode = "DELIVERY" | "SESSION";

export interface ServiceRule {
  slug: string;
  priceCents: number;
  currency: "USD";
  pricingUnit: PricingUnit;
  bookingMode: BookingMode;
  /** Working days needed per unit of work (DELIVERY only). */
  turnaroundDays: number | null;
  /** Length of one unit in minutes (SESSION only). */
  sessionMinutes: number | null;
  /** Free revisions included per song (DELIVERY only). */
  revisionsIncluded: number;
  active: boolean;
}

export interface BusinessRules {
  /** IANA zone used for every date the client or the admin sees. */
  timeZone: string;
  /** ISO weekdays that are working days: 1 = Monday … 7 = Sunday. */
  workingWeekdays: number[];
  workdayStart: LocalTime;
  workdayEnd: LocalTime;
  /** How many new DELIVERY projects can start on a single working day. */
  dailyProjectStarts: number;
  /** Working days between booking and the earliest possible start (1 = next working day). */
  leadWorkingDays: number;
  /** Minimum hours between "now" and the start of a SESSION. */
  sessionLeadHours: number;
  depositPercent: number;
  revisionFeeCents: number;
  cancellationWindowHours: number;
}

/** A period during which no work starts and no session can be booked. */
export interface BlockedPeriod {
  /** Inclusive local date. */
  from: LocalDate;
  /** Inclusive local date. */
  to: LocalDate;
}

/** An already booked session, as UTC instants. */
export interface BusyInterval {
  start: Date;
  end: Date;
}
