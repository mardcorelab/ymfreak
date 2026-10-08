/**
 * In-process stand-in for PayPal, used ONLY by the automated end-to-end tests
 * (PAYMENTS_TEST_MODE=1 in CI). It can never be enabled on Vercel: see
 * getPaymentProvider(). Its "approval page" immediately returns to the site,
 * exactly as PayPal does after the buyer clicks Pay.
 */
import type { CaptureResult, CheckoutSession, CreateCheckoutInput, PaymentProvider, ProviderEvent } from "./provider";

const orders = new Map<string, { amountCents: number; captured: boolean }>();

export class TestPaymentProvider implements PaymentProvider {
  readonly name = "test" as const;
  readonly mode = "test" as const;

  constructor(private readonly siteUrl: string) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const providerRef = `TEST-${input.paymentId}`;
    orders.set(providerRef, { amountCents: input.amountCents, captured: false });
    const url = new URL("/api/payments/test/approve", this.siteUrl);
    url.searchParams.set("token", providerRef);
    url.searchParams.set("return", input.returnUrl);
    return { providerRef, approvalUrl: url.toString() };
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    const order = orders.get(providerRef);
    if (!order) return { status: "FAILED", rawStatus: "UNKNOWN_ORDER" };
    order.captured = true;
    return { status: "SUCCEEDED", captureRef: `CAP-${providerRef}`, amountCents: order.amountCents, rawStatus: "COMPLETED" };
  }

  async refund(): Promise<void> {}

  async verifyWebhook(): Promise<ProviderEvent | null> {
    return null;
  }
}
