import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { db } from "../db";
import { getActiveServices } from "../catalog";
import { getSetting } from "../settings";
import { formatMoney } from "../domain/money";
import { toLocalDate } from "../domain/calendar";
import { quoteDelivery, sessionAvailability, type QuoteSummary } from "../booking/engine";
import { bookingOpen } from "../booking/public-actions";
import { fromDateColumn } from "../booking/code";
import { amountDue } from "../payments/service";
import { allowRate } from "../rate-limit";
import type { BookingRequest } from "@/lib/validators/booking";
import { proposeInput, toBookingRequest } from "./booking-input";
import type { AgentCard } from "@/lib/agent-types";
import type { ToolDef } from "./llm";

export type Locale = "es" | "en";

export interface ToolContext {
  locale: Locale;
  conversationId: string;
  ip: string;
  now: Date;
}

export interface ToolOutcome {
  /** JSON-serialisable data returned to the model. */
  result: unknown;
  isError?: boolean;
  card?: AgentCard;
}

interface Tool<S extends z.ZodTypeAny> {
  def: ToolDef;
  kind: "read" | "write";
  input: S;
  run(input: z.infer<S>, ctx: ToolContext): Promise<ToolOutcome>;
}

function tool<S extends z.ZodTypeAny>(t: Tool<S>): Tool<S> {
  return t;
}

const PROPOSAL_MINUTES = 15;
const lang = (l: Locale) => (l === "es" ? "es-DO" : "en-US");
const money = (cents: number, l: Locale) => formatMoney(cents, "USD", l);

