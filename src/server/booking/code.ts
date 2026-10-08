/** Human-friendly booking codes, e.g. YMF-7K2QD. No 0/O/1/I to avoid misreading. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newBookingCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(5);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `YMF-${out}`;
}

export function isBookingCode(value: string): boolean {
  return /^YMF-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(value);
}

/** DB @db.Date columns hold midnight UTC; these convert to/from local "YYYY-MM-DD". */
export function dateColumn(local: string): Date {
  return new Date(`${local}T00:00:00.000Z`);
}

export function fromDateColumn(d: Date): string {
  return d.toISOString().slice(0, 10);
}
