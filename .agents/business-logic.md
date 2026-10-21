# Aturan Business Logic Kopi Parang Keuangan

Kopi Parang Keuangan adalah sistem **akuntansi** kedai Kopi Parang (Solo), pengganti file Excel
`KOPI_PARANG_LAPORAN_KEUANGAN_2026_v2.xlsx`. Fokusnya mencatat **uang**: omzet harian, setoran,
jurnal, aset tetap, pajak (PBJT), dan laporan keuangan. Agen AI yang mengerjakan fitur apa pun WAJIB
mematuhi aturan di file ini.

Sumber kebenaran: `docs/SPESIFIKASI.md`. Jika kode dan spesifikasi berbeda, ikuti spesifikasi (atau tanyakan
ke owner), lalu perbarui yang salah. Jika spesifikasi berbeda dengan rumus Excel v2, rumus Excel yang benar.

## 1. Berdiri sendiri: batas tegas dengan Parang-ops

Parang-ops mencatat **barang** (stok, pembelian, repack, prep, resep, HPP per menu, absensi). Aplikasi ini
mencatat **uang**. Keduanya **tidak boleh saling terhubung**.

* **DILARANG**: API call ke Parang-ops atau Majoo, import file Majoo, tabel/database bersama, SSO,
  sinkronisasi PIN, atau ID bersama.
* **DILARANG** menambah modul stok, resep, HPP per menu, atau absensi di sini. Sebaliknya, laba, kas, dan
  utang **hanya** dihitung di sini.
* Satu-satunya jembatan: **3 angka bulanan yang diketik manual** di wizard Tutup Buku
  (`ops_monthly_figures`): nilai stok akhir (wajib), total pembelian (wajib), total penjualan Majoo (opsional).
* Angka POS diambil dari **laporan tutup kasir Majoo** dan diketik kasir setiap hari.
* Nama karyawan & supplier di tabel `parties` berejaan **sama persis** dengan master Staff/Suppliers
  Parang-ops, tapi tanpa ID bersama.
* Terpisah teknis: database, user database, subdomain, nama cookie sesi (`kpk_session`), variabel
  environment (`KPK_*`), port dev (API 4100, UI 5174), dan backup sendiri.

## 2. Alur data: input → mesin hitung → laporan

Data hanya masuk lewat modul input; **semua laporan dihitung server** dari data tersebut, tidak pernah
disimpan sebagai angka jadi.

| Modul input | Tabel | Siapa |
| --- | --- | --- |
| Omzet Harian | `daily_sales`, `daily_staff_bons` | Kasir (hari ini + setoran shift), admin/owner |
| Jurnal (1 debet + 1 kredit) | `journal_entries` + `journal_lines` | Admin, owner |
| Aset Tetap | `fixed_assets` | Admin, owner |
| Pihak, Event | `parties`, `events` | Admin, owner |
| Daftar Akun, Pengaturan | `accounts`, `settings` | Owner (admin lihat) |
| Tutup Buku (SSPD + angka Parang-ops) | `tax_filings`, `ops_monthly_figures`, `period_closings` | Admin input, owner tutup/buka |

Mesin hitung ada di `backend/src/engine/engine.ts` (fungsi murni `compute(input)`), terjemahan 1:1 dari
rumus Excel v2. Laporan: Laba Rugi, Neraca, Arus Kas (metode langsung), Perubahan Ekuitas, Neraca Saldo,
Buku Besar, Rekap Omzet, Analisis Event, Pajak PBJT, Dashboard.

### Jurnal otomatis tidak pernah diinput manual

Jurnal `OTOMATIS`/`PENYESUAIAN` (omzet bulanan, realisasi kas/EDC, bon karyawan per orang, compliment,
bill owner, penyusutan, estimasi PBJT kurang bayar, penyesuaian persediaan) **selalu dibuat ulang mesin**
dari `daily_sales`, aset, `tax_filings`, dan `ops_monthly_figures`. Yang dimuat ke mesin hanya jurnal `UMUM`
yang belum dibatalkan. Saat tutup buku, jurnal sistem bulan itu dibekukan ke `journal_entries`
(voucher `AUTO-<closingId>-NN`) sebagai arsip; saat bulan dibuka kembali, arsip itu di-void.

