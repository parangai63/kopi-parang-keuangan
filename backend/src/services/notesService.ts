// CALK — Catatan atas Laporan Keuangan (sheet CALK Excel v2). Teks per bagian disimpan di report_notes;
// {placeholder} di dalam teks diisi angka laporan saat dibaca, seperti rumus "Rp "&TEXT(NERACA!D7,...) di Excel.
import prisma from "../prismaClient";
import { SessionUser } from "../middleware/auth";
import { badRequest } from "../utils/httpError";
import { BULAN } from "../engine/engine";
import { computeLedger } from "./ledgerService";
import { logAudit } from "./auditService";

export interface NoteSection {
  title: string;
  body: string;
}

/** Template bawaan = teks sheet CALK Excel v2; angka diganti placeholder. Paragraf dipisah baris baru. */
export const DEFAULT_SECTIONS: NoteSection[] = [
  {
    title: "UMUM",
    body: "{usaha} adalah usaha cafe & kedai kopi yang juga menyelenggarakan event. Laporan ini disajikan dalam Rupiah penuh.",
  },
  {
    title: "DASAR PENYUSUNAN",
    body:
      "Laporan disusun dengan basis akrual dan biaya historis, mengacu pada SAK EMKM (Standar Akuntansi Keuangan Entitas Mikro, Kecil, dan Menengah). Laporan arus kas dan perubahan ekuitas disajikan sebagai informasi tambahan.\n" +
      "Periode yang dilaporkan dibatasi s.d. bulan tutup buku; bulan sesudahnya belum lengkap dan tidak disajikan.",
  },
  {
    title: "KEBIJAKAN AKUNTANSI PENTING",
    body:
      "a. Pendapatan cafe diakui sebesar omzet bersih harian (omzet POS dikurangi selisih tunai yang tak terjelaskan dan selisih EDC). Konsumsi pemilik (bill owner) diperlakukan sebagai prive.\n" +
      "b. Pajak restoran (PBJT) disajikan sebagai pengurang pendapatan. Estimasi kurang bayar diakui sebagai Utang Pajak Daerah bila diaktifkan di Pengaturan.\n" +
      "c. Persediaan: saat ini pembelian bahan baku langsung dibebankan. Mulai bulan berikutnya disarankan stok opname akhir bulan sehingga HPP = persediaan awal + pembelian − persediaan akhir.\n" +
      "d. Aset tetap dicatat sebesar harga perolehan dan disusutkan garis lurus mulai bulan setelah perolehan. Masa manfaat: 4 tahun (peralatan & perabot), 5 tahun (kulkas).",
  },
  {
    title: "KAS DAN SETARA KAS",
    body:
      "Saldo per tanggal laporan: Rp {kas_total} (tunai Rp {kas_tunai}, bank Rp {kas_bank}, kas kecil Rp {kas_kecil}). " +
      "Saldo kas tunai perlu didukung berita acara kas opname.{catatan_bank}",
  },
  {
    title: "PIUTANG",
    body:
      "Piutang usaha Rp {piutang_usaha} merupakan omzet yang belum diterima (setoran tunai H+1 / settlement EDC). " +
      "Piutang lain-lain Rp {piutang_lain} terdiri dari bon karyawan dan pinjaman pihak lain, termasuk pinjaman pemilik.",
  },
  {
    title: "ASET TETAP",
    body:
      "Harga perolehan Rp {aset_harga}, akumulasi penyusutan Rp {aset_akumulasi}. " +
      "Aset yang dimiliki sebelum {tahun} belum diinventarisasi sehingga belum tercermin di laporan ini.",
  },
  {
    title: "KEWAJIBAN PAJAK",
    body:
      "Omzet yang dilaporkan untuk PBJT lebih rendah dari omzet tercatat. Estimasi PBJT kurang bayar s.d. tanggal laporan Rp {pbjt_kurang_bayar} " +
      "(belum termasuk sanksi). Kewajiban PPh atas usaha belum dicatat dan sedang ditelaah.",
  },
  {
    title: "EKUITAS",
    body: "Modal pemilik awal tahun ditetapkan sebagai selisih aset dan liabilitas per 1 Januari. Prive s.d. tanggal laporan Rp {prive}.",
  },
  {
    title: "KEJADIAN PENTING",
    body: "{event_rugi_nama} ({event_rugi_bulan}) menghasilkan rugi Rp {event_rugi_nominal}, yang menjadi penyebab utama rugi kuartal I.",
  },
];

const rupiah = (n: number) => Math.round(n).toLocaleString("id-ID");

