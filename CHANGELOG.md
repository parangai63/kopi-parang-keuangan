# Perubahan

## 29 Oktober 2026 (malam): skrip migrasi membaca file Excel v2 langsung

- `backend/prisma/excelData.ts` membaca `KOPI_PARANG_LAPORAN_KEUANGAN_2026_v2.xlsx` langsung (kolom input saja):
  PENGATURAN (termasuk target & batas rasio), AKUN (+ pos laporan, keterangan, rincian saldo awal per pihak),
  OMZET HARIAN, JURNAL (hanya UMUM), ASET TETAP, PAJAK (omzet dilaporkan & SSPD), ANALISIS EVENT (keterangan).
  Menggantikan `legacyData.ts` (jembatan lewat `prototype/data.js`, dihapus).
- `seed:legacy` menerima path file (`npm run seed:legacy -- file.xlsx`), mencetak hal yang perlu dibereskan
  manual, dan **membatalkan seed** bila hasil hitung tidak sama dengan sheet MUTASI.
- `check:patokan` kini juga membaca Excel dan menguji 35 akun × 12 bulan terhadap sheet MUTASI: semua cocok.
- Mesin: jurnal otomatis dari Omzet Harian dibuat untuk semua bulan berdata (juga bulan berjalan), sama seperti
  sheet JURNAL Excel dan spesifikasi Logika 2. Penyusutan bulan berjalan tetap 0, estimasi PBJT hanya bulan
  yang sudah ditutup. Laporan resmi tidak berubah (dipotong di bulan tutup buku).
- Dibanding `data.js`, impor Excel lebih setia: sel compliment/bill owner yang kosong tetap kosong (bukan 0),
  spasi di keterangan jurnal tidak hilang, dan 81 tanggal tanpa data tidak ikut dibuat.
- `xlsx@0.18.5` ditambahkan sebagai devDependency backend (versi sama dengan frontend).

## 29 Oktober 2026 (malam): data Excel v2 yang belum terbawa

Prinsip: data/nilai dan rumus mengikuti Excel v2; hal yang menunggu keputusan owner (PPh, MDR, rekonsiliasi
bank, anggaran event, aset pra-2026) tidak diubah — aplikasi tetap berperilaku seperti Excel v2.

- Seed legacy: kolom "Pos Laporan" dan "Keterangan" untuk 35 akun (sheet AKUN), dan keterangan Event Maharia
  (sheet ANALISIS EVENT) ke `event_notes`.

## 29 Oktober 2026 (sore): CALK, paket laporan, keterangan event

- **CALK** (tab di Laporan): teks sheet CALK Excel v2 dengan angka terisi otomatis lewat `{placeholder}`
  (kas, piutang, aset tetap, PBJT kurang bayar, prive, event rugi terbesar; kalimat rekonsiliasi bank muncul
  bila saldo bank negatif). Owner bisa mengubah/menambah bagian dan kembali ke teks bawaan. Tabel baru
  `report_notes` (migrasi `20261029000000_report_notes`, RLS aktif). Endpoint `GET/PUT /api/reports/notes`.
- **Paket laporan** (tombol di header Laporan): satu PDF (halaman baru per laporan) atau satu Excel (sheet per
  laporan) berisi Laba Rugi, Neraca, Arus Kas, Perubahan Ekuitas, dan CALK. Baris judul/subtotal/total kini tebal di PDF.
- **Keterangan per event** di Analisis Event (tabel `event_notes`, riwayat tersimpan). Endpoint `PUT /api/events/:id/note`.

## 29 Oktober 2026: cek kesehatan, aset tetap, akun & saldo awal per pihak

- **Cek kesehatan data** ditambah dari sheet DASHBOARD Excel v2: daftar aset tetap = akun Peralatan & Akumulasi
  (merah bila beda), plus 3 peringatan kuning: hari omzet perlu cek, aset sebelum tahun buku belum diinventarisasi,
  estimasi PBJT kurang bayar. `check:patokan` ikut menguji peringatan (12 hari, Rp59.326.181 — sama dengan Excel).
- **Aset Tetap**: tombol "Jadwal per bulan" menampilkan penyusutan Jan–Des per aset (juga di ekspor), form ubah
  aset (bulan belum ditutup), dan peringatan bila harga < Rp1 juta (kebijakan di sheet ASET TETAP).
- **Akun & saldo awal** (halaman Akun & Pengaturan, owner): ubah nama (bila belum dipakai), keterangan, saldo awal,
  aktif/nonaktif; rincian saldo awal per pihak untuk piutang & utang, dengan cek jumlah = saldo awal; tambah akun
  beban usaha 61xx (dibatasi di server agar Laba Rugi & Neraca tetap lengkap).
