/**
 * PayPal REST (Orders v2) implementation of PaymentProvider.
 * Docs: https://developer.paypal.com/docs/api/orders/v2/
 */
import {
  centsToDecimal,
  decimalToCents,
  PaymentProviderError,
  type CaptureResult,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentProvider,
  type ProviderEvent,
} from "./provider";

type Fetch = typeof fetch;

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  env: "sandbox" | "live";
  webhookId?: string | undefined;
  fetch?: Fetch;
}

const BASE = { sandbox: "https://api-m.sandbox.paypal.com", live: "https://api-m.paypal.com" } as const;

interface PayPalCapture {
  id: string;
  status: string;
  amount?: { value: string; currency_code: string };
  custom_id?: string;
  supplementary_data?: { related_ids?: { order_id?: string } };
}

interface PayPalOrder {
  id: string;
  status: string;
  links?: { href: string; rel: string }[];
  purchase_units?: { reference_id?: string; custom_id?: string; payments?: { captures?: PayPalCapture[] } }[];
}

export class PayPalProvider implements PaymentProvider {
  readonly name = "paypal" as const;
  readonly mode: "sandbox" | "live";
  private readonly base: string;
  private readonly http: Fetch;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: PayPalConfig) {
    this.mode = config.env;
    this.base = BASE[config.env];
    this.http = config.fetch ?? fetch;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await this.http(`${this.base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) throw new PaymentProviderError("PayPal authentication failed. Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV.", res.status);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  private async call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; requestId?: string }): Promise<{ status: number; body: T }> {
    const res = await this.http(`${this.base}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
    });
    const text = await res.text();
    const body = (text ? JSON.parse(text) : {}) as T;
    return { status: res.status, body };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const { status, body } = await this.call<PayPalOrder>("/v2/checkout/orders", {
      method: "POST",
      requestId: `create-${input.paymentId}`,
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.paymentId,
            custom_id: input.paymentId,
            invoice_id: input.paymentId,
            description: input.description.slice(0, 127),
            amount: { currency_code: input.currency, value: centsToDecimal(input.amountCents) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "YM Freak",
              locale: input.locale === "es" ? "es-ES" : "en-US",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
            },
          },
        },
      },
    });
    if (status >= 300) throw new PaymentProviderError("PayPal could not create the order.", status, body);
    const approval = body.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (!approval) throw new PaymentProviderError("PayPal did not return an approval link.", status, body);
    return { providerRef: body.id, approvalUrl: approval };
  }

  async capture(providerRef: string, idempotencyKey: string): Promise<CaptureResult> {
    if (!/^[A-Z0-9-]{5,40}$/i.test(providerRef)) throw new PaymentProviderError("Invalid PayPal order id.");
    const res = await this.call<PayPalOrder & { details?: { issue?: string }[] }>(`/v2/checkout/orders/${providerRef}/capture`, {
      method: "POST",
      requestId: idempotencyKey,
      body: {},
    });
    let order = res.body;
    if (res.status === 422 && res.body.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
      order = (await this.call<PayPalOrder>(`/v2/checkout/orders/${providerRef}`, { method: "GET" })).body;
    } else if (res.status === 422 && res.body.details?.some((d) => d.issue === "INSTRUMENT_DECLINED" || d.issue === "PAYER_ACTION_REQUIRED")) {
      return { status: "FAILED", rawStatus: res.body.details?.[0]?.issue ?? "DECLINED" };
    } else if (res.status >= 300) {
      throw new PaymentProviderError("PayPal could not capture the payment.", res.status, res.body);
    }
    return PayPalProvider.captureFromOrder(order);
  }

  static captureFromOrder(order: PayPalOrder): CaptureResult {
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture) return { status: order.status === "COMPLETED" ? "PENDING" : "FAILED", rawStatus: order.status };
    const amountCents = capture.amount ? decimalToCents(capture.amount.value) : undefined;
    const status = capture.status === "COMPLETED" ? "SUCCEEDED" : capture.status === "PENDING" ? "PENDING" : "FAILED";
    return { status, captureRef: capture.id, rawStatus: capture.status, ...(amountCents !== undefined && !Number.isNaN(amountCents) ? { amountCents } : {}) };
  }

  async refund(captureRef: string, amountCents: number, idempotencyKey: string): Promise<void> {
    const { status, body } = await this.call(`/v2/payments/captures/${captureRef}/refund`, {
      method: "POST",
      requestId: idempotencyKey,
      body: { amount: { currency_code: "USD", value: centsToDecimal(amountCents) } },
    });
    if (status >= 300) throw new PaymentProviderError("PayPal could not refund the payment.", status, body);
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent | null> {
    if (!this.config.webhookId) return null;
    let event: { id: string; event_type: string; resource: Record<string, unknown> };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const h = (name: string) => headers.get(name) ?? "";
    const { status, body } = await this.call<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: h("paypal-auth-algo"),
        cert_url: h("paypal-cert-url"),
        transmission_id: h("paypal-transmission-id"),
        transmission_sig: h("paypal-transmission-sig"),
        transmission_time: h("paypal-transmission-time"),
        webhook_id: this.config.webhookId,
        webhook_event: event,
      },
    });
    if (status >= 300 || body.verification_status !== "SUCCESS") return null;
    return PayPalProvider.parseEvent(event);
  }

  static parseEvent(event: { id: string; event_type: string; resource: Record<string, unknown> }): ProviderEvent {
    const r = event.resource as PayPalCapture & PayPalOrder & { custom_id?: string };
    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED":
        return { kind: "APPROVED", eventId: event.id, providerRef: r.id };
      case "PAYMENT.CAPTURE.COMPLETED":
        return {
          kind: "CAPTURE_COMPLETED",
          eventId: event.id,
          providerRef: r.supplementary_data?.related_ids?.order_id ?? null,
          captureRef: r.id,
          paymentId: r.custom_id ?? null,
          amountCents: r.amount ? decimalToCents(r.amount.value) : Number.NaN,
        };
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED":
        return { kind: "CAPTURE_FAILED", eventId: event.id, captureRef: r.id, paymentId: r.custom_id ?? null, rawStatus: r.status ?? event.event_type };
      case "PAYMENT.CAPTURE.REFUNDED":
        // The resource is the refund; its "up" link points to the capture.
        return {
          kind: "CAPTURE_REFUNDED",
          eventId: event.id,
          captureRef: ((r.links ?? []).find((l) => l.rel === "up")?.href.split("/").pop() as string | undefined) ?? null,
          paymentId: r.custom_id ?? null,
        };
      default:
        return { kind: "IGNORED", eventId: event.id, type: event.event_type };
    }
  }
}
