# Aturan Tech Stack & Pedoman Frontend (Frontend Guidelines)

File ini mengatur standardisasi pengembangan Frontend Kopi Parang Keuangan. Stack-nya **sama dengan
Parang-ops**, tetapi aplikasinya terpisah (repo, subdomain, sesi). **Tampilan mengikuti rancangan original**
`original/kopi-parang-keuangan-artifact.html` (= `prototype/styles.css`), bukan design system Parang-ops
(keputusan owner, 21 Okt 2026). Agen AI yang ditugaskan
di bagian UI/UX WAJIB mematuhi spesifikasi ini.

## 1. Teknologi Utama
*   **Framework**: React 18 dengan Vite sebagai *bundler* utama (dev di port **5174**, proxy `/api` → 4100).
*   **Bahasa Pemrograman**: TypeScript (`strict`, wajib mendeklarasikan tipe/interface untuk *props* dan *state*).
    Tipe data API ada di `src/types/index.ts` — samakan dengan response backend.
*   **Styling**: CSS rancangan original di `src/index.css` (token di `:root`, mode gelap otomatis) + Tailwind
    untuk utility kecil. Aksen nila `--accent`, merek soga `--soga`, font Literata (judul) + IBM Plex Sans/Mono.
    `tailwind.config.js` memetakan warna ke variabel CSS yang sama (`ink`, `muted`, `accent`, `soga`, `good`,
    `warn`, `crit`, …) dan **preflight dimatikan**, jadi utility `border` butuh `border-solid`.
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

## 4. Standar Styling
*   **Pakai kelas rancangan original** dari `index.css`: `.top` (lewat `PageHeader`), `.panel`, `.kpis/.kpi`,
    `.two`, `.grid`, `.tw` + `table.t` (`.rep` untuk laporan: `tr.h/.sum/.grand/.ratio`, `td.ind/.r/.acc/.ket`),
    `.toolbar`, `form.f` + `fieldset` + `label.fld`, `.calc`, `.btn` / `.btn.ghost` / `.btn.danger`, `.pill`
    (`ok/wait/bad/auto/adj/tag`), `.months`, `.sumstrip`, `.cal/.day`, `.steps/.step`, `.kasir`, `.setor-row`.
    Kelas tambahan (di luar prototipe) ada di bagian bawah `index.css`. Jangan memasukkan design token Parang-ops.
*   **Warna** selalu lewat variabel CSS (`var(--crit)`, `.neg`, `.pos`), jangan hex, supaya mode gelap tetap benar.
*   **Angka tabular**: kolom angka memakai `td.r` (atau `input.money`) — sudah tabular + rata kanan.
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