/** Angka yang bisa dipakai di teks CALK. Label tampil di layar edit sebagai daftar placeholder. */
async function noteVariables() {
  const { settings, result: R } = await computeLedger();
  const B = R.balanceSheet.closing;
  const BLN = R.closedMonth;
  const lastDay = BLN ? new Date(Date.UTC(R.year, BLN, 0)).getUTCDate() : 0;
  let pbjtUnderpaid = 0;
  for (let m = 1; m <= BLN; m++) pbjtUnderpaid += R.tax[m].underpaid;
  const worstEvent = R.events.filter((e) => e.profit < 0).sort((a, b) => a.profit - b.profit)[0];
  const vars: { key: string; label: string; value: string }[] = [
    { key: "usaha", label: "Nama usaha", value: settings.businessName },
    { key: "tahun", label: "Tahun buku", value: String(R.year) },
    { key: "periode", label: "Periode laporan", value: BLN ? `1 Januari – ${lastDay} ${BULAN[BLN - 1]} ${R.year}` : "–" },
    { key: "pendapatan_bersih", label: "Pendapatan bersih s.d. tutup buku", value: rupiah(R.profitLossTotal.netRevenue) },
    { key: "laba_bersih", label: "Laba (rugi) bersih s.d. tutup buku", value: rupiah(R.profitLossTotal.netProfit) },
    { key: "kas_total", label: "Total kas", value: rupiah(B.cashOnHand + B.cashInBank + B.pettyCash) },
    { key: "kas_tunai", label: "Kas tunai", value: rupiah(B.cashOnHand) },
    { key: "kas_bank", label: "Kas di bank", value: rupiah(B.cashInBank) },
    { key: "kas_kecil", label: "Kas kecil (warung)", value: rupiah(B.pettyCash) },
    {
      key: "catatan_bank", label: "Kalimat otomatis bila saldo bank negatif",
      value: B.cashInBank < 0 ? " Saldo bank menurut catatan negatif, sehingga wajib direkonsiliasi dengan rekening koran." : "",
    },
    { key: "piutang_usaha", label: "Piutang usaha", value: rupiah(B.receivables) },
    { key: "piutang_lain", label: "Piutang lain-lain", value: rupiah(B.otherReceivables) },
    { key: "aset_harga", label: "Harga perolehan aset tetap", value: rupiah(B.equipment) },
    { key: "aset_akumulasi", label: "Akumulasi penyusutan", value: rupiah(-B.accumulatedDepreciation) },
    { key: "aset_nilai_buku", label: "Nilai buku aset tetap", value: rupiah(B.nonCurrentAssets) },
    { key: "pbjt_kurang_bayar", label: "Estimasi PBJT kurang bayar s.d. tutup buku", value: rupiah(pbjtUnderpaid) },
    { key: "modal_awal", label: "Modal pemilik awal tahun", value: rupiah(B.ownerCapital) },
    { key: "prive", label: "Prive s.d. tutup buku", value: rupiah(-B.prive) },
    { key: "event_rugi_nama", label: "Event dengan rugi terbesar", value: worstEvent?.name ?? "–" },
    {
      key: "event_rugi_bulan", label: "Bulan event rugi terbesar",
      value: worstEvent ? BULAN[Number(worstEvent.firstDate.slice(5, 7)) - 1] : "–",
    },
    { key: "event_rugi_nominal", label: "Nominal rugi event terbesar", value: worstEvent ? rupiah(-worstEvent.profit) : "0" },
  ];
  return { year: R.year, closedMonth: BLN, vars };
}

export const renderNote = (body: string, values: Record<string, string>) =>
  body.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k] : m));

export async function getNotes() {
  const { year, closedMonth, vars } = await noteVariables();
  const rows = await prisma.reportNote.findMany({ where: { fiscalYear: year }, orderBy: { sortOrder: "asc" } });
  const sections: NoteSection[] = rows.length ? rows.map((r) => ({ title: r.title, body: r.body })) : DEFAULT_SECTIONS;
  const values = Object.fromEntries(vars.map((v) => [v.key, v.value]));
  return {
    year, closedMonth, isDefault: !rows.length, variables: vars,
    sections: sections.map((s) => ({ ...s, rendered: renderNote(s.body, values) })),
  };
}

/** Simpan seluruh bagian CALK tahun buku aktif (owner). Kirim `sections: null` untuk kembali ke template bawaan. */
export async function saveNotes(user: SessionUser, sections: NoteSection[] | null) {
  const { year } = await noteVariables();
  if (sections !== null) {
    if (!Array.isArray(sections) || !sections.length) throw badRequest("CALK minimal berisi satu bagian.");
    for (const s of sections) {
      if (!s?.title?.trim() || !s?.body?.trim()) throw badRequest("Judul dan isi setiap bagian CALK wajib diisi.");
    }
  }
  await prisma.$transaction(async (tx) => {
    const before = await tx.reportNote.findMany({ where: { fiscalYear: year }, orderBy: { sortOrder: "asc" } });
    await tx.reportNote.deleteMany({ where: { fiscalYear: year } });
    if (sections) {
      await tx.reportNote.createMany({
        data: sections.map((s, i) => ({ fiscalYear: year, sortOrder: i + 1, title: s.title.trim(), body: s.body.trim(), updatedById: user.id })),
      });
    }
    const after = await tx.reportNote.findMany({ where: { fiscalYear: year }, orderBy: { sortOrder: "asc" } });
    await logAudit(tx, { userId: user.id, tableName: "report_notes", recordId: String(year), action: "UPDATE", before, after });
  });
}
