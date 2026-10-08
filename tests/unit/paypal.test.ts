import { test } from "node:test";
import assert from "node:assert/strict";
import { PayPalProvider } from "../../src/server/payments/paypal";
import { centsToDecimal, decimalToCents } from "../../src/server/payments/provider";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: ((call: Call) => { status: number; body: unknown } | undefined)[]) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    for (const r of responses) {
      const res = r(call);
      if (res) return new Response(JSON.stringify(res.body), { status: res.status, headers: { "Content-Type": "application/json" } });
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { fn, calls };
}

const token = (c: Call) => (c.url.endsWith("/v1/oauth2/token") ? { status: 200, body: { access_token: "AT", expires_in: 3600 } } : undefined);

test("money conversions are exact", () => {
  assert.equal(centsToDecimal(7500), "75.00");
  assert.equal(centsToDecimal(7550), "75.50");
  assert.equal(centsToDecimal(5), "0.05");
  assert.equal(decimalToCents("75.00"), 7500);
  assert.equal(decimalToCents("75.5"), 7550);
  assert.ok(Number.isNaN(decimalToCents("7,5")));
});

test("createCheckout sends a CAPTURE order for the exact amount and returns the approval link", async () => {
  const { fn, calls } = fakeFetch([
    token,
    (c) =>
      c.url.endsWith("/v2/checkout/orders")
        ? { status: 201, body: { id: "5O190127TN364715T", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T" }] } }
        : undefined,
  ]);
  const pp = new PayPalProvider({ clientId: "id", clientSecret: "secret", env: "sandbox", fetch: fn });
  const session = await pp.createCheckout({
    paymentId: "cpay123",
    amountCents: 7500,
    currency: "USD",
    description: "YM Freak · Depósito · YMF-ABCDE",
    locale: "es",
    returnUrl: "https://ymfreak.com/api/payments/return?payment=cpay123&l=es",
    cancelUrl: "https://ymfreak.com/es/checkout/cord?payment=cancelled",
  });
  assert.equal(session.providerRef, "5O190127TN364715T");
  assert.match(session.approvalUrl, /sandbox\.paypal\.com/);

  const create = calls.find((c) => c.url.endsWith("/v2/checkout/orders"))!;
  assert.match(create.url, /^https:\/\/api-m\.sandbox\.paypal\.com/);
  const headers = create.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer AT");
  assert.equal(headers["PayPal-Request-Id"], "create-cpay123");
  const body = JSON.parse(String(create.init.body));
  assert.equal(body.intent, "CAPTURE");
  assert.deepEqual(body.purchase_units[0].amount, { currency_code: "USD", value: "75.00" });
  assert.equal(body.purchase_units[0].custom_id, "cpay123");
  assert.equal(body.payment_source.paypal.experience_context.shipping_preference, "NO_SHIPPING");
});

test("capture reads the capture id and amount; already-captured orders are read back", async () => {
  const completed = {
    id: "ORDER1",
    status: "COMPLETED",
    purchase_units: [{ payments: { captures: [{ id: "CAP1", status: "COMPLETED", amount: { value: "75.00", currency_code: "USD" } }] } }],
  };
  const ok = fakeFetch([token, (c) => (c.url.endsWith("/capture") ? { status: 201, body: completed } : undefined)]);
  const r1 = await new PayPalProvider({ clientId: "a", clientSecret: "b", env: "live", fetch: ok.fn }).capture("ORDER1", "capture-x");
  assert.deepEqual(r1, { status: "SUCCEEDED", captureRef: "CAP1", amountCents: 7500, rawStatus: "COMPLETED" });
  assert.match(ok.calls[1]!.url, /^https:\/\/api-m\.paypal\.com/);

  const again = fakeFetch([
    token,
    (c) => (c.url.endsWith("/capture") ? { status: 422, body: { details: [{ issue: "ORDER_ALREADY_CAPTURED" }] } } : undefined),
    (c) => (c.url.endsWith("/v2/checkout/orders/ORDER1") ? { status: 200, body: completed } : undefined),
  ]);
  const r2 = await new PayPalProvider({ clientId: "a", clientSecret: "b", env: "sandbox", fetch: again.fn }).capture("ORDER1", "capture-x");
  assert.equal(r2.status, "SUCCEEDED");

  const declined = fakeFetch([token, (c) => (c.url.endsWith("/capture") ? { status: 422, body: { details: [{ issue: "INSTRUMENT_DECLINED" }] } } : undefined)]);
  const r3 = await new PayPalProvider({ clientId: "a", clientSecret: "b", env: "sandbox", fetch: declined.fn }).capture("ORDER1", "capture-x");
  assert.equal(r3.status, "FAILED");
});

test("webhooks are rejected without a webhook id or when PayPal does not verify them", async () => {
  const body = JSON.stringify({ id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP1" } });
  const noId = new PayPalProvider({ clientId: "a", clientSecret: "b", env: "sandbox", fetch: fakeFetch([token]).fn });
  assert.equal(await noId.verifyWebhook(body, new Headers()), null);

  const failing = fakeFetch([token, (c) => (c.url.includes("verify-webhook-signature") ? { status: 200, body: { verification_status: "FAILURE" } } : undefined)]);
  const pp = new PayPalProvider({ clientId: "a", clientSecret: "b", env: "sandbox", webhookId: "WHID", fetch: failing.fn });
  assert.equal(await pp.verifyWebhook(body, new Headers()), null);

  const passing = fakeFetch([token, (c) => (c.url.includes("verify-webhook-signature") ? { status: 200, body: { verification_status: "SUCCESS" } } : undefined)]);
  const ok = new PayPalProvider({ clientId: "a", clientSecret: "b", env: "sandbox", webhookId: "WHID", fetch: passing.fn });
  const event = await ok.verifyWebhook(body, new Headers({ "paypal-transmission-id": "t1" }));
  assert.equal(event?.kind, "CAPTURE_COMPLETED");
  const sent = JSON.parse(String(passing.calls[1]!.init.body));
  assert.equal(sent.webhook_id, "WHID");
  assert.equal(sent.transmission_id, "t1");
});

test("webhook events map to what the site needs", () => {
  const completed = PayPalProvider.parseEvent({
    id: "WH-2",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: { id: "CAP9", custom_id: "cpay9", amount: { value: "150.00", currency_code: "USD" }, supplementary_data: { related_ids: { order_id: "ORD9" } } },
  });
  assert.deepEqual(completed, { kind: "CAPTURE_COMPLETED", eventId: "WH-2", providerRef: "ORD9", captureRef: "CAP9", paymentId: "cpay9", amountCents: 15000 });

  const refunded = PayPalProvider.parseEvent({
    id: "WH-3",
    event_type: "PAYMENT.CAPTURE.REFUNDED",
    resource: { id: "REF1", links: [{ rel: "up", href: "https://api.paypal.com/v2/payments/captures/CAP9" }] },
  });
  assert.equal(refunded.kind === "CAPTURE_REFUNDED" && refunded.captureRef, "CAP9");
  assert.equal(PayPalProvider.parseEvent({ id: "WH-4", event_type: "BILLING.PLAN.CREATED", resource: {} }).kind, "IGNORED");
});
