-- Add normalized role identity without changing existing public names or codes.
ALTER TABLE "roles" ADD COLUMN "normalized_name" VARCHAR(150);

UPDATE "roles"
SET "normalized_name" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "roles"
    WHERE "organization_id" IS NOT NULL
      AND "deleted_at" IS NULL
    GROUP BY "organization_id", "normalized_name"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede aplicar la unicidad normalizada: existen roles tenant duplicados por nombre.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "roles"
    WHERE "organization_id" IS NOT NULL
      AND "deleted_at" IS NULL
    GROUP BY "organization_id", "code"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede aplicar la unicidad de code: existen roles tenant duplicados.';
  END IF;
END $$;

ALTER TABLE "roles" ALTER COLUMN "normalized_name" SET NOT NULL;

CREATE UNIQUE INDEX "roles_organization_id_normalized_name_key"
  ON "roles"("organization_id", "normalized_name")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "roles_organization_id_code_key"
  ON "roles"("organization_id", "code")
  WHERE "deleted_at" IS NULL;

CREATE TYPE "AuditAction" AS ENUM ('ROLE_CREATED', 'ROLE_UPDATED');

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID NOT NULL,
  "organization_id" UUID,
  "entity_type" VARCHAR(100) NOT NULL,
  "entity_id" UUID NOT NULL,
  "action" "AuditAction" NOT NULL,
  "changes" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
