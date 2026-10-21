# Perubahan

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
