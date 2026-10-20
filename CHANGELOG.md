# Perubahan

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
