/**
 * Quotes are always computed on the server from service rules stored in the
 * database. Neither the browser nor the AI agent ever sends an amount; they
 * send a service slug and a quantity, and this module resolves the price.
 */
import { assertCents, splitDeposit } from "./money";
import type { BusinessRules, ServiceRule } from "./types";

export const MAX_QUANTITY = 20;

export interface QuoteRequestLine {
  serviceSlug: string;
  /** Songs for PER_SONG, hours for PER_HOUR, pieces for FLAT. */
  quantity: number;
}

export interface QuoteLine {
  serviceSlug: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface Quote {
  currency: "USD";
  lines: QuoteLine[];
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  depositPercent: number;
}

export class PricingError extends Error {
  constructor(
    public readonly code: "UNKNOWN_SERVICE" | "INACTIVE_SERVICE" | "INVALID_QUANTITY" | "EMPTY_QUOTE" | "DUPLICATE_SERVICE",
    message: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

export function buildQuote(
  request: QuoteRequestLine[],
  services: ReadonlyMap<string, ServiceRule>,
  rules: Pick<BusinessRules, "depositPercent">,
): Quote {
  if (request.length === 0) throw new PricingError("EMPTY_QUOTE", "A quote needs at least one service");

  const seen = new Set<string>();
  const lines = request.map(({ serviceSlug, quantity }): QuoteLine => {
    if (seen.has(serviceSlug)) {
      throw new PricingError("DUPLICATE_SERVICE", `Service ${serviceSlug} appears twice; use quantity instead`);
    }
    seen.add(serviceSlug);

    const service = services.get(serviceSlug);
    if (!service) throw new PricingError("UNKNOWN_SERVICE", `Unknown service: ${serviceSlug}`);
    if (!service.active) throw new PricingError("INACTIVE_SERVICE", `Service is not available: ${serviceSlug}`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new PricingError("INVALID_QUANTITY", `Quantity must be an integer between 1 and ${MAX_QUANTITY}`);
    }
    assertCents(service.priceCents, `price of ${serviceSlug}`);

    return {
      serviceSlug,
      quantity,
      unitPriceCents: service.priceCents,
      lineTotalCents: service.priceCents * quantity,
    };
  });

  const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const { depositCents, balanceCents } = splitDeposit(totalCents, rules.depositPercent);

  return { currency: "USD", lines, totalCents, depositCents, balanceCents, depositPercent: rules.depositPercent };
}

/**
 * Revisions: the first `revisionsIncluded` are free; each one after that costs
 * `revisionFeeCents`. `revisionNumber` is 1-based (the 3rd revision is 3).
 */
export function revisionCharge(
  revisionNumber: number,
  revisionsIncluded: number,
  rules: Pick<BusinessRules, "revisionFeeCents">,
): { billable: boolean; amountCents: number } {
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    throw new RangeError(`revisionNumber must be a positive integer, got ${revisionNumber}`);
  }
  const billable = revisionNumber > revisionsIncluded;
  return { billable, amountCents: billable ? rules.revisionFeeCents : 0 };
}
