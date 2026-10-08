/**
 * Delivery scheduling for DELIVERY services (mix & master, beats, arrangements, ads…).
 *
 * Model (all values come from BusinessRules / ServiceRule, never hard-coded):
 *  - Each song is one project.
 *  - At most `dailyProjectStarts` projects can start on a working day.
 *  - Work can start `leadWorkingDays` working days after the booking date.
 *  - A project takes `turnaroundDays` working days, counting its start day as day 1.
 *    When several DELIVERY services are combined for the same song (e.g. beat +
 *    mix & master) their turnaround days are added up.
 *  - Blocked periods are not working days.
 */
import { CalendarError, isWorkingDay, MAX_SEARCH_DAYS, nthWorkingDayAfter, addDays } from "./calendar";
import type { BlockedPeriod, BusinessRules, LocalDate, ServiceRule } from "./types";

export interface DeliveryScheduleInput {
  /** Today's date in the business time zone. */
  today: LocalDate;
  songs: number;
  turnaroundDays: number;
  /** Project starts already committed per day (confirmed bookings + active payment holds). */
  startsUsed: ReadonlyMap<LocalDate, number>;
  rules: Pick<BusinessRules, "workingWeekdays" | "dailyProjectStarts" | "leadWorkingDays">;
  blocked: readonly BlockedPeriod[];
  /** Optional date the client asked for, to answer "can you deliver by Friday?". */
  requestedDeliveryDate?: LocalDate;
}

export interface DeliverySchedule {
  /** Where each project starts: one entry per day used. */
  starts: { date: LocalDate; projects: number }[];
  firstStartDate: LocalDate;
  /** Day the last song is delivered. */
  deliveryDate: LocalDate;
  /** Present only when a requested date was given. */
  requested?: { date: LocalDate; feasible: boolean };
}

/** Sum of turnaround days of the DELIVERY services booked for the same song. */
export function combinedTurnaroundDays(services: readonly ServiceRule[]): number {
  const delivery = services.filter((s) => s.bookingMode === "DELIVERY");
  if (delivery.length === 0) throw new RangeError("No DELIVERY services given");
  return delivery.reduce((sum, s) => {
    if (s.turnaroundDays === null || !Number.isInteger(s.turnaroundDays) || s.turnaroundDays < 1) {
      throw new RangeError(`Service ${s.slug} has no valid turnaroundDays`);
    }
    return sum + s.turnaroundDays;
  }, 0);
}

export function scheduleDelivery(input: DeliveryScheduleInput): DeliverySchedule {
  const { today, songs, turnaroundDays, startsUsed, rules, blocked, requestedDeliveryDate } = input;

  if (!Number.isInteger(songs) || songs < 1) throw new RangeError(`songs must be a positive integer, got ${songs}`);
  if (!Number.isInteger(turnaroundDays) || turnaroundDays < 1) {
    throw new RangeError(`turnaroundDays must be a positive integer, got ${turnaroundDays}`);
  }
  if (!Number.isInteger(rules.dailyProjectStarts) || rules.dailyProjectStarts < 1) {
    throw new CalendarError("NO_CAPACITY", "dailyProjectStarts must be at least 1");
  }

  const starts: { date: LocalDate; projects: number }[] = [];
  let remaining = songs;
  let day =
    rules.leadWorkingDays > 0 ? nthWorkingDayAfter(today, rules.leadWorkingDays, rules, blocked) : today;

  for (let i = 0; remaining > 0; i++) {
    if (i > MAX_SEARCH_DAYS) {
      throw new CalendarError("NO_CAPACITY", `No capacity found within ${MAX_SEARCH_DAYS} days`);
    }
    if (isWorkingDay(day, rules, blocked)) {
      const free = rules.dailyProjectStarts - (startsUsed.get(day) ?? 0);
      if (free > 0) {
        const take = Math.min(free, remaining);
        starts.push({ date: day, projects: take });
        remaining -= take;
      }
    }
    if (remaining > 0) day = addDays(day, 1);
  }

  const firstStart = starts[0];
  const lastStart = starts[starts.length - 1];
  if (!firstStart || !lastStart) throw new CalendarError("NO_CAPACITY", "Could not allocate any start day");

  const deliveryDate =
    turnaroundDays === 1
      ? lastStart.date
      : nthWorkingDayAfter(lastStart.date, turnaroundDays - 1, rules, blocked);

  return {
    starts,
    firstStartDate: firstStart.date,
    deliveryDate,
    ...(requestedDeliveryDate
      ? { requested: { date: requestedDeliveryDate, feasible: deliveryDate <= requestedDeliveryDate } }
      : {}),
  };
}
