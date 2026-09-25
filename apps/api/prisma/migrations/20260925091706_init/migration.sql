-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_SALES', 'FINANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "MoStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('NOT_READY', 'READY_TO_BILL', 'BILLED', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER', 'CHEQUE_BG');

-- CreateEnum
CREATE TYPE "SignatoryRole" AS ENUM ('ACKNOWLEDGED_BY', 'APPROVED_BY');

-- CreateEnum
CREATE TYPE "FormOptionGroup" AS ENUM ('AD_TYPE', 'COOP_TYPE', 'PLACEMENT', 'AD_LOCATION');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'CANCEL', 'REVISE', 'STATUS_CHANGE', 'LOGIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MO_READY_TO_BILL', 'MO_PERIOD_ENDING', 'MO_BILLING_OVERRIDE');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "logo_key" TEXT,
    "bank_name" TEXT NOT NULL,
    "bank_account_no" TEXT NOT NULL,
    "bank_account_name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sales_id" UUID,
    "last_login_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Sales',
    "signature_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "doc_role" "SignatoryRole" NOT NULL,
    "signature_key" TEXT,
    "stamp_key" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pdf_label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "benefit_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "group" "FormOptionGroup" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "parent_code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "form_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "pic_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "nik" TEXT,
    "npwp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mo_sequences" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mo_sequences_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateTable
CREATE TABLE "media_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "mo_number" TEXT,
    "mo_seq" INTEGER,
    "mo_year" INTEGER,
    "mo_date" DATE NOT NULL,
    "client_id" UUID NOT NULL,
    "client_snapshot" JSONB,
    "sales_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "description" TEXT,
    "airing_date_text" TEXT,
    "selected_options" JSONB NOT NULL DEFAULT '{}',
    "cooperation_detail" TEXT,
    "terms_conditions" TEXT,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'TRANSFER',
    "cheque_no" TEXT,
    "receipt_no" TEXT,
    "due_date_text" TEXT,
    "ad_product" TEXT,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dpp_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ppn_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ppn_rate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "dpp_factor_num" INTEGER NOT NULL DEFAULT 11,
    "dpp_factor_den" INTEGER NOT NULL DEFAULT 12,
    "acknowledged_by_id" UUID,
    "approved_by_id" UUID,
    "signatory_snapshot" JSONB,
    "status" "MoStatus" NOT NULL DEFAULT 'DRAFT',
    "billing_status" "BillingStatus" NOT NULL DEFAULT 'NOT_READY',
    "fulfillment_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cancel_reason" TEXT,
    "revision_of_mo_id" UUID,
    "pdf_key" TEXT,
    "period_ending_notified_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ,
    "submitted_by" UUID,
    "cancelled_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "media_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mo_benefits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_order_id" UUID NOT NULL,
    "benefit_type_id" UUID NOT NULL,
    "target_qty" INTEGER NOT NULL,
    "realized_qty" INTEGER NOT NULL DEFAULT 0,
    "bonus_qty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mo_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_order_id" UUID NOT NULL,
    "mo_benefit_id" UUID NOT NULL,
    "published_date" DATE NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "url_normalized" TEXT NOT NULL,
    "screenshot_key" TEXT,
    "is_bonus" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mo_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_order_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "is_signed_mo" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mo_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_order_id" UUID NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paid_date" DATE,
    "paid_amount" DECIMAL(18,2),
    "receipt_no" TEXT,
    "notes" TEXT,
    "override_reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_sales_id_key" ON "users"("sales_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_organization_id_code_key" ON "sales"("organization_id", "code");

-- CreateIndex
CREATE INDEX "signatories_organization_id_doc_role_idx" ON "signatories"("organization_id", "doc_role");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_types_organization_id_code_key" ON "benefit_types"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "form_options_organization_id_group_code_key" ON "form_options"("organization_id", "group", "code");

-- CreateIndex
CREATE INDEX "clients_organization_id_idx" ON "clients"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_orders_revision_of_mo_id_key" ON "media_orders"("revision_of_mo_id");

-- CreateIndex
CREATE INDEX "media_orders_organization_id_mo_date_idx" ON "media_orders"("organization_id", "mo_date");

-- CreateIndex
CREATE INDEX "media_orders_organization_id_period_start_period_end_idx" ON "media_orders"("organization_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "media_orders_organization_id_status_idx" ON "media_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "media_orders_organization_id_billing_status_idx" ON "media_orders"("organization_id", "billing_status");

-- CreateIndex
CREATE INDEX "media_orders_client_id_idx" ON "media_orders"("client_id");

-- CreateIndex
CREATE INDEX "media_orders_sales_id_idx" ON "media_orders"("sales_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_orders_organization_id_mo_number_key" ON "media_orders"("organization_id", "mo_number");

-- CreateIndex
CREATE UNIQUE INDEX "media_orders_organization_id_mo_year_mo_seq_key" ON "media_orders"("organization_id", "mo_year", "mo_seq");

-- CreateIndex
CREATE UNIQUE INDEX "mo_benefits_media_order_id_benefit_type_id_key" ON "mo_benefits"("media_order_id", "benefit_type_id");

-- CreateIndex
CREATE INDEX "publications_mo_benefit_id_idx" ON "publications"("mo_benefit_id");

-- CreateIndex
CREATE INDEX "publications_published_date_idx" ON "publications"("published_date");

-- CreateIndex
CREATE UNIQUE INDEX "publications_media_order_id_url_normalized_key" ON "publications"("media_order_id", "url_normalized");

-- CreateIndex
CREATE INDEX "mo_attachments_media_order_id_idx" ON "mo_attachments"("media_order_id");

-- CreateIndex
CREATE INDEX "billings_media_order_id_idx" ON "billings"("media_order_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_entity_entity_id_idx" ON "audit_logs"("organization_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatories" ADD CONSTRAINT "signatories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_types" ADD CONSTRAINT "benefit_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_options" ADD CONSTRAINT "form_options_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_sequences" ADD CONSTRAINT "mo_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_orders" ADD CONSTRAINT "media_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_orders" ADD CONSTRAINT "media_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_orders" ADD CONSTRAINT "media_orders_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_orders" ADD CONSTRAINT "media_orders_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "signatories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_orders" ADD CONSTRAINT "media_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "signatories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_orders" ADD CONSTRAINT "media_orders_revision_of_mo_id_fkey" FOREIGN KEY ("revision_of_mo_id") REFERENCES "media_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_benefits" ADD CONSTRAINT "mo_benefits_media_order_id_fkey" FOREIGN KEY ("media_order_id") REFERENCES "media_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_benefits" ADD CONSTRAINT "mo_benefits_benefit_type_id_fkey" FOREIGN KEY ("benefit_type_id") REFERENCES "benefit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_media_order_id_fkey" FOREIGN KEY ("media_order_id") REFERENCES "media_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_mo_benefit_id_fkey" FOREIGN KEY ("mo_benefit_id") REFERENCES "mo_benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mo_attachments" ADD CONSTRAINT "mo_attachments_media_order_id_fkey" FOREIGN KEY ("media_order_id") REFERENCES "media_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billings" ADD CONSTRAINT "billings_media_order_id_fkey" FOREIGN KEY ("media_order_id") REFERENCES "media_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
