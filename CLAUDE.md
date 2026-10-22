# Kopi Parang Keuangan — konteks untuk Claude Code

Web app akuntansi Kopi Parang (kedai kopi, Solo), pengganti file Excel `KOPI_PARANG_LAPORAN_KEUANGAN_2026_v2.xlsx`.
Stack sama dengan Parang-ops: **React 18 + TS + Tailwind (Vite)** di `frontend/`, **Express + TS + Prisma +
PostgreSQL** di `backend/`.

Sumber kebenaran: `docs/SPESIFIKASI.md`. Kalau kode dan spesifikasi berbeda, ikuti spesifikasi
(atau tanyakan ke owner), lalu perbarui yang salah.

**Baca dulu sebelum mengerjakan:**
- `.agents/business-logic.md` — batas dengan Parang-ops, alur data, angka patokan, constraint, hak akses
- `.agents/tech-stack-backend.md` — struktur & aturan backend
- `.agents/tech-stack-frontend.md` — struktur & aturan frontend

## Aplikasi ini BERDIRI SENDIRI

| | Parang-ops (repo lain) | Kopi Parang Keuangan (repo ini) |
| --- | --- | --- |
| Mencatat | Barang: stok, pembelian, repack, prep, resep, HPP per menu, absensi | Uang: omzet harian, setoran, jurnal, aset tetap, pajak, laporan |
| Majoo | Import Excel "Laporan Penjualan Produk" | Tidak ada koneksi. Angka tutup kasir diketik kasir |
| Login | PIN staf | PIN 6 digit sendiri (unik, tanpa pilih nama) untuk semua peran (sementara; rencana spesifikasi: email + 2FA untuk owner/admin) |

- **Jangan** menambah koneksi ke Majoo atau Parang-ops (API, import file, tabel/database bersama, SSO, sinkron PIN).
- **Jangan** menambah modul stok/resep/absensi di sini. Laba/kas/utang hanya dihitung di sini.
- Satu-satunya jembatan: 3 angka bulanan Parang-ops yang diketik manual di Tutup Buku (`ops_monthly_figures`).

## Peta kode

```
backend/src/engine/engine.ts     mesin hitung murni (compute, calcDay, generalLedger) — port 1:1 prototype/engine.js
backend/src/services/            business logic + Prisma + audit (ledgerService memuat DB → input mesin)
backend/src/routes/index.ts      semua route + hak akses per peran
backend/prisma/schema.prisma     model data; seed.ts = data dummy, seed-legacy.ts = impor prototype/data.js (data asli)
frontend/src/pages/              satu halaman per menu
frontend/src/components/reports/ ReportTable + buildRows (tampilan & ekspor dari definisi yang sama)
```

## Menjalankan

```
cd backend && npm run dev            # API :4100 (butuh .env, lihat .env.example)
cd frontend && npm run dev           # UI :5174
cd backend && npm run check:patokan  # harus "Semua angka cocok"
cd backend && npx tsc --noEmit       # typecheck backend
cd frontend && npm run build         # typecheck + build frontend
```

## Angka patokan (tutup buku September 2026)

Pendapatan bersih Jan–Sep 795.505.902 · Laba kotor 456.926.368 · Laba bersih −54.996.702 ·
Total aset 101.739.014 · Liabilitas 74.619.781 · Ekuitas 27.119.233 · Omzet bersih/hari buka 3.179.317.

## Aturan kerja

- Nominal selalu integer rupiah (BigInt di database), bukan float.
- Jurnal OTOMATIS/PENYESUAIAN dibuat ulang mesin; jangan diinput atau diimpor.
- Hapus = soft delete (`voided_at`); bulan yang ditutup terkunci (HTTP 423).
- Setiap mutasi menulis `audit_logs`.
- Kalau mengubah `backend/src/engine/`, jalankan `npm run check:patokan` sebelum selesai, dan samakan
  `frontend/src/utils/calcDay.ts` jika rumus omzet harian berubah.
- Repo berisi data keuangan asli: harus **private**. Jangan commit kredensial atau file `.env`.

## Belum dikerjakan (lihat fase di spesifikasi)

- Skrip migrasi yang membaca file Excel v2 langsung (`seed-legacy.ts` sementara memakai `prototype/data.js`).
- Login email + kata sandi + 2FA untuk owner/admin (kodenya ada di `authService.loginWithPassword`, belum dipakai UI; sementara semua peran login PIN).
- Rincian saldo awal per pihak (`opening_balance_details`) belum diisi seed.
- Halaman Rekap Omzet, Analisis Event detail, Pajak (PBJT), CALK di frontend (endpoint
  `/api/reports/sales-recap`, `/events`, `/tax` sudah ada) — Fase 3.
- Edit jurnal & aset dari UI (endpoint PUT sudah ada), kelola akun dari UI (endpoint sudah ada).
- Pembuatan tahun buku baru (rollover 2027).
