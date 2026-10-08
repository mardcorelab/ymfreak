/**
 * Calendar helpers that work on local dates (YYYY-MM-DD) in the business time
 * zone. Working with plain local dates for day-level logic avoids the classic
 * off-by-one bugs of mixing UTC instants and local days.
 */
import type { BlockedPeriod, BusinessRules, LocalDate, LocalTime } from "./types";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseLocalDate(value: LocalDate): Date {
  const match = DATE_RE.exec(value);
  if (!match) throw new RangeError(`Invalid local date: ${value}`);
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (formatUtcDate(date) !== value) throw new RangeError(`Invalid local date: ${value}`);
  return date;
}

function formatUtcDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function isValidLocalDate(value: string): boolean {
  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(value: LocalDate, days: number): LocalDate {
  const date = parseLocalDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(value: LocalDate): number {
  const day = parseLocalDate(value).getUTCDay();
  return day === 0 ? 7 : day;
}

export function parseLocalTime(value: LocalTime): number {
  const match = TIME_RE.exec(value);
  if (!match) throw new RangeError(`Invalid local time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** The local calendar date of an instant in the given time zone. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Offset of the time zone from UTC at a given instant, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Converts a local date + wall-clock minutes into a UTC instant. */
export function zonedToUtc(date: LocalDate, minutesOfDay: number, timeZone: string): Date {
  const base = parseLocalDate(date).getTime() + minutesOfDay * 60_000;
  // Two passes handle zones with daylight-saving transitions.
  let guess = new Date(base - offsetMinutes(new Date(base), timeZone) * 60_000);
  guess = new Date(base - offsetMinutes(guess, timeZone) * 60_000);
  return guess;
}

export function isBlocked(date: LocalDate, blocked: readonly BlockedPeriod[]): boolean {
  return blocked.some((period) => date >= period.from && date <= period.to);
}

export function isWorkingDay(
  date: LocalDate,
  rules: Pick<BusinessRules, "workingWeekdays">,
  blocked: readonly BlockedPeriod[],
): boolean {
  return rules.workingWeekdays.includes(isoWeekday(date)) && !isBlocked(date, blocked);
}

/** Safety limit so a misconfigured calendar can never loop forever. */
export const MAX_SEARCH_DAYS = 366;

/**
 * Returns the n-th working day strictly after `from` (n >= 1).
 * Throws if no such day exists within MAX_SEARCH_DAYS.
 */
export function nthWorkingDayAfter(
  from: LocalDate,
  n: number,
  rules: Pick<BusinessRules, "workingWeekdays">,
  blocked: readonly BlockedPeriod[],
): LocalDate {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`n must be a positive integer, got ${n}`);
  let current = from;
  let found = 0;
  for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
    current = addDays(current, 1);
    if (isWorkingDay(current, rules, blocked) && ++found === n) return current;
  }
  throw new CalendarError("NO_WORKING_DAYS", `No working day found within ${MAX_SEARCH_DAYS} days of ${from}`);
}

export class CalendarError extends Error {
  constructor(
    public readonly code: "NO_WORKING_DAYS" | "NO_CAPACITY",
    message: string,
  ) {
    super(message);
    this.name = "CalendarError";
  }
}
