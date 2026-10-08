/**
 * Payment provider abstraction. PayPal is the first implementation (Phase 4);
 * any other provider (Stripe, Azul, CardNet…) implements the same interface,
 * and nothing outside src/server/payments knows which one is in use.
 *
 * Card data never touches this application: clients pay on the provider's
 * hosted checkout and we only store provider references and statuses.
 */

export type PaymentKind = "DEPOSIT" | "BALANCE" | "REVISION_FEE";

export interface CreateCheckoutInput {
  /** Our Payment row id — sent to the provider as the reference and idempotency key. */
  paymentId: string;
  orderId: string;
  kind: PaymentKind;
  amountCents: number;
  currency: "USD";
  /** Shown on the provider's checkout page, e.g. "Depósito — Mezcla + Mastering (YMF-7K2Q)". */
  description: string;
  locale: "es" | "en";
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Provider's id for this checkout (PayPal order id). */
  providerRef: string;
  /** Where to send the client to pay. */
  approvalUrl: string;
}

export type ProviderPaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";

export interface ProviderEvent {
  /** Provider event id, used for idempotency (WebhookEvent.id). */
  eventId: string;
  type: string;
  providerRef: string;
  captureRef?: string;
  status: ProviderPaymentStatus;
  amountCents?: number;
}

export interface PaymentProvider {
  readonly name: "paypal";
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Captures an approved checkout and returns the final status. */
  capture(providerRef: string): Promise<{ status: ProviderPaymentStatus; captureRef?: string; amountCents?: number }>;
  /** Verifies the webhook signature with the provider; throws if invalid. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent>;
  refund(captureRef: string, amountCents: number): Promise<void>;
}
