-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'KASIR');

-- CreateEnum
CREATE TYPE "AccountGroup" AS ENUM ('ASET', 'LIABILITAS', 'EKUITAS', 'PENDAPATAN', 'BEBAN');

-- CreateEnum
CREATE TYPE "NormalSide" AS ENUM ('D', 'K');

-- CreateEnum
CREATE TYPE "CashCategory" AS ENUM ('KAS', 'OPERASI', 'INVESTASI', 'PENDANAAN', 'NONKAS');

-- CreateEnum
CREATE TYPE "JournalKind" AS ENUM ('UMUM', 'OTOMATIS', 'PENYESUAIAN');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('KARYAWAN', 'SUPPLIER', 'PEMBERI_PINJAMAN', 'OWNER', 'LAINNYA');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'VOID', 'VERIFY', 'CLOSE', 'REOPEN');

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "business_name" TEXT NOT NULL DEFAULT 'Kopi Parang',
    "closed_month" INTEGER NOT NULL DEFAULT 0,
    "pbjt_rate" DECIMAL(6,4) NOT NULL DEFAULT 0.1,
    "price_includes_tax" BOOLEAN NOT NULL DEFAULT true,
    "accrue_pbjt" BOOLEAN NOT NULL DEFAULT true,
    "revenue_target" BIGINT NOT NULL DEFAULT 100000000,
    "food_cost_limit" DECIMAL(6,4) NOT NULL DEFAULT 0.35,
    "payroll_limit" DECIMAL(6,4) NOT NULL DEFAULT 0.30,
    "occupancy_limit" DECIMAL(6,4) NOT NULL DEFAULT 0.10,
    "prime_cost_limit" DECIMAL(6,4) NOT NULL DEFAULT 0.65,
    "net_margin_target" DECIMAL(6,4) NOT NULL DEFAULT 0.10,
    "cash_diff_threshold" BIGINT NOT NULL DEFAULT 50000,
    "ops_purchase_tolerance_pct" DECIMAL(6,4) NOT NULL DEFAULT 0.05,
    "ops_sales_tolerance_pct" DECIMAL(6,4) NOT NULL DEFAULT 0.02,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "AccountGroup" NOT NULL,
    "report_line" TEXT,
    "normal_side" "NormalSide" NOT NULL,
    "cash_category" "CashCategory" NOT NULL,
    "cash_flow_line" TEXT,
    "opening_balance" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_balance_details" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "party_id" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "opening_balance_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_notes" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" SERIAL NOT NULL,
    "voucher_no" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "receipt_no" TEXT,
    "kind" "JournalKind" NOT NULL DEFAULT 'UMUM',
    "event_id" INTEGER,
    "party_id" INTEGER,
    "source_type" TEXT,
    "source_ref" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    "voided_by" INTEGER,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" SERIAL NOT NULL,
    "entry_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "debit" BIGINT NOT NULL DEFAULT 0,
    "credit" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sales" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "cash_pos" BIGINT,
    "edc_pos" BIGINT,
    "cash_shift1" BIGINT,
    "cash_shift2" BIGINT,
    "edc_settled" BIGINT,
    "compliment" BIGINT,
    "owner_bill" BIGINT,
    "items_sold" INTEGER,
    "transactions" INTEGER,
    "verified_by" INTEGER,
    "verified_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_staff_bons" (
    "id" SERIAL NOT NULL,
    "daily_sale_id" INTEGER NOT NULL,
    "party_id" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "daily_staff_bons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "acquired_on" DATE NOT NULL,
    "cost" BIGINT NOT NULL,
    "useful_life_years" INTEGER NOT NULL,
    "account_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_filings" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "reported_revenue" BIGINT,
    "pbjt_paid" BIGINT,
    "sspd_no" TEXT,
    "filed_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_monthly_figures" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "stock_value" BIGINT NOT NULL,
    "purchases_total" BIGINT NOT NULL,
    "sales_total" BIGINT,
    "note" TEXT,
    "entered_by" INTEGER,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_monthly_figures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_closings" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closed_by" INTEGER,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopened_by" INTEGER,
    "reopened_at" TIMESTAMP(3),

    CONSTRAINT "period_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL,
    "password_hash" TEXT,
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "pin_hash" TEXT,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_fiscal_year_key" ON "settings"("fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_name_key" ON "accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "opening_balance_details_account_id_party_id_key" ON "opening_balance_details"("account_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "parties_name_key" ON "parties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "events_name_key" ON "events"("name");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_voucher_no_key" ON "journal_entries"("voucher_no");

-- CreateIndex
CREATE INDEX "journal_entries_date_idx" ON "journal_entries"("date");

-- CreateIndex
CREATE INDEX "journal_entries_kind_date_idx" ON "journal_entries"("kind", "date");

-- CreateIndex
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_date_key" ON "daily_sales"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_staff_bons_daily_sale_id_party_id_key" ON "daily_staff_bons"("daily_sale_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_filings_year_month_key" ON "tax_filings"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ops_monthly_figures_year_month_key" ON "ops_monthly_figures"("year", "month");

-- CreateIndex
CREATE INDEX "period_closings_year_month_idx" ON "period_closings"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_at_idx" ON "audit_logs"("at");

-- AddForeignKey
ALTER TABLE "opening_balance_details" ADD CONSTRAINT "opening_balance_details_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_balance_details" ADD CONSTRAINT "opening_balance_details_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_notes" ADD CONSTRAINT "event_notes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_staff_bons" ADD CONSTRAINT "daily_staff_bons_daily_sale_id_fkey" FOREIGN KEY ("daily_sale_id") REFERENCES "daily_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_staff_bons" ADD CONSTRAINT "daily_staff_bons_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