export function fmtLocalDate(date: string, l: Locale): string {
  return new Intl.DateTimeFormat(lang(l), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

export function fmtTime(d: Date, timeZone: string, l: Locale): string {
  return new Intl.DateTimeFormat(lang(l), { hour: "numeric", minute: "2-digit", timeZone }).format(d);
}

function fmtDateTime(d: Date, timeZone: string, l: Locale): string {
  return new Intl.DateTimeFormat(lang(l), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone }).format(d);
}

function quoteForModel(q: QuoteSummary, l: Locale) {
  return {
    lines: q.lines.map((x) => ({ service: x.name, slug: x.serviceSlug, quantity: x.quantity, unitPrice: money(x.unitPriceCents, l), lineTotal: money(x.lineTotalCents, l) })),
    total: money(q.totalCents, l),
    depositToBook: money(q.depositCents, l),
    depositPercent: q.depositPercent,
    balanceOnDelivery: money(q.balanceCents, l),
  };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ");

// ---------------------------------------------------------------------------
// READ tools
// ---------------------------------------------------------------------------

const getServices = tool({
  kind: "read",
  def: {
    name: "get_services",
    description:
      "List YM Freak's active services with current prices (USD), pricing unit, what is included, booking mode (DELIVERY = delivered work with a turnaround in working days; SESSION = remote hourly video session), turnaround and included revisions. Always use this before mentioning a price.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  input: z.object({}).passthrough(),
  async run(_input, ctx) {
    const [services, t] = await Promise.all([getActiveServices(), getTranslations({ locale: ctx.locale, namespace: "agent.card" })]);
    const es = ctx.locale === "es";
    const items = services.map((s) => ({
      slug: s.slug,
      name: es ? s.nameEs : s.nameEn,
      description: es ? s.descriptionEs : s.descriptionEn,
      includes: es ? s.includesEs : s.includesEn,
      price: money(s.priceCents, ctx.locale),
      pricingUnit: s.pricingUnit,
      bookingMode: s.bookingMode,
      turnaroundWorkingDays: s.turnaroundDays,
      sessionBlockMinutes: s.sessionMinutes,
      revisionsIncluded: s.revisionsIncluded,
    }));
    const unit = (u: string) => (u === "PER_SONG" ? t("perSong") : u === "PER_HOUR" ? t("perHour") : t("flat"));
    return {
      result: { services: items, note: "Combined services for the same song add their turnaround days. Use quote_delivery for real dates." },
      card: {
        kind: "services",
        items: items.map((i) => ({
          slug: i.slug,
          name: i.name,
          price: i.price,
          unit: unit(i.pricingUnit),
          detail: i.bookingMode === "SESSION" ? t("remoteSession") : t("workingDays", { count: i.turnaroundWorkingDays ?? 0 }),
        })),
      },
    };
  },
});

const getBusinessInfo = tool({
  kind: "read",
  def: {
    name: "get_business_info",
    description:
      "Business rules: deposit percentage, included revisions policy and extra revision fee, cancellation window, working days and hours, time zone, project capacity, session notice, payment provider and whether online booking is open.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  input: z.object({}).passthrough(),
  async run(_input, ctx) {
    const [rules, booking, open] = await Promise.all([getSetting("business_rules"), getSetting("booking"), bookingOpen()]);
    const days = rules.workingWeekdays.map((d) =>
      new Intl.DateTimeFormat(lang(ctx.locale), { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, d))),
    );
    return {
      result: {
        depositPercent: rules.depositPercent,
        balance: "Paid when the work is delivered; final files are released after the balance is paid.",
        extraRevisionFee: money(rules.revisionFeeCents, ctx.locale),
        revisionsIncluded: "Per service, see get_services (revisionsIncluded).",
        cancellation: `Full refund if cancelled within ${rules.cancellationWindowHours} hours of paying the deposit. After that, YM Freak handles it directly.`,
        workingDays: days,
        workingHours: `${rules.workdayStart}–${rules.workdayEnd}`,
        timeZone: rules.timeZone,
        newProjectsPerWorkingDay: rules.dailyProjectStarts,
        sessionNoticeHours: rules.sessionLeadHours,
        sessions: "Remote, by video call.",
        paymentProvider: "PayPal (PayPal account or card, on PayPal's secure page).",
        onlineBookingOpen: open,
        depositHoldMinutes: booking.holdMinutes,
      },
    };
  },
});

const searchKnowledge = tool({
  kind: "read",
  def: {
    name: "search_knowledge",
    description:
      "Search YM Freak's knowledge base (FAQ, policies, process): which files to send and in what format, how to send them, payments, revisions, cancellations, sessions, ads, turnaround. Returns the most relevant entries.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "What the visitor wants to know, in a few words." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  input: z.object({ query: z.string().max(300) }),
  async run({ query }, ctx) {
    const rows = await db.knowledgeEntry.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    const es = ctx.locale === "es";
    const words = normalize(query)
      .split(" ")
      .filter((w) => w.length >= 3);
    const scored = rows
      .map((k) => {
        const hay = normalize([k.questionEs, k.questionEn, k.answerEs, k.answerEn].join(" "));
        const tags = normalize(k.tags.join(" "));
        const score = words.reduce((s, w) => s + (tags.includes(w) ? 3 : 0) + (hay.includes(w) ? 1 : 0), 0);
        return { k, score };
      })
      .sort((a, b) => b.score - a.score);
    const hits = scored.filter((s) => s.score > 0).slice(0, 6);
    const chosen = hits.length > 0 ? hits : scored.slice(0, 12);
    return {
      result: {
        entries: chosen.map(({ k }) => ({ question: (es ? k.questionEs : k.questionEn) ?? "", answer: es ? k.answerEs : k.answerEn })),
        note: hits.length > 0 ? undefined : "No direct match; these are all entries. If none answers the question, say so and offer contact.",
      },
    };
  },
});

const getPortfolio = tool({
  kind: "read",
  def: {
    name: "get_portfolio",
    description: "YM Freak's published releases (title, artist, year, his credit, link) and achievements (nominations, certifications).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  input: z.object({}).passthrough(),
  async run(_input, ctx) {
    const es = ctx.locale === "es";
    const [items, achievements] = await Promise.all([
      db.portfolioItem.findMany({ where: { published: true }, orderBy: [{ sortOrder: "asc" }, { year: "desc" }], take: 30 }),
      db.achievement.findMany({ where: { published: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    return {
      result: {
        releases: items.map((p) => ({
          title: p.title,
          artist: p.artist,
          year: p.year,
          credit: es ? p.creditEs : p.creditEn,
          link: p.externalUrl,
        })),
        achievements: achievements.map((a) => ({ kind: a.kind, title: es ? a.titleEs : a.titleEn, detail: es ? a.detailEs : a.detailEn, year: a.year })),
        listen: `/${ctx.locale}/portfolio`,
      },
    };
  },
});

const getContact = tool({
  kind: "read",
  def: {
    name: "get_contact",
    description: "YM Freak's contact channels (email, Instagram, WhatsApp, YouTube). Use it to hand over to YM Freak for anything you can't resolve.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  input: z.object({}).passthrough(),
  async run() {
    const c = await getSetting("contact");
    return {
      result: { email: c.email, instagram: c.instagram, whatsapp: c.whatsapp ? `https://wa.me/${c.whatsapp}` : "", youtube: c.youtube },
      card: { kind: "contact", email: c.email, instagram: c.instagram, whatsapp: c.whatsapp },
    };
  },
});

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const quoteDeliveryTool = tool({
  kind: "read",
  def: {
    name: "quote_delivery",
    description:
      "Real price and delivery date for delivered work (mixing, mastering, beats, production, arrangements, DJ edits, ads), from the live calendar and capacity. Several services for the same songs can be combined. Optionally checks whether a date the visitor needs is achievable.",
    input_schema: {
      type: "object",
      properties: {
        services: { type: "array", items: { type: "string" }, description: "Service slugs from get_services (bookingMode DELIVERY)." },
        songs: { type: "integer", minimum: 1, maximum: 20 },
        requested_delivery_date: { type: "string", description: "YYYY-MM-DD, only if the visitor needs it by a specific date." },
      },
      required: ["services", "songs"],
      additionalProperties: false,
    },
  },
  input: z.object({ services: z.array(z.string().max(60)).min(1).max(4), songs: z.number().int().min(1).max(20), requested_delivery_date: localDate.optional() }),
  async run(input, ctx) {
    const q = await quoteDelivery(
      { services: input.services, songs: input.songs, requestedDeliveryDate: input.requested_delivery_date, locale: ctx.locale },
      ctx.now,
    );
    if (!q.ok) return { isError: true, result: { error: q.error, hint: hintFor(q.error) } };
    const startDate = fmtLocalDate(q.firstStartDate, ctx.locale);
    const deliveryDate = fmtLocalDate(q.deliveryDate, ctx.locale);
    return {
      result: {
        ...quoteForModel(q.quote, ctx.locale),
        turnaroundWorkingDays: q.turnaroundDays,
        workStarts: { date: q.firstStartDate, label: startDate },
        estimatedDelivery: { date: q.deliveryDate, label: deliveryDate },
        requested: q.requested ? { date: q.requested.date, achievable: q.requested.feasible } : null,
        note: "Dates hold only once booked and the deposit is paid.",
      },
      card: {
        kind: "quote",
        lines: q.quote.lines.map((l) => ({ name: l.name, quantity: l.quantity, amount: money(l.lineTotalCents, ctx.locale) })),
        total: money(q.quote.totalCents, ctx.locale),
        deposit: money(q.quote.depositCents, ctx.locale),
        balance: money(q.quote.balanceCents, ctx.locale),
        depositPercent: q.quote.depositPercent,
        startDate,
        deliveryDate,
        requested: q.requested ? { date: fmtLocalDate(q.requested.date, ctx.locale), feasible: q.requested.feasible } : null,
      },
    };
  },
});

const checkSlots = tool({
  kind: "read",
  def: {
    name: "check_session_slots",
    description:
      "Free start times on a given day for an hourly remote session (vocal recording or producer coaching), from the live calendar. Returns ISO start times to use in propose_booking.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service slug with bookingMode SESSION." },
        hours: { type: "integer", minimum: 1, maximum: 4 },
        date: { type: "string", description: "YYYY-MM-DD in YM Freak's time zone." },
      },
      required: ["service", "hours", "date"],
      additionalProperties: false,
    },
  },
  input: z.object({ service: z.string().max(60), hours: z.number().int().min(1).max(4), date: localDate }),
  async run(input, ctx) {
    const a = await sessionAvailability({ ...input, locale: ctx.locale }, ctx.now);
    if (!a.ok) return { isError: true, result: { error: a.error, hint: hintFor(a.error) } };
    const slots = a.slots.map((iso) => ({ iso, label: fmtTime(new Date(iso), a.timeZone, ctx.locale) }));
    const dateLabel = fmtLocalDate(a.date, ctx.locale);
    return {
      result: {
        date: a.date,
        dateLabel,
        timeZone: a.timeZone,
        durationMinutes: a.durationMinutes,
        freeStartTimes: slots.map((s) => ({ startsAt: s.iso, local: s.label })),
        ...quoteForModel(a.quote, ctx.locale),
        note: slots.length === 0 ? "No free times that day; suggest another working day." : undefined,
      },
      ...(slots.length > 0
        ? { card: { kind: "slots" as const, serviceName: a.quote.lines[0]?.name ?? input.service, dateLabel, timeZone: a.timeZone, slots } }
        : {}),
    };
  },
});

const bookingStatus = tool({
  kind: "read",
  def: {
    name: "get_booking_status",
    description: "Status of an existing booking. Requires the booking code (e.g. YMF-AB2CD) and the email used to book; both must match.",
    input_schema: {
      type: "object",
      properties: { code: { type: "string" }, email: { type: "string" } },
      required: ["code", "email"],
      additionalProperties: false,
    },
  },
  input: z.object({ code: z.string().max(20), email: z.string().max(254) }),
  async run(input, ctx) {
    if (!(await allowRate(`agent-status:${ctx.ip}`, 10, 60 * 60_000))) return { isError: true, result: { error: "RATE_LIMITED" } };
    const code = input.code.trim().toUpperCase();
    const booking = await db.booking.findUnique({
      where: { code },
      include: { customer: true, order: { include: { payments: true } }, items: { include: { service: true } } },
    });
    if (!booking || booking.customer.email.toLowerCase() !== input.email.trim().toLowerCase() || !booking.order) {
      return { isError: true, result: { error: "NOT_FOUND", hint: "Code and email don't match a booking. Ask the visitor to check both." } };
    }
    const [rules, tc, ta] = await Promise.all([
      getSetting("business_rules"),
      getTranslations({ locale: ctx.locale, namespace: "checkout" }),
      getTranslations({ locale: ctx.locale, namespace: "agent.card" }),
    ]);
    const order = booking.order;
    const paid = order.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amountCents, 0);
    const due = amountDue({ ...order, booking });
    const status = tc(`status.${booking.status}`);
    const when = booking.deliveryDate
      ? { label: ta("delivery"), value: fmtLocalDate(fromDateColumn(booking.deliveryDate), ctx.locale) }
      : booking.startsAt
        ? { label: ta("session"), value: fmtDateTime(booking.startsAt, rules.timeZone, ctx.locale) }
        : null;
    const services = booking.items.map((i) => (ctx.locale === "es" ? i.service.nameEs : i.service.nameEn)).join(" + ");
    const checkoutPath = `/${ctx.locale}/checkout/${order.id}`;
    return {
      result: {
        code: booking.code,
        status: booking.status,
        statusLabel: status,
        services,
        when: when?.value ?? null,
        total: money(order.totalCents, ctx.locale),
        paid: money(paid, ctx.locale),
        dueNow: due ? { kind: due.kind, amount: money(due.amountCents, ctx.locale) } : null,
        bookingPage: checkoutPath,
        clientPortal: `/${ctx.locale}/account`,
      },
      card: {
        kind: "status",
        code: booking.code,
        status,
        checkoutPath,
        rows: [
          { label: ta("services"), value: services },
          ...(when ? [when] : []),
          { label: ta("total"), value: money(order.totalCents, ctx.locale) },
          { label: ta("paid"), value: money(paid, ctx.locale) },
        ],
      },
    };
  },
});

// ---------------------------------------------------------------------------
// WRITE tool (needs the visitor's explicit confirmation in the UI)
// ---------------------------------------------------------------------------

const FIELD_NAMES: Record<string, string> = {
  "customer.name": "name",
  "customer.email": "email",
  "customer.phone": "phone",
  "project.artistName": "artist_name",
  "project.songTitle": "song_title",
  "project.referenceLinks": "reference_link",
  "project.notes": "notes",
  startsAt: "starts_at",
  services: "services",
  songs: "songs",
  hours: "hours",
  service: "service",
};

const proposeBooking = tool({
  kind: "write",
  def: {
    name: "propose_booking",
    description:
      "Prepare a booking for the visitor to confirm. Does NOT book: it validates everything, recomputes price and availability on the server and shows the visitor a summary card with Confirm / Cancel buttons. Only the visitor's click books. DELIVERY needs services + songs; SESSION needs service + hours + starts_at (an ISO time returned by check_session_slots). Always needs name, email and artist_name; song_title is required for DELIVERY.",
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["DELIVERY", "SESSION"] },
        services: { type: "array", items: { type: "string" }, description: "DELIVERY: service slugs." },
        songs: { type: "integer", minimum: 1, maximum: 20, description: "DELIVERY: number of songs." },
        service: { type: "string", description: "SESSION: service slug." },
        hours: { type: "integer", minimum: 1, maximum: 4, description: "SESSION: hours." },
        starts_at: { type: "string", description: "SESSION: ISO start time from check_session_slots." },
        requested_delivery_date: { type: "string", description: "DELIVERY, optional: YYYY-MM-DD the visitor needs it by." },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string", description: "Optional, with country code." },
        artist_name: { type: "string" },
        song_title: { type: "string" },
        notes: { type: "string" },
        reference_link: { type: "string", description: "Optional https link to a reference song." },
      },
      required: ["mode", "name", "email", "artist_name"],
      additionalProperties: false,
    },
  },
  input: proposeInput,
  async run(input, ctx) {
    if (!(await bookingOpen())) {
      return { isError: true, result: { error: "BOOKING_CLOSED", hint: "Online booking isn't open yet. Offer to connect them with YM Freak (get_contact)." } };
    }
    const parsed = toBookingRequest(input, ctx.locale);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => FIELD_NAMES[i.path.join(".")] ?? FIELD_NAMES[String(i.path[0])] ?? i.path.join(".")))];
      return { isError: true, result: { error: "INVALID", fields, hint: "Ask the visitor for these fields (or correct them) and try again." } };
    }
    const req = parsed.data;
    const t = await getTranslations({ locale: ctx.locale, namespace: "agent.card" });
    const rules = await getSetting("business_rules");

    let quote: QuoteSummary;
    let whenRow: { label: string; value: string };
    if (req.mode === "DELIVERY") {
      const q = await quoteDelivery({ services: req.services, songs: req.songs, requestedDeliveryDate: req.requestedDeliveryDate, locale: ctx.locale }, ctx.now);
      if (!q.ok) return { isError: true, result: { error: q.error, hint: hintFor(q.error) } };
      quote = q.quote;
      whenRow = { label: t("delivery"), value: fmtLocalDate(q.deliveryDate, ctx.locale) };
    } else {
      const start = new Date(req.startsAt);
      const a = await sessionAvailability({ service: req.service, hours: req.hours, date: toLocalDate(start, rules.timeZone), locale: ctx.locale }, ctx.now);
      if (!a.ok) return { isError: true, result: { error: a.error, hint: hintFor(a.error) } };
      if (!a.slots.some((s) => new Date(s).getTime() === start.getTime())) {
        return { isError: true, result: { error: "SLOT_TAKEN", hint: "That time is not free. Call check_session_slots again and offer the free times." } };
      }
      quote = a.quote;
      whenRow = { label: t("session"), value: `${fmtDateTime(start, rules.timeZone, ctx.locale)} (${rules.timeZone})` };
    }

    const rows = [
      { label: t("services"), value: quote.lines.map((l) => l.name).join(" + ") },
      req.mode === "DELIVERY" ? { label: t("songs"), value: String(req.songs) } : { label: t("hours"), value: String(req.hours) },
      whenRow,
      { label: t("name"), value: req.customer.name },
      { label: t("email"), value: req.customer.email },
      { label: t("artist"), value: req.project.artistName },
      ...(req.project.songTitle ? [{ label: t("song"), value: req.project.songTitle }] : []),
    ];
    const expiresAt = new Date(ctx.now.getTime() + PROPOSAL_MINUTES * 60_000);
    const summary = { title: t("proposalTitle"), rows, total: money(quote.totalCents, ctx.locale), deposit: money(quote.depositCents, ctx.locale) };

    // A newer proposal replaces any older open one in this conversation.
    await db.pendingAction.updateMany({
      where: { conversationId: ctx.conversationId, confirmedAt: null, expiresAt: { gt: ctx.now } },
      data: { expiresAt: ctx.now },
    });
    const action = await db.pendingAction.create({
      data: { conversationId: ctx.conversationId, type: "CREATE_BOOKING", payload: req as unknown as Prisma.InputJsonValue, summary: summary as unknown as Prisma.InputJsonValue, expiresAt },
    });
    await db.conversation.updateMany({ where: { id: ctx.conversationId, outcome: "NONE" }, data: { outcome: "LEAD" } });

    return {
      result: {
        status: "AWAITING_VISITOR_CONFIRMATION",
        summary: { ...quoteForModel(quote, ctx.locale), [whenRow.label]: whenRow.value },
        expiresInMinutes: PROPOSAL_MINUTES,
        instruction: "Nothing is booked yet. Ask the visitor to review the card and press Confirm. Then they pay the deposit on PayPal.",
      },
      card: { kind: "proposal", actionId: action.id, ...summary, expiresAt: expiresAt.toISOString(), state: "open" },
    };
  },
});

