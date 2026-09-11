ALTER TYPE "AuditAction" ADD VALUE 'RESOURCE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'RESOURCE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'AVAILABILITY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AVAILABILITY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'BOOKING_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BOOKING_CANCELLED';

CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AvailabilityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHDRAWN');
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "resources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "venue_id" UUID NOT NULL,
  "name" VARCHAR(150) NOT NULL, "description" TEXT, "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ, CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "availability_slots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "resource_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ NOT NULL, "ends_at" TIMESTAMPTZ NOT NULL,
  "status" "AvailabilityStatus" NOT NULL DEFAULT 'DRAFT', "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_slots_valid_interval" CHECK ("starts_at" < "ends_at")
);
CREATE TABLE "bookings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "resource_id" UUID NOT NULL,
  "availability_slot_id" UUID NOT NULL, "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "idempotency_key" VARCHAR(100) NOT NULL, "cancelled_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "resources_venue_id_name_key" ON "resources"("venue_id", "name");
CREATE INDEX "resources_venue_id_status_idx" ON "resources"("venue_id", "status");
CREATE INDEX "availability_slots_resource_id_starts_at_ends_at_idx" ON "availability_slots"("resource_id", "starts_at", "ends_at");
CREATE INDEX "availability_slots_status_starts_at_idx" ON "availability_slots"("status", "starts_at");
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_no_overlap" EXCLUDE USING gist (
  "resource_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" IN ('DRAFT', 'PUBLISHED'));
CREATE UNIQUE INDEX "bookings_one_confirmed_per_slot_key" ON "bookings"("availability_slot_id") WHERE "status" = 'CONFIRMED';
CREATE INDEX "bookings_availability_slot_id_status_idx" ON "bookings"("availability_slot_id", "status");
CREATE UNIQUE INDEX "bookings_user_id_idempotency_key_key" ON "bookings"("user_id", "idempotency_key");
CREATE INDEX "bookings_user_id_status_created_at_idx" ON "bookings"("user_id", "status", "created_at");
CREATE INDEX "bookings_resource_id_status_idx" ON "bookings"("resource_id", "status");
ALTER TABLE "resources" ADD CONSTRAINT "resources_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_availability_slot_id_fkey" FOREIGN KEY ("availability_slot_id") REFERENCES "availability_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
