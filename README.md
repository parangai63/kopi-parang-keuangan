# Kopi Parang Keuangan

Spesifikasi dan prototipe web app akuntansi Kopi Parang, pengganti file Excel Laporan Keuangan 2026 v2.
Diekspor dari Claude pada 20 Oktober 2026.

**Aplikasi terpisah.** Tidak terhubung ke Majoo maupun Parang-ops. Parang-ops mengurus barang
(stok, resep, staf); aplikasi ini mengurus uang (omzet, jurnal, aset, pajak, laporan).
Tiga angka bulanan dari Parang-ops diketik manual saat tutup buku.

**Status: prototipe.** Belum ada database. Semua yang diinput di prototipe hilang saat halaman dimuat ulang.
Web app sungguhannya dibangun tim developer berdasarkan `docs/SPESIFIKASI.md`.

## Isi

| Path | Isi |
| --- | --- |
| `docs/SPESIFIKASI.md` | Spesifikasi lengkap: batas dengan Parang-ops, peran, modul, model data, rumus, migrasi, fase |
| `prototype/` | Prototipe yang bisa diklik, data asli Jan – 11 Okt 2026 |
| `prototype/engine.js` | Mesin hitung laporan (hasil sama persis dengan Excel) |
| `scripts/check-patokan.js` | Uji otomatis angka patokan + skenario angka Parang-ops |
| `original/` | File artifact asli satu halaman, untuk referensi |
| `CHANGELOG.md` | Perubahan dari ekspor sebelumnya |

## Jalankan prototipe

```bash
cd prototype
python3 -m http.server 8000
```

Buka http://localhost:8000. Ganti peran Owner / Admin / Kasir di kanan atas (PIN kasir demo: 123456).
Coba Tutup Buku Oktober: isi angka Parang-ops, lalu lihat jurnal penyesuaian persediaan dan riwayat cek.

## Cek angka

```bash
node scripts/check-patokan.js
```

Harus menampilkan "Semua angka cocok dengan Excel v2, dan skenario Parang-ops lolos". Skrip ini juga bisa
dipakai tim untuk membandingkan hasil web app baru.

## Penting

Repo ini berisi data keuangan asli Kopi Parang. Buat repository GitHub sebagai **Private**.

## Kerja dengan Claude Code

Buka folder ini di terminal lalu jalankan `claude`. Claude Code membaca `CLAUDE.md` untuk konteks proyek,
termasuk aturan agar aplikasi ini tidak bertabrakan dengan Parang-ops.
