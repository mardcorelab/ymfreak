# YM Freak — ymfreak.com

Official site, booking and payments platform for YM Freak (producer, mixing & mastering engineer).

**Current state: Phase 1 — public site** (home, work, services, achievements, about, FAQ, contact) on top of the Phase 0 foundation. Booking, payments and the assistant come in later phases; until then every call to action leads to real contact channels (email, Instagram), never to a button that does nothing.

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

Every price, credit, achievement, FAQ and contact link on the site is **read from the database**, in Spanish and English. Change a price with `npm run db:studio` and the site shows it within a minute (pages revalidate every 60 s).

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
| `src/components/` | UI. Components receive localised view models as props and never query the database. |
| `src/server/site-data.ts` | Loaders that turn database rows into the view models the pages render. |
| `public/images/` | YM Freak's portraits, optimised. |

## Design

- **Colour comes from the photos.** The page background is sampled from the studio backdrop of the portraits, so YM Freak's photos melt into the page instead of sitting in boxes. One lighter "key light" section matches the seated portrait.
- **One typeface, Archivo**, used through its width axis: extra-condensed for the name, condensed for headings, normal width for reading.
- **Brass appears only on certifications and nominations** (with a record mark), so it always means the same thing.
- **One motion moment:** the name rises in on load and the portrait settles. Everything else moves only when the visitor acts. Reduced-motion settings are respected.
- **Listening:** releases show their cover; Spotify/YouTube's official player loads only when the visitor presses play, so the page stays fast.

## Business rules (as configured)

All of these are stored in the database (`Setting.business_rules` and `Service`) and editable without code.

- **Payment:** 50 % deposit to book, 50 % balance on delivery; final files are released after the balance. Provider: PayPal.
- **Turnaround (working days, Mon–Fri):** mixing + mastering 4 · mastering 4 · beat 4 · arrangements 4 · DJ edits 4 · ads 4 · full production 8. Combined services for one song add up.
- **Capacity:** 2 new projects can start per working day; work starts the next working day after booking.
- **Sessions** (vocal recording, producer coaching): remote by video call, per hour, 08:00–18:00 Santo Domingo time, 12 h notice, never overlapping (enforced by the database).
- **Revisions:** 2 free per song, then $20 each.
- **Cancellation:** full refund if cancelled within 24 h of paying the deposit; after that, manual handling by YM Freak.
- **Files from clients:** WAV at 48 kHz. Mix & master: dry vocal tracks (no effects at all) + beat split into stems as-is. Mastering only: a cappella, bass, drums, melodies. (Stored as FAQ entries, so the site and the assistant use the same answer.)

## Verification status

| Part | Status |
|---|---|
| Domain rules (`src/server/domain`), validators, settings schemas, seed data consistency | **Verified:** strict typecheck + 30 unit tests passing. |
| Page layout and copy (home, contact, services) | **Rendered and reviewed** at desktop and mobile widths by server-rendering the real components with the seed data. The preview environment lacked the Archivo font and Spotify covers, so final type and covers will look better than the previews. |
| Next.js build, Prisma schema, seed script, i18n routing, CI workflow | **Written, not yet run.** The build environment used for Phase 0 had no access to the npm registry. First real run: `npm install && npm run check` locally, or push to GitHub and let `.github/workflows/ci.yml` run it against a real Postgres. |

## Pending from YM Freak

- More releases for the portfolio (Spotify or YouTube links + your credit on each).
- Platinum certifications, if any: which songs.
- Real testimonials (the section stays hidden until there is at least one).
- WhatsApp number, TikTok and your Spotify artist profile, if you want them shown.
- PayPal **Business** account + REST app credentials (Phase 4).

## Roadmap

0. Foundation
1. Public site: design system, Home, Portfolio (Spotify/YouTube embeds loaded on click), Services, About, Achievements, FAQ, Contact ← *here*
2. Auth (magic link) + admin dashboard
3. Availability + bookings (`/book`)
4. PayPal: deposit and balance checkouts, webhooks, refunds, emails
5. Assistant with tools + editable knowledge base
6. Client portal
7. SEO, analytics, performance, security hardening