## 3. Angka patokan — wajib tetap cocok sampai rupiah

Tutup buku September 2026 (data asli Jan–Sep):

| Angka | Rp |
| --- | --- |
| Pendapatan bersih Jan–Sep | 795.505.902 |
| Laba kotor Jan–Sep | 456.926.368 |
| Laba (rugi) bersih Jan–Sep | −54.996.702 |
| Laba (rugi) bersih Januari | −51.148.041 |
| Total aset / liabilitas / ekuitas 30 Sep | 101.739.014 / 74.619.781 / 27.119.233 |
| Kas tunai / bank / warung 30 Sep | 51.913.400 / −2.739.792 / 4.108.000 |
| Akumulasi penyusutan 30 Sep | 2.564.119 |
| Omzet bersih per hari buka | 3.179.317 |

Setiap perubahan di `backend/src/engine/` WAJIB diikuti `cd backend && npm run check:patokan` sampai
keluar "Semua angka cocok". Selisih 1 rupiah pun harus dicari penyebabnya (biasanya pembulatan).
4 cek kesehatan (neraca seimbang, neraca saldo seimbang, kas arus kas = kas neraca, ekuitas perubahan =
ekuitas neraca) harus selalu hijau.

## 4. Constraint data & proteksi sistem

* **Nominal = integer Rupiah** (`BigInt` di database, `number` di JSON/mesin). Tidak pernah float/Decimal
  untuk uang. Rasio/tarif (PBJT 10%, batas food cost, toleransi) boleh `Decimal`.
* **NULL ≠ 0** di omzet harian: kosong = belum direalisasi. Jangan ubah NULL jadi 0.
* **Bulan yang ditutup terkunci** (`month <= settings.closedMonth`): tidak boleh ada tambah/ubah/batal
  data bertanggal di bulan itu → HTTP 423. Hanya owner yang bisa membuka kembali, dan itu tercatat.
* `closedMonth` hanya berubah lewat wizard Tutup Buku / buka kembali — tidak lewat PUT `/settings`.
* **Soft delete saja** (`voided_at`) untuk jurnal & aset. Tidak ada hard delete data transaksi.
* Akun yang sudah dipakai tidak boleh dihapus, diganti kelompok, saldo normal, atau namanya — hanya
  dinonaktifkan (mesin merujuk akun inti berdasarkan nama, lihat `ACC` di `engine.ts`).
* Validasi jurnal: akun debet & kredit wajib dan tidak sama, nominal > 0, tanggal di tahun buku aktif
  dan bulan belum ditutup, keterangan wajib.
* Satu tanggal = satu baris `daily_sales`. Kasir tidak bisa mengubah tanggal yang sudah diverifikasi admin.
* **Jejak audit**: setiap tambah, ubah, batal, verifikasi, tutup, dan buka kembali menulis `audit_logs`
  (before/after). Tidak ada endpoint untuk menghapus audit log.
* Cek dengan Parang-ops (selisih pembelian > 5%, omzet > 2%) **tidak memblokir** tutup buku — hanya ditandai.
* Data gaji per karyawan **tidak** disimpan di aplikasi ini.

## 5. Hak akses (dicek di server, bukan hanya disembunyikan di UI)

| Modul | Owner | Admin | Kasir |
| --- | --- | --- | --- |
| Omzet harian | lihat, ubah | input, ubah, verifikasi | hari ini + setoran shift sendiri |
| Jurnal | input, ubah, **batal** | input, ubah | — |
| Aset tetap | input, ubah, batal | input, ubah | — |
| Pihak & event | ubah | input, ubah | — |
| Akun & pengaturan | ubah | lihat | — |
| Tutup buku | input, **tutup, buka kembali** | input SSPD & angka Parang-ops | — |
| Laporan & dashboard | lihat, ekspor | lihat, ekspor | — |
| Pengguna & audit log | kelola | — | — |

Login **sementara**: semua peran (owner, admin, kasir) pilih nama + PIN 6 digit (dikunci 15 menit
setelah 5 kali salah). Sesi berakhir setelah 12 jam tidak aktif (kasir 8 jam).
