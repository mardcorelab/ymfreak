/**
 * Small, strict readers for FormData coming from dashboard forms. Values are
 * converted here; validation of ranges and formats happens in Zod schemas.
 */

export function text(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function optionalText(fd: FormData, name: string): string | null {
  const v = text(fd, name);
  return v === "" ? null : v;
}

export function checkbox(fd: FormData, name: string): boolean {
  return fd.get(name) === "on";
}

/** One item per non-empty line. */
export function lines(fd: FormData, name: string): string[] {
  return text(fd, name)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Comma-separated list. */
export function list(fd: FormData, name: string): string[] {
  return text(fd, name)
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
}

/** Integer or null when empty. Returns NaN for garbage so Zod reports it. */
export function optionalInt(fd: FormData, name: string): number | null {
  const v = text(fd, name);
  if (v === "") return null;
  return /^-?\d+$/.test(v) ? Number(v) : Number.NaN;
}

/**
 * Dollar amount typed by a person ("150", "150.5", "1,250.00", "$70") → cents.
 * Returns NaN when it is not a valid amount.
 */
export function dollarsToCents(input: string): number {
  const cleaned = input.replace(/[$\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToDollars(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
