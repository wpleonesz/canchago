-- AlterTable
ALTER TABLE "roles" ADD COLUMN "description" TEXT,
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- CreateIndex (ensure uniqueness for non-deleted roles per org)
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name") WHERE "deleted_at" IS NULL;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN "description" TEXT,
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
