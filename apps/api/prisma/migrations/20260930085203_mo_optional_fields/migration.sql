-- AlterTable
ALTER TABLE "media_orders" ADD COLUMN     "created_by_signatory_id" UUID,
ALTER COLUMN "period_end" DROP NOT NULL,
ALTER COLUMN "payment_method" DROP NOT NULL,
ALTER COLUMN "payment_method" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "media_orders" ADD CONSTRAINT "media_orders_created_by_signatory_id_fkey" FOREIGN KEY ("created_by_signatory_id") REFERENCES "signatories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
