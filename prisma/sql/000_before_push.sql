-- Runs before `prisma db push` on deploy. Prepares changes Prisma would
-- otherwise refuse without --accept-data-loss (which we never use, so a
-- destructive change can't slip into production). Safe to run every time.

DO $$
BEGIN
  -- Client reviews: one review per booking (unique, nullable column).
  IF to_regclass('"Testimonial"') IS NOT NULL THEN
    ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "Testimonial_bookingId_key" ON "Testimonial"("bookingId");
  END IF;
END $$;
