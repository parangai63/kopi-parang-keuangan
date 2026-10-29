# Kopi Parang Keuangan

Web app akuntansi Kopi Parang, pengganti file Excel Laporan Keuangan 2026 v2.

**Aplikasi terpisah.** Tidak terhubung ke Majoo maupun Parang-ops. Parang-ops mengurus barang
(stok, resep, staf); aplikasi ini mengurus uang (omzet, jurnal, aset, pajak, laporan).
Tiga angka bulanan dari Parang-ops diketik manual saat tutup buku.

**Stack sama dengan Parang-ops** (tapi project, database, dan sesi terpisah):

| | |
| --- | --- |
| Frontend | React 18 + TypeScript + Tailwind CSS (Vite), Lucide, xlsx, jsPDF |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL via Prisma ORM |

## Isi

| Path | Isi |
| --- | --- |
| `backend/` | API Express + Prisma. Mesin hitung di `src/engine/` (hasil sama persis dengan Excel) |
| `frontend/` | UI React + Tailwind |
| `.agents/` | Pedoman untuk agen AI: business logic, tech stack backend & frontend |
| `docs/SPESIFIKASI.md` | Spesifikasi lengkap (sumber kebenaran) |
| `prototype/` | Prototipe HTML lama + `data.js` (salinan data asli; `seed:legacy` kini membaca file Excel v2 langsung) |
| `scripts/check-patokan.js` | Uji angka patokan untuk mesin prototipe (`prototype/engine.js`) |
| `original/` | File artifact asli satu halaman, untuk referensi |

## Menjalankan (dev)

Butuh Node.js 20+ dan PostgreSQL. Buat database & user **khusus** aplikasi ini (bukan database Parang-ops).

```bash
# 1. Backend — http://localhost:4100
cd backend
cp .env.example .env          # cukup isi DATABASE_URL (variabel lain opsional)
npm install
npx prisma migrate deploy     # buat tabel
npm run seed                  # isi DATA DUMMY + 3 akun (owner, admin, kasir)
npm run dev

# 2. Frontend — http://localhost:5174 (proxy /api → 4100)
cd ../frontend
npm install
npm run dev
```

### Login & data dummy

Login sementara memakai **PIN 6 digit** untuk semua peran (tanpa pilih nama; PIN harus unik antar pengguna). `npm run seed` membuat data
dummy (fiktif, Jan s.d. kemarin, bulan sebelum bulan berjalan sudah ditutup) dan 3 akun:

| Nama | Peran | PIN |
| --- | --- | --- |
| Owner | Owner | 111111 |
| Admin Keuangan | Admin | 222222 |
| Kasir | Kasir | 333333 |

PIN ini hanya untuk mencoba aplikasi. **Ganti di menu Pengguna & Riwayat sebelum dipakai sungguhan.**
Isi ulang dari awal (menghapus SEMUA data): `SEED_RESET=1 npm run seed`.

Untuk memakai data keuangan asli dari Excel v2, jalankan `npm run seed:legacy` (PIN dibuat acak dan ditampilkan sekali)
— hanya di database yang aman untuk data asli.

Port 4100/5174 sengaja berbeda dari Parang-ops (4000/5173) supaya keduanya bisa jalan bersamaan.

## Cek angka

```bash
cd backend && npm run check:patokan
```

Harus menampilkan "Semua angka cocok dengan Excel v2, dan skenario Parang-ops lolos". Wajib dijalankan
setiap kali mengubah `backend/src/engine/`.

## Penting

Repo ini berisi data keuangan asli Kopi Parang. Buat repository GitHub sebagai **Private**.
Jangan commit file `.env`.

## Kerja dengan Claude Code / agen AI

Buka folder ini lalu jalankan `claude`. Konteks proyek ada di `CLAUDE.md`, pedoman detail di `.agents/`.
