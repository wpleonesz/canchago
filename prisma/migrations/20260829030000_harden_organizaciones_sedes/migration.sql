-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'VENUE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'VENUE_UPDATED';

-- DropIndex
DROP INDEX "organizations_name_idx";

-- AlterTable: unicidad real de nombre de organización, comparada de forma
-- case-insensitive (igual criterio que Role.normalizedName) via una columna
-- derivada dedicada, no una expresión sobre "name" directamente.
ALTER TABLE "organizations" ADD COLUMN "normalized_name" VARCHAR(150);
UPDATE "organizations" SET "normalized_name" = lower(trim(regexp_replace("name", '\s+', ' ', 'g')));
ALTER TABLE "organizations" ALTER COLUMN "normalized_name" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_normalized_name_key" ON "organizations"("normalized_name");
