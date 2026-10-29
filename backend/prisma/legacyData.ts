// Membaca data asli Excel v2 yang sudah diekstrak ke prototype/data.js
// (Jan – 11 Okt 2026) dan mengubahnya ke bentuk input mesin hitung.
// Dipakai oleh prisma/seed.ts dan scripts/check-patokan.ts.
//
// Catatan: skrip migrasi resmi Fase 2 harus membaca file Excel v2 langsung
// (docs/SPESIFIKASI.md bagian Migrasi). data.js adalah jembatan sementara.
import fs from "fs";
import path from "path";
import vm from "vm";
import type { EngineInput, AccountGroup, NormalSide, CashCategory } from "../src/engine/types";

/** Pihak pengganti untuk bon karyawan lama yang di Excel hanya total per hari. */
export const LEGACY_BON_PARTY = "Bon karyawan (data Excel)";

type RawAccount = [string, string, AccountGroup, NormalSide, CashCategory, string, number];
type RawDaily = [string, ...(number | null)[]];
type RawJournal = [string, string, string, string, number, string, string, string, string?];
type RawAsset = [string, string, number, number];

interface RawData {
  settings: { year: number; bln: number; rate: number; inkl: boolean; accr: boolean; target: number };
  accounts: RawAccount[];
  daily: RawDaily[];
  journal: RawJournal[];
  assets: RawAsset[];
  paid: Record<string, number>;
}

export function readRawData(): RawData {
  const file = path.resolve(__dirname, "../../prototype/data.js");
  const ctx: { window: { KP_DATA?: RawData } } = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx);
  if (!ctx.window.KP_DATA) throw new Error(`KP_DATA tidak ditemukan di ${file}`);
  return ctx.window.KP_DATA;
}

/** Omzet yang dilaporkan ke Bapenda Jan–Sep 2026 (sheet PAJAK kolom D); tidak ada di prototype/data.js. */
const LEGACY_REPORTED_REVENUE: Record<number, number> = {
  1: 20562000, 2: 16640000, 3: 23100000, 4: 20580000, 5: 22570000, 6: 22320000, 7: 20940000, 8: 19951000, 9: 20960000,
};

/** Rincian saldo awal piutang & utang per pihak (sheet AKUN, bagian bawah). Nama pihak persis seperti di Excel. */
export const LEGACY_OPENING_DETAILS: { account: string; party: string; amount: number }[] = [
  { account: "Piutang Usaha Cafe", party: "Yantos", amount: 4000000 },
  { account: "Piutang Usaha Cafe", party: "BRI Bisnis", amount: 500000 },
  { account: "Piutang Lainnya", party: "Piutang Pak Munir", amount: 3000000 },
  { account: "Utang Usaha Jangka Panjang", party: "FM WOOD Order", amount: 1420000 },
  { account: "Utang Usaha Jangka Panjang", party: "FM Wood Maintenance", amount: 1000000 },
  { account: "Utang Lainnya", party: "Utang Pak Munir", amount: 3567600 },
];