- Endpoint baru: `GET /api/opening-details`, `PUT /api/accounts/:id/opening-details` (owner).
- Seed legacy: 6 rincian saldo awal per pihak dari sheet AKUN.

## 27 Oktober 2026: menu Analisis & pelengkap dari Excel v2

Keputusan: navigasi dan alur aplikasi tetap; dari Excel v2 diambil isi, rumus, dan sheet yang belum ada.

- **Menu Analisis** (owner/admin) dengan tab Rekap Omzet, Pajak (PBJT), dan Analisis Event, mengikuti isi sheet
  REKAP OMZET, PAJAK, dan ANALISIS EVENT. Rekap Omzet ikut menampilkan bulan berjalan (bertanda *), Pajak hanya
  bulan yang sudah ditutup. Semua bisa diekspor ke Excel/PDF.
- **Dashboard**: KPI Total kas (rincian tunai/bank), Food cost, dan Prime cost dengan batas dari Pengaturan, plus
  tabel rincian per bulan (pendapatan bersih, laba kotor, laba bersih, food cost, payroll, kas akhir).
- **Laba Rugi**: baris rasio Marketing & event (sheet LABA RUGI baris 51).
- `Statement` dipindah ke `components/reports/Statement.tsx` agar dipakai halaman Laporan dan Analisis.
- Seed legacy: omzet dilaporkan ke Bapenda Jan–Sep (sheet PAJAK kolom D) ikut diimpor ke `tax_filings`.
- Angka dicocokkan dengan Excel v2: omzet bersih per bulan, selisih tunai/EDC, PBJT kurang bayar 59.326.181,
  kas akhir per bulan, laba rugi per event. `check:patokan` tetap lolos.

## 21 Oktober 2026: tampilan disamakan dengan rancangan original

Keputusan owner: tampilan web app mengikuti `original/kopi-parang-keuangan-artifact.html`, bukan design system Parang-ops.

- `frontend/src/index.css` memakai CSS original apa adanya (nila + soga, Literata/IBM Plex, mode gelap otomatis),
  plus kelas tambahan untuk halaman yang tidak ada di prototipe (login, pengguna, ekspor, pager).
- Sidebar gelap dengan merek motif batik, lencana hari "perlu dicek" di menu Omzet Harian; header dengan chip
  "Tutup buku s.d." dan pengguna yang masuk. Semua halaman memakai markup original (KPI, kalender, form, tabel
  laporan `.t.rep`, wizard `.steps`, layar kasir `.kasir/.setor-row`).
- Login tetap PIN per pengguna (tidak ada tombol ganti peran seperti di prototipe).
- Backend: `/api/auth/me` ikut mengirim `fiscalYear` dan `closedMonth` untuk chip header (semua peran).
- `.agents/tech-stack-frontend.md` diperbarui.

## 21 Oktober 2026: login PIN, data dummy, database Supabase

- **Login PIN untuk semua peran** (sementara, seperti Parang-ops): pilih nama + PIN 6 digit. Login email +
  kata sandi + 2FA tetap ada di kode backend tapi belum dipakai UI. Owner tidak bisa dinonaktifkan/diturunkan
  jika tinggal satu. Halaman Pengguna: tambah pengguna, ganti PIN, nonaktifkan.
- **Seed dummy** (`npm run seed`): 191 jurnal, 288 hari omzet, 3 aset, 6 pihak, 3 event, bulan sebelum bulan berjalan
  ditutup; bulan berjalan sengaja belum rapi untuk demo kasir & Tutup Buku. Akun dummy: Owner 111111, Admin
  222222, Kasir 333333. Data diuji mesin hitung (4 cek kesehatan hijau, kas tidak negatif) sebelum ditulis.
  Seed data asli dipindah ke `npm run seed:legacy` (PIN acak).
- **Migrasi `enable_rls`**: RLS aktif di 16 tabel agar tidak terbuka lewat API publik Supabase.
- `.env` disederhanakan: cukup `DATABASE_URL`. `KPK_SESSION_SECRET` acak otomatis di dev (wajib di production).
- `tsconfig.json` backend: `moduleResolution` `node16` (menghilangkan peringatan deprecation TypeScript).
- Database Supabase di-setup: 2 migrasi diterapkan + seed dummy.

## 20 Oktober 2026 (sore): stack disamakan dengan Parang-ops

Prototipe HTML/JS dipindahkan ke stack yang sama dengan Parang-ops, sebagai project yang tetap terpisah.

### Backend baru (`backend/`) — Express + TypeScript + Prisma + PostgreSQL
- `prisma/schema.prisma` + migrasi awal: 16 tabel sesuai bagian Model data di spesifikasi (nominal BigInt,
  soft delete, audit log).
