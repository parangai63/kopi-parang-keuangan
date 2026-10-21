# Aturan Tech Stack & Pedoman Backend (Backend Guidelines)

File ini mengatur standardisasi pengembangan Backend Kopi Parang Keuangan. Stack-nya **sama dengan
Parang-ops** supaya tim familiar, tetapi project, database, dan konfigurasinya **terpisah total**.
Agen AI yang ditugaskan di bagian Backend WAJIB mematuhi spesifikasi ini.

## 1. Teknologi Utama
*   **Runtime & Framework**: Node.js dengan framework Express.js.
*   **Bahasa Pemrograman**: TypeScript (`strict: true`, selalu gunakan *strict typing*).
*   **ORM**: Prisma (`@prisma/client` 5.x).
*   **Database**: PostgreSQL — database sendiri (mis. `kopiparang_keuangan`) dengan user database sendiri.
    User ini tidak boleh punya akses ke database Parang-ops, dan sebaliknya.
*   **Development Server**: `ts-node-dev` (`npm run dev`, port **4100**).
*   **Auth**: sementara semua peran login PIN 6 digit. `jsonwebtoken` (cookie httpOnly `kpk_session`),
    `bcryptjs` (PIN & password), `otplib` (2FA TOTP — kode login email + 2FA ada tapi belum dipakai UI).
*   **Deploy**: Vercel (`api/index.ts` + `vercel.json`), sama seperti Parang-ops, di subdomain sendiri.

## 2. Struktur Arsitektur & Folder
Arsitektur *Service-Oriented*: Route → Controller (tipis) → Service (business logic) → Engine (rumus murni).

```
backend/
  prisma/
    schema.prisma         model data (sumber: docs/SPESIFIKASI.md bagian Model data)
    migrations/           migrasi SQL — jangan edit migrasi yang sudah di-deploy
    seed.ts               data DUMMY + 3 akun PIN (diuji mesin sebelum ditulis); seed-legacy.ts = data asli
    seedShared.ts         wipe + pembuatan akun, dipakai kedua seed
    legacyData.ts         pembaca prototype/data.js → bentuk input mesin
  scripts/check-patokan.ts  uji angka patokan Excel v2 terhadap mesin TS
  src/
    engine/               MESIN HITUNG MURNI (tanpa Prisma/Express): engine.ts, types.ts
    services/             business logic + akses Prisma + audit log
    controllers/          parsing request → panggil service → JSON
    routes/index.ts       semua route + requireRole per peran
    middleware/auth.ts    sesi cookie, requireAuth, requireRole
    utils/                httpError, money (BigInt↔number), dates (ISO, WIB)
    app.ts / server.ts    konfigurasi Express / listener
```

*   `/src/engine`: **semua rumus akuntansi** (omzet harian, jurnal otomatis, laba rugi, neraca, arus kas,
    penyusutan, PBJT, cek Parang-ops). Fungsi murni: input objek → output objek. Tidak boleh import Prisma.
*   `/src/services`: validasi bisnis (bulan terkunci, hak per field kasir, nomor bukti), transaksi database,
    audit log. `ledgerService.loadEngineInput()` memuat data DB ke bentuk input mesin.
*   `/src/controllers` & `/src/routes`: hanya parsing parameter dan response. Jangan taruh business logic.

## 3. Aturan Pengkodean (Coding Rules)
*   **Uang = integer Rupiah.** Kolom nominal `BigInt` di Prisma. Konversi lewat `utils/money.ts`
    (`toNum`, `parseAmount`, `jsonSafe`); jangan `parseFloat` nominal. Validasi input: bilangan bulat ≥ 0.
    Rasio/tarif memakai `Decimal(6,4)`.
*   **Tanggal bisnis = string `YYYY-MM-DD`.** Kolom `@db.Date`; konversi lewat `utils/dates.ts`
    (`fromISODate`, `toISODate`). "Hari ini" memakai zona `Asia/Jakarta` (`todayJakarta()`).
