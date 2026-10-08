-- Makes it impossible for two active SESSION bookings to overlap, even if two
-- clients pay at the same moment. Prisma cannot express exclusion constraints,
-- so this runs after `prisma migrate` via `npm run db:constraints` (idempotent).
-- Prisma stores DateTime as timestamp(3) in UTC, hence tsrange.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_session_no_overlap') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT booking_session_no_overlap
      EXCLUDE USING gist (tsrange("startsAt", "endsAt", '[)') WITH &&)
      WHERE (
        "startsAt" IS NOT NULL
        AND "endsAt" IS NOT NULL
        AND status IN ('AWAITING_PAYMENT', 'PAID', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'REVISION')
      );
  END IF;
END $$;

-- Sanity checks the ORM cannot express.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_price_non_negative') THEN
    ALTER TABLE "Service" ADD CONSTRAINT service_price_non_negative CHECK ("priceCents" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_amounts_consistent') THEN
    ALTER TABLE "Order" ADD CONSTRAINT order_amounts_consistent
      CHECK ("depositCents" >= 0 AND "balanceCents" >= 0 AND "depositCents" + "balanceCents" = "totalCents");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capacity_projects_positive') THEN
    ALTER TABLE "CapacityUse" ADD CONSTRAINT capacity_projects_positive CHECK (projects > 0);
  END IF;
END $$;
