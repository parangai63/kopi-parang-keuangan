# Aturan Tech Stack & Pedoman Frontend (Frontend Guidelines)

File ini mengatur standardisasi pengembangan Frontend Kopi Parang Keuangan. Stack dan design token-nya
**sama dengan Parang-ops**, tetapi aplikasinya terpisah (repo, subdomain, sesi). Agen AI yang ditugaskan
di bagian UI/UX WAJIB mematuhi spesifikasi ini.

## 1. Teknologi Utama
*   **Framework**: React 18 dengan Vite sebagai *bundler* utama (dev di port **5174**, proxy `/api` → 4100).
*   **Bahasa Pemrograman**: TypeScript (`strict`, wajib mendeklarasikan tipe/interface untuk *props* dan *state*).
    Tipe data API ada di `src/types/index.ts` — samakan dengan response backend.
*   **Styling**: Tailwind CSS dan PostCSS. `tailwind.config.js` memakai token warna Parang (`parang.*`,
    `accent.*`, `status.*`) dan font Plus Jakarta Sans, sama dengan Parang-ops.
*   **Iconography**: Lucide React.
*   **Library Ekstra**: `xlsx` untuk ekspor Excel, `jspdf` + `jspdf-autotable` untuk ekspor PDF
    (dimuat lazily lewat `import()` di `ExportMenu`, supaya layar kasir di HP tetap ringan).

## 2. Struktur Komponen & UI
```
src/
  api/          client.ts (fetch + credentials + error), index.ts (endpoint per modul)
  context/      AuthContext (profil dari /auth/me), ToastContext
  components/   ui.tsx (Panel, PageHeader, Pill, Kpi, Loading, ErrorBox, Field…), MoneyInput,
                AccountSelect, BonEditor, DayForm, JournalForm, ExportMenu, MonthlyChart,
                reports/ (ReportTable + buildRows + GeneralLedger), closing/ (OpsHistory)
  pages/        satu file per menu: Dashboard, DailySales, Kasir, Journal, Reports, Assets,
                Parties, Closing, Settings, Users, Login
  types/        index.ts (data API), navigation.ts (menu + peran)
  utils/        format.ts (Rupiah, tanggal), calcDay.ts (pratinjau), useApi.ts, exportTable.ts
```
*   **Pendekatan Modular**: file `.tsx` maksimal ±300–400 baris. Pecah tabel, form, dan modal menjadi
    sub-komponen. Jangan definisikan komponen di dalam fungsi render (input akan kehilangan fokus).
*   **Manajemen State**: `useState`/`useReducer` untuk state lokal; data server lewat hook `useApi`
    (loading + error + reload). Tidak ada state global selain auth & toast.
*   **Navigasi**: menu per peran di `types/navigation.ts`. Menyembunyikan menu hanyalah kenyamanan —
    hak akses sebenarnya dicek server.

## 3. Aturan Angka & Bahasa
*   **Semua angka laporan berasal dari server** (mesin hitung). Frontend tidak boleh menghitung ulang
    laporan. Satu-satunya pengecualian: `utils/calcDay.ts` untuk pratinjau omzet harian saat mengetik,
    yang harus identik dengan `backend/src/engine/engine.ts → calcDay`.
*   **Format** lewat `utils/format.ts`: Rupiah tanpa desimal, pemisah ribuan titik (`num`, `rp`),
    negatif dalam kurung di laporan (`acct`), persen `pct`, tanggal Indonesia `tgl` ("12 Okt 2026").
*   **Input uang** selalu `MoneyInput`: kosong = `null` (belum diisi), berbeda dengan `0`.
*   **Bahasa UI: Indonesia**, singkat dan jelas. Pesan error dari server ditampilkan apa adanya.
*   Jangan menambah tampilan, tombol, atau teks yang menyiratkan koneksi otomatis ke Parang-ops/Majoo.
    Angka Parang-ops selalu "diketik manual".

## 4. Standar Styling (Tailwind CSS)
*   **Jangan buat CSS custom**: gunakan *utility classes* Tailwind di `className`. Kelas komponen yang
    boleh dipakai ulang hanya yang ada di `index.css` (`.input`, `.btn`, `.btn-ghost`, `.btn-danger`, `.tnum`).
*   **Angka tabular**: kolom angka memakai `tnum` + rata kanan.
*   **Responsif**: Halaman **Omzet Harian (kasir)** dan **Dashboard** wajib nyaman di HP lebar **360 px**.
    Halaman laporan cukup nyaman di laptop/tablet; tabel lebar dibungkus `overflow-x-auto`.
*   **Indikator Loading & Error**: setiap fetch WAJIB menampilkan `Loading` dan `ErrorBox` (dengan tombol
    coba lagi); setiap aksi simpan memberi umpan balik lewat `useToast()`.

## 5. Format Laporan (Export PDF & Excel)
*   Setiap tabel laporan WAJIB punya tombol `ExportMenu` (Excel + PDF).
*   Hasil ekspor wajib memuat **kop "KOPI PARANG", judul laporan, periode, dan tanggal cetak**
    (`utils/exportTable.ts`).
*   Untuk laporan keuangan, definisikan baris sekali di `components/reports/buildRows.ts` lalu pakai
    `ReportTable` (tampilan) dan `toExport` (ekspor) — jangan menulis susunan baris dua kali.
*   Ekspor daftar berhalaman (mis. Jurnal) harus mengambil **seluruh hasil filter**, bukan hanya halaman aktif.
