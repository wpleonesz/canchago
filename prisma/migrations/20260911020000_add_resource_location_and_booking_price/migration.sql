ALTER TABLE "resources"
  ADD COLUMN "address" VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN "latitude" DECIMAL(9,6),
  ADD COLUMN "longitude" DECIMAL(9,6),
  ADD COLUMN "hourly_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE "resources"
  ADD CONSTRAINT "resources_coordinates_pair_check"
  CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)),
  ADD CONSTRAINT "resources_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "resources_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "resources_hourly_price_check" CHECK ("hourly_price" >= 0),
  ADD CONSTRAINT "resources_currency_check" CHECK ("currency" = 'USD');

ALTER TABLE "bookings"
  ADD COLUMN "hourly_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "duration_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD';

UPDATE "bookings" AS booking
SET "duration_minutes" = GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (slot."ends_at" - slot."starts_at")) / 60)::INTEGER)
FROM "availability_slots" AS slot
WHERE slot."id" = booking."availability_slot_id";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_hourly_price_check" CHECK ("hourly_price" >= 0),
  ADD CONSTRAINT "bookings_duration_minutes_check" CHECK ("duration_minutes" > 0),
  ADD CONSTRAINT "bookings_total_price_check" CHECK ("total_price" >= 0),
  ADD CONSTRAINT "bookings_currency_check" CHECK ("currency" = 'USD');
