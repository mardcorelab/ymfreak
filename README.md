# YM Freak — ymfreak.com

Official site, booking and payments platform for YM Freak (producer, mixing & mastering engineer).

**Current state: Phase 4 — public site, dashboard, bookings and PayPal payments.** Online booking opens to the public from the dashboard once PayPal is configured.

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

## Dashboard (`/dashboard`)

Private panel, in Spanish, to edit everything the site shows: services and prices, portfolio (paste a Spotify or YouTube link; the cover comes from the platform), achievements, testimonials, FAQ, contact links and business rules. Changes appear on the public site immediately, in both languages.

- **Sign-in:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) in Vercel. Until both are set the dashboard stays closed and says why. Changing the password signs every session out.
- **Security:** signed, HTTP-only session cookie (7 days); the middleware redirects, and every admin page and server action checks the session again; 8 failed attempts per IP lock sign-in for 15 minutes; every change is written to an audit log; `/dashboard` is excluded from search engines.
- **Clients, bookings, orders and availability** appear in the dashboard when those phases are built — no empty placeholder screens before then.

## Bookings (`/book`)

- **Delivery work** (mix, master, beats, arrangements, ads): the client picks the service and number of songs and sees the real delivery date, computed from the calendar (2 new projects per working day, Mon–Fri, blocked days, combined turnaround). They can ask whether it makes a specific date.
- **Sessions** (coaching, vocal recording): free hourly slots between 08:00 and 18:00 Santo Domingo time with 12 h notice. A booked slot disappears; the database makes double-booking impossible.
- Booking creates the client, an order with frozen prices (50 % deposit / 50 % balance) and a booking held for 30 minutes while the deposit is paid (Phase 4). Unpaid holds expire and release the date automatically.
- Price and availability are recalculated on the server inside a serializable transaction at the moment of booking; the browser never sends a price.
- Spam protection: hidden honeypot field and per-IP rate limits.
- **Dashboard:** bookings (filters, detail, status changes through the state machine, history, extra-revision fee added automatically from the 3rd revision, balance paid outside the site), manual bookings for clients who book by WhatsApp, clients, a 5-week capacity view, blocked days, and the switch that opens booking to the public.

## Payments (PayPal)

- **Flow:** booking → checkout page (`/checkout/<order>`) → "Pay deposit with PayPal" → PayPal's own page → back to the site, where the payment is captured and the booking moves to **Confirmed**. After delivery the same page offers "Pay the balance"; paying it completes the project.
- **Safety:** amounts come from the order on the server; captures are idempotent (return URL and webhook can both arrive); a deposit is never captured for a date whose hold has expired; amount mismatches are flagged, not confirmed; card/PayPal data never touches this app.
- **Cancellation:** the client can cancel from the checkout page within 24 h of paying the deposit and is refunded automatically through PayPal. The admin can cancel with refund from the booking page.
- **Webhook** (`/api/webhooks/paypal`): every event is verified with PayPal and processed once. It is a backup for clients who close the tab before returning to the site.
- **Setup (Vercel env):** `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` (`sandbox` by default, `live` for real money), `PAYPAL_WEBHOOK_ID`. The dashboard (Availability) shows whether PayPal is connected and in which mode, and refuses to open public booking without it.
- **Tests:** the PayPal client is unit-tested against recorded API shapes; the full payment journey runs in CI with an in-process stand-in for PayPal (`PAYMENTS_TEST_MODE=1`, impossible to enable on Vercel).
- **Not yet:** confirmation emails (needs an email provider and the final domain). Until then the client keeps the checkout link and PayPal sends its own receipt.

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
| Domain rules (`src/server/domain`), validators, settings schemas, seed data consistency | **Verified:** strict typecheck + 52 unit tests passing. |
| Page layout and copy (home, contact, services) | **Rendered and reviewed** at desktop and mobile widths by server-rendering the real components with the seed data. The preview environment lacked the Archivo font and Spotify covers, so final type and covers will look better than the previews. |
| Next.js build, Prisma schema, seed script, i18n routing | **Verified in CI** (GitHub Actions, every push): install, Prisma validate, strict typecheck, lint, unit tests, schema + constraints applied to a real PostgreSQL 16, seed run twice (idempotent), production `next build`. |
| Payments, end to end | **Verified in CI with Playwright**: the admin opens booking once payments are configured; a client pays the deposit and the booking is confirmed; nothing more can be paid until delivery; self-service cancellation needs confirmation and refunds the deposit; after delivery the client pays the balance and the project completes; unverified webhook calls are refused. |
| Booking, end to end | **Verified in CI with Playwright**: booking closed to the public while switched off; a mix & master booking shows the server-computed delivery date and deposit, creates the booking and holds capacity; a booked session slot is no longer offered; cancelling releases capacity; a manual booking cannot be completed until the balance is recorded. |
| Dashboard, end to end | **Verified in CI with Playwright** against the production build and a real database: dashboard closed without a session, wrong password refused, a price edited in the dashboard shows on the public site (and invalid input is explained), an FAQ entry added appears in both languages and is removed, a pasted YouTube link becomes a release that plays on the site, sign-out closes the dashboard. |

## Pending from YM Freak

- More releases for the portfolio (Spotify or YouTube links + your credit on each).
- Platinum certifications, if any: which songs.
- Real testimonials (the section stays hidden until there is at least one).
- WhatsApp number, TikTok and your Spotify artist profile, if you want them shown.
- PayPal **Business** account + REST app credentials (Phase 4).

## Roadmap

0. Foundation
1. Public site: design system, Home, Portfolio (Spotify/YouTube embeds loaded on click), Services, About, Achievements, FAQ, Contact
2. Admin sign-in + dashboard
3. Availability + bookings (`/book`)
4. PayPal: deposit and balance checkouts, webhooks, refunds ← *here* (emails pending)
5. Assistant with tools + editable knowledge base
6. Client portal
7. SEO, analytics, performance, security hardening
