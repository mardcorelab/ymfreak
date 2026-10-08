import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTransition, nextStatuses, isTerminal } from "../../src/server/domain/booking-status";
import { evaluateClientCancellation } from "../../src/server/domain/cancellation";
import { businessRulesSeed as rules } from "../../content/business";

const sys = { actor: "system" as const, balancePaid: false };

test("happy path through the lifecycle", () => {
  assert.deepEqual(checkTransition("PENDING", "AWAITING_PAYMENT", sys), { ok: true });
  assert.deepEqual(checkTransition("AWAITING_PAYMENT", "PAID", sys), { ok: true });
  assert.deepEqual(checkTransition("PAID", "CONFIRMED", sys), { ok: true });
  assert.deepEqual(checkTransition("CONFIRMED", "IN_PROGRESS", { actor: "admin", balancePaid: false }), { ok: true });
  assert.deepEqual(checkTransition("IN_PROGRESS", "DELIVERED", { actor: "admin", balancePaid: false }), { ok: true });
  assert.deepEqual(checkTransition("DELIVERED", "REVISION", { actor: "client", balancePaid: false }), { ok: true });
  assert.deepEqual(checkTransition("REVISION", "DELIVERED", { actor: "admin", balancePaid: false }), { ok: true });
  assert.deepEqual(checkTransition("DELIVERED", "COMPLETED", { actor: "admin", balancePaid: true }), { ok: true });
});

test("cannot complete before the 50% balance is paid", () => {
  assert.deepEqual(checkTransition("DELIVERED", "COMPLETED", { actor: "admin", balancePaid: false }), {
    ok: false,
    reason: "BALANCE_UNPAID",
  });
});

test("only the payment system can mark a deposit as paid", () => {
  assert.deepEqual(checkTransition("AWAITING_PAYMENT", "PAID", { actor: "client", balancePaid: false }), {
    ok: false,
    reason: "ACTOR_NOT_ALLOWED",
  });
  assert.deepEqual(checkTransition("AWAITING_PAYMENT", "PAID", { actor: "admin", balancePaid: false }), {
    ok: false,
    reason: "ACTOR_NOT_ALLOWED",
  });
});

test("illegal jumps are rejected and final states are terminal", () => {
  assert.deepEqual(checkTransition("PENDING", "COMPLETED", sys), { ok: false, reason: "NOT_ALLOWED" });
  assert.deepEqual(checkTransition("CANCELLED", "CONFIRMED", sys), { ok: false, reason: "NOT_ALLOWED" });
  assert.ok(isTerminal("COMPLETED") && isTerminal("CANCELLED") && isTerminal("EXPIRED"));
  assert.deepEqual(nextStatuses("REVISION", "client"), []);
});

test("cancellation: free before paying, full refund within 24 h, closed afterwards", () => {
  const paidAt = new Date("2026-10-08T15:00:00Z");
  const base = { depositPaidAt: paidAt, depositPaidCents: 7500, rules };

  assert.deepEqual(
    evaluateClientCancellation({ ...base, status: "AWAITING_PAYMENT", depositPaidAt: null, now: paidAt }),
    { allowed: true, refundCents: 0, deadline: null },
  );

  const within = evaluateClientCancellation({ ...base, status: "CONFIRMED", now: new Date("2026-10-09T14:59:00Z") });
  assert.equal(within.allowed, true);
  assert.equal(within.allowed && within.refundCents, 7500);

  const after = evaluateClientCancellation({ ...base, status: "CONFIRMED", now: new Date("2026-10-09T15:01:00Z") });
  assert.deepEqual(after, { allowed: false, reason: "WINDOW_CLOSED", deadline: new Date("2026-10-09T15:00:00Z") });

  const delivered = evaluateClientCancellation({ ...base, status: "DELIVERED", now: paidAt });
  assert.equal(delivered.allowed, false);
});
