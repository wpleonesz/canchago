-- CreateTable
CREATE TABLE "organization_access_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by_user_id" UUID,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_access_requests_status_idx" ON "organization_access_requests"("status");

-- CreateIndex
CREATE INDEX "organization_access_requests_organization_id_idx" ON "organization_access_requests"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_access_requests" ADD CONSTRAINT "organization_access_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_access_requests" ADD CONSTRAINT "organization_access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_access_requests" ADD CONSTRAINT "organization_access_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