*   **Transaksi Database (ACID)**: Setiap operasi yang menulis lebih dari satu tabel (jurnal + baris jurnal,
    omzet + bon karyawan, tutup buku + arsip jurnal + period_closings, dan audit log-nya) **WAJIB** memakai
    `prisma.$transaction`. Tutup buku/buka kembali memakai kunci optimistis pada `settings.closedMonth`.
*   **Kunci periode**: panggil `assertDateOpen` / `assertMonthOpen` (settingsService) sebelum menulis data
    bertanggal. Jangan duplikasi logika ini.
*   **Audit log**: setiap mutasi memanggil `logAudit(tx, …)` dengan before/after. Jangan pernah menambah
    endpoint hapus/ubah audit log.
*   **Penanganan Error**: lempar `HttpError` (`utils/httpError.ts`); `asyncHandler` meneruskan ke
    `errorMiddleware`. `400` validasi, `401` belum login, `403` tidak berhak, `404` tidak ada, `409` konflik
    unik, `423` bulan sudah ditutup / akun terkunci, `500` crash. Pesan error dalam **bahasa Indonesia**
    yang bisa langsung ditampilkan ke pengguna.
*   **Hak akses di server**: setiap route di `routes/index.ts` wajib `requireRole(...)`. Aturan per field
    (mis. kasir tidak boleh isi settlement EDC) ada di service.
*   **Mesin hitung**: setiap perubahan di `src/engine/` WAJIB lolos `npm run check:patokan`.
    Jika rumus berubah, perbarui juga `frontend/src/utils/calcDay.ts` (pratinjau omzet harian) dan
    `prototype/engine.js` bila prototipe masih dipakai sebagai acuan.

## 4. Prisma ORM
*   **Schema**: `prisma/schema.prisma`. Nama model PascalCase, tabel & kolom snake_case via `@@map`/`@map`
    (sesuai nama di spesifikasi).
*   **Migration**: `npx prisma migrate dev --name <nama_migrasi>` setelah mengubah skema; produksi memakai
    `npx prisma migrate deploy`.
*   **Jangan dump hasil query Prisma langsung ke response JSON**: BigInt tidak bisa diserialisasi dan
    relasi bocor. Selalu format dulu (lihat `serialize*` di service).
*   **Seed**: `npm run seed` (dummy) dan `npm run seed:legacy` (data asli) menolak berjalan jika database sudah
    berisi; `SEED_RESET=1` menghapus semua data dan hanya untuk dev/staging. Data asli tidak dipakai di laptop
    pengembang tanpa izin owner. Seed dummy menguji datanya dengan mesin hitung sebelum menulis ke database.
*   **RLS**: migrasi `enable_rls` mengaktifkan Row Level Security (tanpa policy) di semua tabel, supaya data
    tidak terbuka lewat API publik Supabase. Backend harus memakai role pemilik tabel (`postgres`);
    role lain tanpa BYPASSRLS akan melihat data kosong.
*   **Supabase**: pakai Session pooler (port 5432) di `DATABASE_URL` untuk app & migrasi. Transaction pooler
    (6543) butuh `?pgbouncer=true&connection_limit=1` dan tidak bisa untuk `migrate`.

## 5. Keamanan & Lingkungan
*   Jangan commit `.env` atau kredensial. Repo berisi data keuangan asli → repository **private**.
*   `.env` dibuat minimal: development cukup `DATABASE_URL`. Variabel lain opsional dan punya nilai bawaan
    (lihat `.env.example`). Jangan menambah variabel environment baru tanpa nilai bawaan yang aman.
*   Production wajib mengisi `KPK_SESSION_SECRET` (beda dengan secret Parang-ops); di development dibuat
    acak otomatis.
*   CORS hanya mengizinkan origin di `KPK_CORS_ORIGIN` (bawaan `http://localhost:5174`; cookie sesi memakai
    `credentials`).
*   Minimal dua lingkungan: staging dan produksi. Backup database harian, simpan ≥ 30 hari.
