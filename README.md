# YM Freak — ymfreak.com

Official site, booking and payments platform for YM Freak (producer, mixing & mastering engineer).

**Current state: Phase 0 — technical foundation.** There is no visual design yet; that is Phase 1.

## Stack

Next.js (App Router) · TypeScript strict · Tailwind CSS · PostgreSQL + Prisma · next-intl (ES/EN) · Zod · PayPal (behind a `PaymentProvider` interface) · Claude API for the assistant (Phase 5) · Vercel.

## Run it locally

Requirements: Node 22 and a PostgreSQL 16 database (local, or a free one at neon.tech / supabase.com).

```bash
cp .env.example .env.local          # fill DATABASE_URL and NEXT_PUBLIC_SITE_URL
npm install
npx prisma migrate dev --name init  # creates the tables (first time only)
npm run db:constraints              # session no-overlap + money sanity constraints
npm run db:seed                     # services, prices, business rules, FAQ, Latin Grammy
npm run dev                         # http://localhost:3000/es and /en
npm run check                       # typecheck + lint + unit tests
```

The home page in this phase lists the services with prices and turnaround **read from the database**, in Spanish and English. If you change a price in the database (`npm run db:studio`), the page changes. That is the proof that prices are not hard-coded.

## Where things live

| Path | What |
|---|---|
| `src/server/domain/` | Business rules as pure TypeScript, no database: pricing, 50/50 deposit, extra revisions, delivery dates, session slots, booking states, cancellation. Fully unit-tested. |
| `src/server/catalog`, `settings` | The only read path to services and settings. The site, checkout and assistant all go through it. |
| `src/server/payments/provider.ts` | Payment provider interface. PayPal implements it in Phase 4. |
| `src/lib/validators/` | Zod schemas shared by forms, server actions and assistant tools. Requests never carry a price. |
| `prisma/schema.prisma` | Database schema. `prisma/sql/` holds constraints Prisma can't express. |
| `content/` | **Initial data for the seed only.** After seeding, the database is the source of truth and edits happen in the dashboard (Phase 2). |
| `messages/` | Interface text in ES/EN. |

## Business rules (as configured)

All of these are stored in the database (`Setting.business_rules` and `Service`) and editable without code.

- **Payment:** 50 % deposit to book, 50 % balance on delivery; final files are released after the balance. Provider: PayPal.
- **Turnaround (working days, Mon–Fri):** mixing + mastering 4 · mastering 4\* · beat 4 · arrangements 4 · DJ edits 4 · ads 4\* · full production 8. Combined services for one song add up.
- **Capacity:** 2 new projects can start per working day; work starts the next working day after booking.
- **Sessions** (vocal recording, producer coaching): remote by video call, per hour, 08:00–18:00 Santo Domingo time, 12 h notice, never overlapping (enforced by the database).
- **Revisions:** 2 free per song, then $20 each.
- **Cancellation:** full refund if cancelled within 24 h of paying the deposit; after that, manual handling by YM Freak.

\* Provisional — waiting for YM Freak to confirm.

## Verification status

| Part | Status |
|---|---|
| Domain rules (`src/server/domain`), validators, settings schemas, seed data consistency | **Verified:** strict typecheck + 28 unit tests passing. |
| Next.js app, Prisma schema, seed script, i18n, CI workflow | **Written, not yet run.** The build environment used for Phase 0 had no access to the npm registry. First real run: `npm install && npm run check` locally, or push to GitHub and let `.github/workflows/ci.yml` run it against a real Postgres. |

## Pending from YM Freak

- Confirm turnaround for **mastering only** and **ads**.
- How clients send stems/files (seeded as an inactive FAQ until answered).
- Portfolio: Spotify/YouTube links, covers, credits, years.
- Gold/platinum certifications: which songs, which certifier.
- Photos, real testimonials, social links, contact email and WhatsApp.
- PayPal **Business** account + REST app credentials (Phase 4).

## Roadmap

0. Foundation ← *here*
1. Public site: design system, Home, Portfolio (Spotify/YouTube embeds loaded on click), Services, About, Achievements, FAQ, Contact
2. Auth (magic link) + admin dashboard
3. Availability + bookings (`/book`)
4. PayPal: deposit and balance checkouts, webhooks, refunds, emails
5. Assistant with tools + editable knowledge base
6. Client portal
7. SEO, analytics, performance, security hardening
