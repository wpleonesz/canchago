-- CreateTable
CREATE TABLE "resource_weekday_discounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "resource_weekday_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_weekday_discounts_resource_id_weekday_key" ON "resource_weekday_discounts"("resource_id", "weekday");

-- AddForeignKey
ALTER TABLE "resource_weekday_discounts" ADD CONSTRAINT "resource_weekday_discounts_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
