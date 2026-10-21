-- Aktifkan Row Level Security di semua tabel aplikasi, tanpa policy.
--
-- Di Supabase, tabel di schema `public` otomatis bisa diakses lewat API publik (PostgREST) dengan
-- kunci anon. Tanpa RLS, siapa pun yang punya kunci itu bisa membaca data keuangan. Dengan RLS aktif
-- dan tanpa policy, akses lewat API itu ditolak total. Backend ini TIDAK terpengaruh karena
-- mengakses lewat Prisma sebagai pemilik tabel (role `postgres`, yang mem-bypass RLS).
--
-- Catatan: jika backend dijalankan dengan role database yang BUKAN pemilik tabel dan tidak punya
-- BYPASSRLS, semua query akan mengembalikan data kosong. Pakai role pemilik tabel.
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opening_balance_details" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_staff_bons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fixed_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tax_filings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ops_monthly_figures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "period_closings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
