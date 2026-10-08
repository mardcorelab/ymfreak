import { test } from "node:test";
import assert from "node:assert/strict";
import { dateColumn, fromDateColumn, isBookingCode, newBookingCode } from "../../src/server/booking/code";

test("booking codes are short, readable and well-formed", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const code = newBookingCode();
    assert.ok(isBookingCode(code), code);
    assert.ok(!/[01IO]/.test(code.slice(4)), code);
    seen.add(code);
  }
  assert.ok(seen.size > 1990, "codes should practically never repeat");
  assert.equal(newBookingCode(() => new Uint8Array([0, 1, 2, 3, 31])), "YMF-2345Z");
  assert.equal(isBookingCode("YMF-ABC"), false);
});

test("date columns round-trip local dates without time-zone drift", () => {
  for (const d of ["2026-10-08", "2026-12-31", "2027-03-14"]) {
    assert.equal(fromDateColumn(dateColumn(d)), d);
  }
});
