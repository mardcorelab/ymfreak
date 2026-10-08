/**
 * Money is always an integer number of cents. Never use floats for amounts.
 */

export function assertCents(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of cents, got ${value}`);
  }
}

/**
 * Splits a total into a deposit and a balance. The deposit is rounded half-up
 * to the cent and the balance takes the remainder, so the two always add up
 * exactly to the total.
 */
export function splitDeposit(
  totalCents: number,
  depositPercent: number,
): { depositCents: number; balanceCents: number } {
  assertCents(totalCents, "totalCents");
  if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
    throw new RangeError(`depositPercent must be between 0 and 100, got ${depositPercent}`);
  }
  const depositCents = Math.round((totalCents * depositPercent) / 100);
  return { depositCents, balanceCents: totalCents - depositCents };
}

export function formatMoney(cents: number, currency: string, locale: "es" | "en"): string {
  assertCents(cents);
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale === "es" ? "es-DO" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
