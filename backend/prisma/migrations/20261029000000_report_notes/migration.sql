-- CreateTable
CREATE TABLE "report_notes" (
    "id" SERIAL NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_notes_fiscal_year_sort_order_key" ON "report_notes"("fiscal_year", "sort_order");

-- Sama seperti tabel lain: tutup akses lewat API publik Supabase (lihat 20261021000000_enable_rls).
ALTER TABLE "report_notes" ENABLE ROW LEVEL SECURITY;
