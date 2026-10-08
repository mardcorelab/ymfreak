import "server-only";
import { env } from "../env";
import { siteUrl } from "@/lib/seo";
import { PayPalProvider } from "./paypal";
import { TestPaymentProvider } from "./test-provider";
import type { PaymentProvider } from "./provider";

let cached: PaymentProvider | null | undefined;

/** True only in automated test runs, never on Vercel. */
export function paymentsTestMode(): boolean {
  return process.env.PAYMENTS_TEST_MODE === "1" && !process.env.VERCEL;
}

/** The configured provider, or null when online payment is not set up yet. */
export function getPaymentProvider(): PaymentProvider | null {
  if (cached !== undefined) return cached;
  if (paymentsTestMode()) cached = new TestPaymentProvider(siteUrl());
  else if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
    cached = new PayPalProvider({
      clientId: env.PAYPAL_CLIENT_ID.trim(),
      clientSecret: env.PAYPAL_CLIENT_SECRET.trim(),
      env: env.PAYPAL_ENV,
      webhookId: env.PAYPAL_WEBHOOK_ID?.trim() || undefined,
    });
  } else cached = null;
  return cached;
}

export interface PaymentStatusInfo {
  configured: boolean;
  provider: "paypal" | "test" | null;
  mode: "sandbox" | "live" | "test" | null;
  webhook: boolean;
}

export function paymentStatus(): PaymentStatusInfo {
  const p = getPaymentProvider();
  return {
    configured: p !== null,
    provider: p?.name ?? null,
    mode: p?.mode ?? null,
    webhook: p?.name === "paypal" ? Boolean(env.PAYPAL_WEBHOOK_ID) : false,
  };
}
