import "server-only";
import type { BookingStatus, ProjectLinkKind } from "@prisma/client";
import { db } from "../db";
import { getSetting } from "../settings";
import { expireStaleHolds } from "../booking/calendar";
import { fromDateColumn } from "../booking/code";
import { formatMoney } from "../domain/money";
import { evaluateClientCancellation } from "../domain/cancellation";
import { amountDue } from "../payments/service";

type Locale = "es" | "en";

const lang = (l: Locale) => (l === "es" ? "es-DO" : "en-US");
const day = (d: Date, l: Locale) =>
  new Intl.DateTimeFormat(lang(l), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${fromDateColumn(d)}T12:00:00Z`),
  );
const dateTime = (d: Date, tz: string, l: Locale) =>
  new Intl.DateTimeFormat(lang(l), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);
const shortDate = (d: Date, tz: string, l: Locale) => new Intl.DateTimeFormat(lang(l), { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(d);

/** Statuses in which the client can still send material. */
const OPEN_FOR_FILES: BookingStatus[] = ["AWAITING_PAYMENT", "PAID", "CONFIRMED", "IN_PROGRESS", "DELIVERED", "REVISION"];

export interface PortalBookingSummary {
  code: string;
  status: BookingStatus;
  services: string;
  title: string;
  when: { kind: "delivery" | "session"; label: string } | null;
  total: string;
  due: { kind: "DEPOSIT" | "BALANCE" | "REVISION_FEE"; amount: string } | null;
  checkoutPath: string | null;
  createdAt: string;
}

async function loadBookings(customerId: string) {
  return db.booking.findMany({
    where: { customerId },
    include: { order: { include: { payments: true } }, items: { include: { service: true } } },
    orderBy: { createdAt: "desc" },
  });
}

type LoadedBooking = Awaited<ReturnType<typeof loadBookings>>[number];

function summarize(b: LoadedBooking, locale: Locale, tz: string): PortalBookingSummary {
  const details = (b.projectDetails ?? {}) as { songTitle?: string; artistName?: string };
  const services = b.items.map((i) => (locale === "es" ? i.service.nameEs : i.service.nameEn)).join(" + ");
  const due = b.order ? amountDue({ ...b.order, booking: b }) : null;
  return {
    code: b.code,
    status: b.status,
    services,
    title: [details.songTitle, details.artistName].filter(Boolean).join(" · ") || services,
    when: b.deliveryDate
      ? { kind: "delivery", label: day(b.deliveryDate, locale) }
      : b.startsAt
        ? { kind: "session", label: `${dateTime(b.startsAt, tz, locale)} (${tz})` }
        : null,
    total: b.order ? formatMoney(b.order.totalCents, "USD", locale) : "—",
    due: due ? { kind: due.kind, amount: formatMoney(due.amountCents, "USD", locale) } : null,
    checkoutPath: b.order ? `/${locale}/checkout/${b.order.id}` : null,
    createdAt: shortDate(b.createdAt, tz, locale),
  };
}

export async function getClientBookings(customerId: string, locale: Locale): Promise<PortalBookingSummary[]> {
  await expireStaleHolds(db, new Date());
  const [rows, rules] = await Promise.all([loadBookings(customerId), getSetting("business_rules")]);
  return rows.map((b) => summarize(b, locale, rules.timeZone));
}

export interface PortalLink {
  id: string;
  kind: ProjectLinkKind;
  author: "client" | "admin";
  label: string | null;
  url: string | null;
  note: string | null;
  date: string;
}

export interface PortalProject extends PortalBookingSummary {
  bookingMode: "DELIVERY" | "SESSION";
  quantity: number;
  paid: string;
  balanceOnDelivery: string | null;
  timeline: { status: BookingStatus; date: string }[];
  links: PortalLink[];
  finalsLocked: boolean;
  canSendFiles: boolean;
  canRequestRevision: boolean;
  revisions: { included: number; used: number; fee: string };
  cancel: { deadline: string; amount: string } | null;
  filesHelp: { question: string; answer: string }[];
}

/** A booking of this customer, by its code. Returns null for codes that belong to someone else. */
export async function getClientProject(customerId: string, code: string, locale: Locale): Promise<PortalProject | null> {
  if (!/^YMF-[A-Z0-9]{4,8}$/.test(code)) return null;
  const now = new Date();
  await expireStaleHolds(db, now);
  const b = await db.booking.findFirst({
    where: { code, customerId },
    include: {
      order: { include: { payments: true } },
      items: { include: { service: true } },
      events: { orderBy: { createdAt: "asc" } },
      links: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!b) return null;
  const rules = await getSetting("business_rules");
  const tz = rules.timeZone;
  const base = summarize(b, locale, tz);
  const money = (c: number) => formatMoney(c, "USD", locale);

  const paidCents = b.order?.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amountCents, 0) ?? 0;
  const balancePaid = b.order?.status === "PAID_IN_FULL";

  // Status timeline: real status changes only (internal notes stay in the dashboard).
  const timeline: { status: BookingStatus; date: string }[] = [];
  for (const e of b.events) {
    if (e.from === e.to || e.to === "PAID") continue;
    timeline.push({ status: e.to, date: shortDate(e.createdAt, tz, locale) });
  }

  const links: PortalLink[] = b.links.map((l) => ({
    id: l.id,
    kind: l.kind,
    author: l.author === "admin" ? "admin" : "client",
    label: l.label,
    // Final files stay hidden until the balance is paid.
    url: l.kind === "FINAL" && !balancePaid ? null : l.url,
    note: l.note,
    date: shortDate(l.createdAt, tz, locale),
  }));

  const deposit = b.order?.payments.find((p) => p.kind === "DEPOSIT" && p.status === "SUCCEEDED" && p.provider !== "manual");
  const cancellation = deposit
    ? evaluateClientCancellation({ status: b.status, depositPaidAt: deposit.paidAt, depositPaidCents: deposit.amountCents, now, rules })
    : null;

  const slugs = b.items.map((i) => i.service.slug);
  const knowledge =
    b.bookingMode === "DELIVERY"
      ? await db.knowledgeEntry.findMany({ where: { active: true, tags: { has: "archivos" } }, orderBy: { sortOrder: "asc" } })
      : [];
  const filesHelp = knowledge
    .filter((k) => {
      if (k.tags.includes("enviar")) return true;
      if (k.tags.includes("mezcla")) return slugs.some((s) => s !== "mastering");
      if (k.tags.includes("mastering")) return slugs.includes("mastering");
      return false;
    })
    .map((k) => ({ question: (locale === "es" ? k.questionEs : k.questionEn) ?? "", answer: locale === "es" ? k.answerEs : k.answerEn }));

  const included = Math.min(...b.items.map((i) => i.service.revisionsIncluded));

  return {
    ...base,
    bookingMode: b.bookingMode,
    quantity: b.quantity,
    paid: money(paidCents),
    balanceOnDelivery: b.order && !balancePaid ? money(Math.max(0, b.order.totalCents - paidCents)) : null,
    timeline,
    links,
    finalsLocked: !balancePaid && b.links.some((l) => l.kind === "FINAL"),
    canSendFiles: b.bookingMode === "DELIVERY" && OPEN_FOR_FILES.includes(b.status),
    canRequestRevision: b.status === "DELIVERED",
    revisions: { included: Number.isFinite(included) ? included : 0, used: b.revisionsUsed, fee: money(rules.revisionFeeCents) },
    cancel: cancellation?.allowed && cancellation.deadline ? { deadline: dateTime(cancellation.deadline, tz, locale), amount: money(cancellation.refundCents) } : null,
    filesHelp,
  };
}
