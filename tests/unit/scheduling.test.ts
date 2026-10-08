import { test } from "node:test";
import assert from "node:assert/strict";
import { combinedTurnaroundDays, scheduleDelivery } from "../../src/server/domain/delivery-scheduling";
import { listSessionSlots } from "../../src/server/domain/session-slots";
import { isoWeekday, toLocalDate, zonedToUtc, nthWorkingDayAfter } from "../../src/server/domain/calendar";
import { businessRulesSeed as rules } from "../../content/business";
import { serviceSeeds } from "../../content/services";
import type { ServiceRule } from "../../src/server/domain/types";

const svc = (slug: string): ServiceRule => {
  const s = serviceSeeds.find((x) => x.slug === slug);
  if (!s) throw new Error(slug);
  return { ...s, currency: "USD", active: true };
};

// 2026-10-08 is a Thursday.
const THU = "2026-10-08";

test("calendar basics", () => {
  assert.equal(isoWeekday(THU), 4);
  assert.equal(nthWorkingDayAfter(THU, 1, rules, []), "2026-10-09"); // Fri
  assert.equal(nthWorkingDayAfter(THU, 2, rules, []), "2026-10-12"); // skips weekend → Mon
});

test("Santo Domingo is UTC-4: 08:00 local = 12:00 UTC", () => {
  const instant = zonedToUtc("2026-10-09", 8 * 60, rules.timeZone);
  assert.equal(instant.toISOString(), "2026-10-09T12:00:00.000Z");
  assert.equal(toLocalDate(new Date("2026-10-09T03:30:00Z"), rules.timeZone), "2026-10-08");
});

test("one mix booked Thursday: starts Friday, delivered Wednesday (4 working days)", () => {
  const s = scheduleDelivery({ today: THU, songs: 1, turnaroundDays: 4, startsUsed: new Map(), rules, blocked: [] });
  assert.equal(s.firstStartDate, "2026-10-09");
  assert.equal(s.deliveryDate, "2026-10-14"); // Fri, Mon, Tue, Wed
});

test("beat + mix & master add up to 8 working days", () => {
  const days = combinedTurnaroundDays([svc("creacion-de-pista"), svc("mezcla-mastering")]);
  assert.equal(days, 8);
  const s = scheduleDelivery({ today: THU, songs: 1, turnaroundDays: days, startsUsed: new Map(), rules, blocked: [] });
  assert.equal(s.deliveryDate, "2026-10-20"); // Fri 9 … Tue 20
});

test("capacity: 2 starts per day, third song rolls to the next working day", () => {
  const s = scheduleDelivery({ today: THU, songs: 3, turnaroundDays: 4, startsUsed: new Map(), rules, blocked: [] });
  assert.deepEqual(s.starts, [
    { date: "2026-10-09", projects: 2 },
    { date: "2026-10-12", projects: 1 },
  ]);
  assert.equal(s.deliveryDate, "2026-10-15");
});

test("a full day is skipped; existing bookings are respected", () => {
  const startsUsed = new Map([["2026-10-09", 2]]);
  const s = scheduleDelivery({ today: THU, songs: 1, turnaroundDays: 4, startsUsed, rules, blocked: [] });
  assert.equal(s.firstStartDate, "2026-10-12");
  assert.equal(s.deliveryDate, "2026-10-15");
});

test("blocked days are neither start days nor counted as working days", () => {
  const blocked = [{ from: "2026-10-12", to: "2026-10-13" }];
  const s = scheduleDelivery({ today: THU, songs: 1, turnaroundDays: 4, startsUsed: new Map(), rules, blocked });
  // Fri 9 (1), Mon/Tue blocked, Wed 14 (2), Thu 15 (3), Fri 16 (4)
  assert.equal(s.deliveryDate, "2026-10-16");
});

test("answers 'can you deliver by Friday?' with the real date", () => {
  const yes = scheduleDelivery({
    today: THU, songs: 1, turnaroundDays: 4, startsUsed: new Map(), rules, blocked: [], requestedDeliveryDate: "2026-10-16",
  });
  assert.deepEqual(yes.requested, { date: "2026-10-16", feasible: true });

  const no = scheduleDelivery({
    today: THU, songs: 1, turnaroundDays: 4, startsUsed: new Map(), rules, blocked: [], requestedDeliveryDate: "2026-10-09",
  });
  assert.deepEqual(no.requested, { date: "2026-10-09", feasible: false });
  assert.equal(no.deliveryDate, "2026-10-14");
});

test("session slots: hourly between 08:00 and 18:00, minus busy and notice period", () => {
  const now = new Date("2026-10-08T12:00:00Z"); // Thu 08:00 local
  const slots = listSessionSlots({ date: "2026-10-09", durationMinutes: 60, now, rules, blocked: [], busy: [] });
  assert.equal(slots.length, 10); // 08–09 … 17–18
  // 12 h notice → Fri 00:00 local is the earliest, so all Friday slots are fine.
  assert.equal(slots[0]?.start.toISOString(), "2026-10-09T12:00:00.000Z");
  assert.equal(slots.at(-1)?.end.toISOString(), "2026-10-09T22:00:00.000Z");

  const busy = [{ start: new Date("2026-10-09T13:00:00Z"), end: new Date("2026-10-09T15:00:00Z") }];
  const fewer = listSessionSlots({ date: "2026-10-09", durationMinutes: 60, now, rules, blocked: [], busy });
  assert.equal(fewer.length, 8);

  const twoHours = listSessionSlots({ date: "2026-10-09", durationMinutes: 120, now, rules, blocked: [], busy: [] });
  assert.equal(twoHours.at(-1)?.start.toISOString(), "2026-10-09T20:00:00.000Z"); // 16:00 local

  const weekend = listSessionSlots({ date: "2026-10-10", durationMinutes: 60, now, rules, blocked: [], busy: [] });
  assert.equal(weekend.length, 0);

  const sameDay = listSessionSlots({ date: "2026-10-08", durationMinutes: 60, now, rules, blocked: [], busy: [] });
  assert.equal(sameDay.length, 0); // all within 12 h notice
});
