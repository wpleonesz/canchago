-- Add columns to organizations table
ALTER TABLE "organizations" ADD COLUMN "email" VARCHAR(180),
ADD COLUMN "phone" VARCHAR(20),
ADD COLUMN "domain" VARCHAR(255),
ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Add index to organizations name column
CREATE INDEX "organizations_name_idx" ON "organizations"("name");

-- Add columns to venues table
ALTER TABLE "venues" ADD COLUMN "address" TEXT,
ADD COLUMN "phone" VARCHAR(20),
ADD COLUMN "email" VARCHAR(180),
ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Add unique constraint on venues (organization_id, name)
ALTER TABLE "venues" ADD CONSTRAINT "venues_organization_id_name_key" UNIQUE("organization_id", "name");
