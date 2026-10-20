# Kopi Parang Keuangan — konteks untuk Claude Code

Web app akuntansi Kopi Parang (kedai kopi, Solo), pengganti file Excel `KOPI_PARANG_LAPORAN_KEUANGAN_2026_v2.xlsx`.
Repo ini berisi **spesifikasi + prototipe**. Web app sungguhannya belum dibangun.

Sumber kebenaran: `docs/SPESIFIKASI.md`. Kalau kode dan spesifikasi berbeda, ikuti spesifikasi
(atau tanyakan ke owner), lalu perbarui yang salah.

## Aplikasi ini BERDIRI SENDIRI

Kopi Parang punya dua aplikasi internal yang **tidak boleh saling terhubung**:

| | Parang-ops (repo lain) | Kopi Parang Keuangan (repo ini) |
| --- | --- | --- |
| Mencatat | Barang: stok, pembelian, repack, prep, resep, HPP per menu, absensi, kebersihan | Uang: omzet harian, setoran, jurnal, aset tetap, pajak, laporan keuangan |
| Majoo | Import Excel "Laporan Penjualan Produk" | Tidak ada koneksi. Angka laporan tutup kasir Majoo diketik kasir |
| Login | PIN staf | Email + 2FA (owner/admin), PIN kasir sendiri |

Aturan wajib saat mengerjakan repo ini:

- **Jangan** menambah koneksi ke Majoo atau Parang-ops: tidak ada API call, import file Majoo,
  tabel bersama, database bersama, SSO, atau sinkronisasi PIN.
- **Jangan** menambah modul stok, resep, atau absensi di sini; itu tugas Parang-ops.
  Sebaliknya, laba/kas/utang hanya dihitung di sini.
- Satu-satunya jembatan: **3 angka bulanan dari Parang-ops yang diketik manual** di wizard Tutup Buku
  (`ops_monthly_figures`): nilai stok akhir (wajib), total pembelian (wajib), total penjualan Majoo (opsional).
- Teknis terpisah: database sendiri (usulan `kopiparang_keuangan`), user database sendiri, subdomain,
  nama cookie sesi, variabel environment, dan backup sendiri. Stack disarankan sama dengan Parang-ops
  (React 18 + TS + Tailwind/Vite, Express + TS, PostgreSQL via Prisma) supaya tim familiar.
- Nama karyawan dan supplier di tabel `parties` harus berejaan sama dengan master Parang-ops,
  tapi tanpa ID bersama.

Detail lengkap: bagian "Batas dengan Parang-ops" di `docs/SPESIFIKASI.md`.

## Struktur prototipe

```
prototype/
  index.html   kerangka; memuat data.js → engine.js → app.js (urutan penting)
  styles.css   gaya; token warna di :root, mode gelap
  data.js      window.KP_DATA = { settings, accounts[35], daily[365], journal[1261], assets[18], paid }
  engine.js    compute(state) → semua laporan; calcDay(row) → omzet harian. Ekspor CommonJS juga.
  app.js       UI: state in-memory, ganti peran owner/admin/kasir, PIN kasir, render per halaman
```

Bentuk baris di `data.js` (array, hemat ukuran):
- `accounts`: `[kode, nama, kelompok, normal D/K, kategori kas, baris arus kas, saldo awal]`
- `daily`: `[tanggal, tunaiPOS, edcPOS, setorShift1, setorShift2, edcSettle, bon, compliment, billOwner, produk, trx]`
  (null = belum diisi, beda dengan 0)
- `journal`: `[noBukti, tanggal, akunDebet, akunKredit, nominal, keterangan, tagEvent, pihak, noNota?]`
- `assets`: `[nama, tanggalPerolehan, harga, masaManfaatTahun]`

State tambahan di `app.js` (tidak ada di data.js, diisi lewat UI):
- `st.ops[bulan] = { stock, purch, sales }` → angka Parang-ops. `engine.js` membuat jurnal
  penyesuaian persediaan (Dr Inventori / Cr Biaya Bahan Baku, atau sebaliknya) hanya jika `stock` diisi,
  dan menghitung `opsCheck[bulan]` (selisih pembelian dan omzet vs toleransi `tolP` 5% / `tolS` 2%).
- `st.paid`, `st.reported` → data SSPD PBJT.

Penyederhanaan prototipe (spesifikasi tetap yang berlaku):
- Bon karyawan masih satu angka per hari; spesifikasi meminta per karyawan (`daily_staff_bons`).
- PIN kasir demo `123456`; tidak ada akun email/2FA.
- `TODAY` di app.js di-hardcode `2026-10-12` agar demo konsisten.
- Halaman Pajak sengaja **tidak** ada (berisi perbandingan omzet tercatat vs dilaporkan).
  Rumusnya di spesifikasi bagian Logika 9.

## Menjalankan

```
cd prototype && python3 -m http.server 8000      # buka http://localhost:8000
node scripts/check-patokan.js                     # dari root repo; harus "Semua angka cocok"
```

## Angka patokan (tutup buku September 2026)

Pendapatan bersih Jan–Sep 795.505.902 · Laba kotor 456.926.368 · Laba bersih −54.996.702 ·
Total aset 101.739.014 · Liabilitas 74.619.781 · Ekuitas 27.119.233 · Omzet bersih/hari buka 3.179.317.
Jan–Sep tidak punya angka Parang-ops, jadi penyesuaian persediaan tidak dibuat dan patokan ini tetap berlaku.
Implementasi baru apa pun harus menghasilkan angka yang sama.

## Aturan kerja

- Nominal selalu integer rupiah (BIGINT di database), bukan float.
- Jurnal OTOMATIS/PENYESUAIAN dibuat ulang oleh sistem dari `daily_sales`, aset, SSPD, dan
  `ops_monthly_figures`; jangan diimpor dari Excel.
- Hapus = soft delete (`voided_at`); bulan yang ditutup terkunci.
- Repo berisi data keuangan asli: harus **private**. Jangan commit kredensial atau file `.env`.
- Kalau mengubah `engine.js`, jalankan `node scripts/check-patokan.js` sebelum selesai.
