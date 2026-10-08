import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuote, PricingError, revisionCharge } from "../../src/server/domain/pricing";
import { splitDeposit, formatMoney } from "../../src/server/domain/money";
import { serviceSeeds } from "../../content/services";
import { businessRulesSeed } from "../../content/business";
import type { ServiceRule } from "../../src/server/domain/types";

const services = new Map<string, ServiceRule>(
  serviceSeeds.map((s) => [s.slug, { ...s, currency: "USD", active: true }]),
);

test("mix & master for one song: $150 total, $75 deposit, $75 balance", () => {
  const quote = buildQuote([{ serviceSlug: "mezcla-mastering", quantity: 1 }], services, businessRulesSeed);
  assert.equal(quote.totalCents, 15000);
  assert.equal(quote.depositCents, 7500);
  assert.equal(quote.balanceCents, 7500);
});

test("quantities multiply and lines add up", () => {
  const quote = buildQuote(
    [
      { serviceSlug: "mezcla-mastering", quantity: 3 },
      { serviceSlug: "asesoria-productores", quantity: 2 },
    ],
    services,
    businessRulesSeed,
  );
  assert.equal(quote.totalCents, 3 * 15000 + 2 * 5000);
  assert.equal(quote.depositCents + quote.balanceCents, quote.totalCents);
});

test("deposit split always sums to the total, even with odd cents", () => {
  for (const total of [1, 3, 999, 2501, 27001]) {
    const { depositCents, balanceCents } = splitDeposit(total, 50);
    assert.equal(depositCents + balanceCents, total);
  }
});

test("rejects unknown, inactive, duplicate services and bad quantities", () => {
  const inactive = new Map(services);
  inactive.set("mastering", { ...services.get("mastering")!, active: false });

  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof PricingError ? e.code : "OTHER";
    }
    return "NONE";
  };
  assert.equal(code(() => buildQuote([{ serviceSlug: "nope", quantity: 1 }], services, businessRulesSeed)), "UNKNOWN_SERVICE");
  assert.equal(code(() => buildQuote([{ serviceSlug: "mastering", quantity: 1 }], inactive, businessRulesSeed)), "INACTIVE_SERVICE");
  assert.equal(code(() => buildQuote([{ serviceSlug: "mastering", quantity: 0 }], services, businessRulesSeed)), "INVALID_QUANTITY");
  assert.equal(code(() => buildQuote([{ serviceSlug: "mastering", quantity: 1.5 }], services, businessRulesSeed)), "INVALID_QUANTITY");
  assert.equal(
    code(() =>
      buildQuote(
        [
          { serviceSlug: "mastering", quantity: 1 },
          { serviceSlug: "mastering", quantity: 1 },
        ],
        services,
        businessRulesSeed,
      ),
    ),
    "DUPLICATE_SERVICE",
  );
  assert.equal(code(() => buildQuote([], services, businessRulesSeed)), "EMPTY_QUOTE");
});

test("revisions 1 and 2 are free, the 3rd and later cost $20", () => {
  assert.deepEqual(revisionCharge(1, 2, businessRulesSeed), { billable: false, amountCents: 0 });
  assert.deepEqual(revisionCharge(2, 2, businessRulesSeed), { billable: false, amountCents: 0 });
  assert.deepEqual(revisionCharge(3, 2, businessRulesSeed), { billable: true, amountCents: 2000 });
  assert.deepEqual(revisionCharge(7, 2, businessRulesSeed), { billable: true, amountCents: 2000 });
});

test("money formatting", () => {
  assert.equal(formatMoney(15000, "USD", "en"), "$150");
  assert.equal(formatMoney(7550, "USD", "en"), "$75.50");
});
