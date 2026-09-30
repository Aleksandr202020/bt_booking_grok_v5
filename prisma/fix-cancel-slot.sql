-- Run once in Neon SQL Editor so CANCELLED bookings free the time slot

-- Drop old unique constraint / index if present (name may vary)
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "unique_confirmed_slot";
DROP INDEX IF EXISTS "unique_confirmed_slot";
DROP INDEX IF EXISTS "bookings_date_startTime_key";

-- Only one CONFIRMED booking per date+time
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_confirmed_slot_uidx"
  ON "bookings" ("date", "startTime")
  WHERE "status" = 'CONFIRMED';
