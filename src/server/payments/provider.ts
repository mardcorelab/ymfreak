/**
 * Payment provider abstraction. PayPal is the implementation in production;
 * any other provider (Stripe, Azul, CardNet…) implements the same interface,
 * and nothing outside src/server/payments knows which one is in use.
 *
 * Card and PayPal account data never touch this application: clients approve
 * the payment on the provider's own page and we only store references and
 * statuses.
 */

export type PaymentKind = "DEPOSIT" | "BALANCE" | "REVISION_FEE";

export interface CreateCheckoutInput {
  /** Our Payment row id: sent as the provider reference and idempotency key. */
  paymentId: string;
  amountCents: number;
  currency: "USD";
  /** Shown on the provider's page, e.g. "Depósito — Mezcla + Mastering (YMF-7K2QD)". */
  description: string;
  locale: "es" | "en";
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Provider's id for this checkout (PayPal order id). */
  providerRef: string;
  /** Where to send the client to approve the payment. */
  approvalUrl: string;
}

export type CaptureStatus = "SUCCEEDED" | "PENDING" | "FAILED";

export interface CaptureResult {
  status: CaptureStatus;
  captureRef?: string;
  amountCents?: number;
  /** Provider's raw status text, stored for support. */
  rawStatus: string;
}

export type ProviderEvent =
  | { kind: "APPROVED"; eventId: string; providerRef: string }
  | { kind: "CAPTURE_COMPLETED"; eventId: string; providerRef: string | null; captureRef: string; paymentId: string | null; amountCents: number }
  | { kind: "CAPTURE_FAILED"; eventId: string; captureRef: string; paymentId: string | null; rawStatus: string }
  | { kind: "CAPTURE_REFUNDED"; eventId: string; captureRef: string | null; paymentId: string | null }
  | { kind: "IGNORED"; eventId: string; type: string };

export interface PaymentProvider {
  readonly name: "paypal" | "test";
  readonly mode: "sandbox" | "live" | "test";
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Captures an approved checkout. Safe to call twice: a second call reports the existing capture. */
  capture(providerRef: string, idempotencyKey: string): Promise<CaptureResult>;
  refund(captureRef: string, amountCents: number, idempotencyKey: string): Promise<void>;
  /** Verifies the webhook with the provider. Returns null when the signature is not valid. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent | null>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

/** 7550 → "75.50" (PayPal wants a decimal string). */
export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError(`Invalid cents: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** "75.50" → 7550. Returns NaN for anything that is not a plain decimal amount. */
export function decimalToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