function hintFor(error: string): string {
  switch (error) {
    case "UNKNOWN_SERVICE":
      return "Unknown or inactive service slug. Call get_services and use an exact slug.";
    case "WRONG_MODE":
      return "That service uses the other booking mode (DELIVERY vs SESSION). Check get_services.";
    case "INVALID_QUANTITY":
      return "Invalid quantity for that service.";
    case "NO_CAPACITY":
      return "No capacity in the calendar for that request right now. Offer contact with YM Freak.";
    case "INVALID_DATE":
      return "Date outside the bookable range or invalid. Sessions can be booked up to 60 days ahead.";
    case "BOOKING_CLOSED":
      return "Online booking isn't open yet. Offer contact.";
    default:
      return "Try again or offer contact.";
  }
}

// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL: Tool<any>[] = [getServices, getBusinessInfo, searchKnowledge, getPortfolio, getContact, quoteDeliveryTool, checkSlots, bookingStatus, proposeBooking];

export const TOOL_DEFS: ToolDef[] = ALL.map((t) => t.def);
export const WRITE_TOOLS = new Set(ALL.filter((t) => t.kind === "write").map((t) => t.def.name));

/** Runs one tool call from the model. Input is validated; failures come back as tool errors, never as exceptions. */
export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const t = ALL.find((x) => x.def.name === name);
  if (!t) return { isError: true, result: { error: "UNKNOWN_TOOL" } };
  const parsed = t.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { isError: true, result: { error: "INVALID_INPUT", issues: parsed.error.issues.map((i: z.ZodIssue) => `${i.path.join(".")}: ${i.message}`) } };
  }
  try {
    return await t.run(parsed.data, ctx);
  } catch (e) {
    console.error(`[agent] tool ${name} failed`, e);
    return { isError: true, result: { error: "TOOL_FAILED", hint: "Temporary problem. Apologise briefly and offer contact." } };
  }
}

export type { BookingRequest };
