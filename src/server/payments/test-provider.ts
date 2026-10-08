/**
 * In-process stand-in for PayPal, used ONLY by the automated end-to-end tests
 * (PAYMENTS_TEST_MODE=1 in CI). It can never be enabled on Vercel: see
 * getPaymentProvider(). Its "approval page" immediately returns to the site,
 * exactly as PayPal does after the buyer clicks Pay.
 */
import type { CaptureResult, CheckoutSession, CreateCheckoutInput, PaymentProvider, ProviderEvent } from "./provider";

export class TestPaymentProvider implements PaymentProvider {
  readonly name = "test" as const;
  readonly mode = "test" as const;

  constructor(private readonly siteUrl: string) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    // Stateless on purpose: Next.js may run actions and route handlers in
    // separate module instances, so the amount travels inside the reference.
    const providerRef = `TEST-${input.paymentId}-${input.amountCents}`;
    const url = new URL("/api/payments/test/approve", this.siteUrl);
    url.searchParams.set("token", providerRef);
    url.searchParams.set("return", input.returnUrl);
    return { providerRef, approvalUrl: url.toString() };
  }

  async capture(providerRef: string): Promise<CaptureResult> {
    const match = /^TEST-(c[a-z0-9]+)-(\d+)$/.exec(providerRef);
    if (!match) return { status: "FAILED", rawStatus: "UNKNOWN_ORDER" };
    return { status: "SUCCEEDED", captureRef: `CAP-${match[1]}`, amountCents: Number(match[2]), rawStatus: "COMPLETED" };
  }

  async refund(): Promise<void> {}

  async verifyWebhook(): Promise<ProviderEvent | null> {
    return null;
  }
}