/** Kolom "Pos Laporan" dan "Keterangan" per akun (sheet AKUN); tidak ada di prototype/data.js. */
export const LEGACY_ACCOUNT_META: Record<string, { reportLine: string; description: string | null }> = {
  "1101": { reportLine: "Kas dan setara kas", description: "Kas besar / brankas" },
  "1102": { reportLine: "Kas dan setara kas", description: "Rekening bank usaha" },
  "1103": { reportLine: "Kas dan setara kas", description: "Kas kecil operasional" },
  "1201": { reportLine: "Piutang usaha", description: "Kliring omzet: omzet tercatat yang belum masuk kas (tunai H+1, settlement EDC)" },
  "1202": { reportLine: "Piutang usaha", description: "Piutang dari penjualan di luar cafe (event, B2B)" },
  "1203": { reportLine: "Piutang lain-lain", description: "Bon karyawan, pinjaman pihak lain" },
  "1301": { reportLine: "Persediaan", description: "Stok bahan baku (hasil stok opname akhir bulan)" },
  "1302": { reportLine: "Perlengkapan", description: "Perlengkapan belum terpakai" },
  "1303": { reportLine: "Beban dibayar di muka", description: "Sewa/langganan yang dibayar di depan" },
  "1501": { reportLine: "Peralatan (harga perolehan)", description: "Lihat sheet ASET TETAP" },
  "1502": { reportLine: "Akumulasi penyusutan", description: "Akun pengurang aset (kontra)" },
  "2101": { reportLine: "Utang usaha", description: "Utang ke pemasok / gaji yang belum dibayar" },
  "2102": { reportLine: "Utang pajak", description: "Estimasi PBJT kurang bayar (akun BARU)" },
  "2103": { reportLine: "Utang lain-lain", description: "Pinjaman pihak lain (Pak Munir)" },
  "2201": { reportLine: "Utang jangka panjang", description: "Cicilan FM Wood & grinder — cek jatuh tempo, bila < 12 bulan pindahkan ke jangka pendek" },
  "3101": { reportLine: "Modal pemilik", description: "Saldo awal = total aset − total liabilitas per 1 Jan" },
  "3102": { reportLine: "Prive", description: "Pengambilan pemilik (uang, barang, bill owner)" },
  "4101": { reportLine: "Pendapatan usaha", description: "Omzet bersih cafe" },
  "4102": { reportLine: "Pendapatan usaha", description: "Tiket event, sponsor, penjualan luar" },
  "4901": { reportLine: "Potongan pendapatan", description: "PBJT — disajikan sebagai pengurang pendapatan" },
  "5101": { reportLine: "Beban pokok penjualan", description: null },
  "5102": { reportLine: "Beban pokok penjualan", description: "Cup, kemasan, dll" },
  "6101": { reportLine: "Beban usaha", description: null },
  "6102": { reportLine: "Beban usaha", description: null },
  "6103": { reportLine: "Beban usaha", description: "Listrik, air, internet, langganan" },
  "6104": { reportLine: "Beban usaha", description: "Termasuk biaya event" },
  "6105": { reportLine: "Beban usaha", description: null },
  "6106": { reportLine: "Beban usaha", description: null },
  "6107": { reportLine: "Beban usaha", description: null },
  "6108": { reportLine: "Beban usaha", description: null },
  "6109": { reportLine: "Beban usaha", description: null },
  "6110": { reportLine: "Beban usaha", description: null },
  "6111": { reportLine: "Beban usaha", description: "Otomatis dari sheet ASET TETAP" },
  "7101": { reportLine: "Pendapatan lain-lain", description: "Bunga bank, lain-lain" },
  "7201": { reportLine: "Beban lain-lain", description: "Admin bank, denda, lain-lain" },
};

/** Kolom "Keterangan" sheet ANALISIS EVENT. */
export const LEGACY_EVENT_NOTES: Record<string, string> = {
  "Event Maharia": "Biaya talent, orkestra & sound besar; pemasukan tiket jauh di bawah biaya",
};

export function legacyEngineInput(): EngineInput {
  const D = readRawData();
  return {
    settings: {
      year: D.settings.year,
      closedMonth: D.settings.bln,
      pbjtRate: D.settings.rate,
      priceIncludesTax: D.settings.inkl,
      accruePbjt: D.settings.accr,
      cashDiffThreshold: 50000,
      opsPurchaseTolerancePct: 0.05,
      opsSalesTolerancePct: 0.02,
    },
    accounts: D.accounts.map((a) => ({
      code: a[0], name: a[1], group: a[2], normal: a[3], cashCategory: a[4],
      cashFlowLine: a[5] || null, openingBalance: a[6],
    })),
    daily: D.daily.map((r) => {
      const v = (i: number) => (r[i] as number | null) ?? null;
      const bon = v(6);
      return {
        date: r[0],
        cashPos: v(1), edcPos: v(2), cashShift1: v(3), cashShift2: v(4), edcSettled: v(5),
        compliment: v(7), ownerBill: v(8), itemsSold: v(9), transactions: v(10),
        bons: bon ? [{ party: LEGACY_BON_PARTY, amount: bon }] : [],
      };
    }),
    journal: D.journal.map((j) => ({
      voucherNo: j[0], date: j[1], debit: j[2], credit: j[3], amount: j[4],
      description: j[5], event: j[6] || "", party: j[7] || "", receiptNo: j[8] || "",
    })),
    assets: D.assets.map((a) => ({ name: a[0], acquiredOn: a[1], cost: a[2], usefulLifeYears: a[3] })),
    taxFilings: Object.fromEntries(
      Object.entries(D.paid).map(([m, paid]) => [Number(m), { pbjtPaid: paid, reportedRevenue: LEGACY_REPORTED_REVENUE[Number(m)] ?? null }]),
    ),
    ops: {},
  };
}
