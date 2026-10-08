const TZ = "America/Santo_Domingo";

/** Formats a @db.Date column (midnight UTC) as a Spanish day. */
export function fmtDay(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-DO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

export function fmtDateTime(d: Date | null | undefined, timeZone = TZ): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-DO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }).format(d);
}

export function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
