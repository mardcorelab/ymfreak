/**
 * Time slots for SESSION services (remote coaching, remote vocal recording).
 * Sessions happen inside working hours on working days, never overlap an
 * existing session, and need `sessionLeadHours` of notice.
 *
 * The database also enforces non-overlap with an exclusion constraint, so two
 * clients paying at the same moment can never get the same slot. This module
 * decides what to offer; the constraint is the final guard.
 */
import { isWorkingDay, parseLocalTime, zonedToUtc } from "./calendar";
import type { BlockedPeriod, BusinessRules, BusyInterval, LocalDate } from "./types";

export interface SessionSlot {
  start: Date;
  end: Date;
}

export interface SessionSlotsInput {
  date: LocalDate;
  durationMinutes: number;
  now: Date;
  rules: Pick<BusinessRules, "timeZone" | "workingWeekdays" | "workdayStart" | "workdayEnd" | "sessionLeadHours">;
  blocked: readonly BlockedPeriod[];
  busy: readonly BusyInterval[];
  /** Distance between candidate start times. Defaults to 60 minutes. */
  stepMinutes?: number;
}

export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function listSessionSlots(input: SessionSlotsInput): SessionSlot[] {
  const { date, durationMinutes, now, rules, blocked, busy, stepMinutes = 60 } = input;

  if (!Number.isInteger(durationMinutes) || durationMinutes < 15) {
    throw new RangeError(`durationMinutes must be an integer >= 15, got ${durationMinutes}`);
  }
  if (!isWorkingDay(date, rules, blocked)) return [];

  const dayStart = parseLocalTime(rules.workdayStart);
  const dayEnd = parseLocalTime(rules.workdayEnd);
  const earliest = new Date(now.getTime() + rules.sessionLeadHours * 3_600_000);

  const slots: SessionSlot[] = [];
  for (let minute = dayStart; minute + durationMinutes <= dayEnd; minute += stepMinutes) {
    const start = zonedToUtc(date, minute, rules.timeZone);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const slot = { start, end };
    if (start < earliest) continue;
    if (busy.some((b) => overlaps(slot, b))) continue;
    slots.push(slot);
  }
  return slots;
}