- Mesin hitung `src/engine/engine.ts`: port 1:1 dari `prototype/engine.js`. `npm run check:patokan` lolos
  semua angka patokan Excel v2 + skenario Parang-ops.
- API per modul dengan hak akses per peran di server: omzet harian (aturan per field untuk kasir),
  jurnal (nomor bukti otomatis, void owner), aset, pihak, event, akun, pengaturan, tutup buku
  (SSPD, 3 angka Parang-ops, tutup & buka kembali), 10 laporan, pengguna, audit log.
- Login: email + kata sandi + 2FA TOTP (owner/admin), nama + PIN 6 digit (kasir), kunci 15 menit setelah
  5 kali salah, cookie sesi `kpk_session`.
- `prisma/seed.ts`: impor data asli dari `prototype/data.js` (35 akun, 1.261 jurnal, 284 hari omzet,
  18 aset, SSPD Jan–Sep). Bon karyawan lama → pihak "Bon karyawan (data Excel)".
- Diuji end-to-end di PostgreSQL: laporan dari database cocok sampai rupiah dengan Excel.

### Frontend baru (`frontend/`) — React 18 + Vite + TypeScript + Tailwind
- Token desain sama dengan Parang-ops. Halaman: Login, Ringkasan, Omzet Harian (kalender), Omzet Hari Ini
  (kasir, HP), Jurnal, Laporan (Laba Rugi, Neraca, Arus Kas, Perubahan Ekuitas, Neraca Saldo, Buku Besar),
  Aset Tetap, Pihak, Tutup Buku, Akun & Pengaturan, Pengguna & Riwayat.
- Ekspor Excel/PDF dengan kop Kopi Parang di setiap laporan.

### Lain-lain
- Direktori `.agents/` baru: `business-logic.md`, `tech-stack-backend.md`, `tech-stack-frontend.md`.
- `README.md` dan `CLAUDE.md` diperbarui untuk stack baru. `prototype/` tetap disimpan sebagai acuan.

## 20 Oktober 2026 (siang): dipisahkan tegas dari Parang-ops

Keputusan owner: Kopi Parang Keuangan adalah aplikasi terpisah dari Parang-ops dan tidak terhubung ke Majoo.
Saran sebelumnya (membangun Keuangan sebagai modul di dalam Parang-ops) dibatalkan.

### Spesifikasi (`docs/SPESIFIKASI.md`)
- Bagian baru **Batas dengan Parang-ops**: siapa mencatat apa, 3 angka manual saat tutup buku, aturan anti-tabrakan
  (satu nota dua catatan, ejaan nama sama, pemisahan teknis, PIN terpisah, satu sumber per angka).
- Ringkasan: lingkup tegas tanpa koneksi ke Majoo maupun Parang-ops.
- Hak akses: PIN 6 digit untuk kasir, email + 2FA untuk owner/admin; baris baru untuk Pihak dan Tutup Buku.
- Modul baru: **Pihak** (karyawan & supplier) dan **Tutup Buku** (wizard).
- Model data: tabel baru `ops_monthly_figures`, `daily_staff_bons`; kolom baru `receipt_no`, `pin_hash`,
  `totp_secret`, toleransi cek di `settings`; `parties` tanpa ID bersama.
- Logika: jurnal otomatis ke-9 **penyesuaian persediaan** dari nilai stok Parang-ops; bagian 12 **Cek dengan
  Parang-ops** (selisih pembelian 5%, omzet 2%, tidak memblokir).
- Fase 4: "impor otomatis dari POS" dihapus; integrasi Majoo/Parang-ops tidak direncanakan.
- Pertanyaan terbuka: bon per karyawan sudah diputuskan; ditambah 3 pertanyaan baru.

### Prototipe
- Wizard Tutup Buku: langkah "Salin 3 angka dari Parang-ops", perbandingan selisih, jurnal penyesuaian
  persediaan di pratinjau, riwayat cek per bulan. Tutup buku hanya bisa jika nilai stok dan pembelian diisi.
- Layar PIN kasir (demo 123456).
- Jurnal: kolom nomor nota.
- Label omzet harian: "angka tutup kasir Majoo".

### Mesin hitung (`prototype/engine.js`)
- `st.ops[bulan]` → jurnal penyesuaian persediaan + `opsCheck`.
- Angka patokan Jan–Sep tidak berubah (diuji ulang di `scripts/check-patokan.js`).

### Skrip
- `check-patokan.js` sekarang juga menguji skenario tutup buku Oktober–November dengan angka Parang-ops.

## 20 Oktober 2026 (pagi): ekspor awal dari Claude
