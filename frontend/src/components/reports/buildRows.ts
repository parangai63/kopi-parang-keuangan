// Definisi baris tiap laporan keuangan (mengikuti susunan sheet Excel v2).
import type {
  BalanceSheet, BalanceSheetReport, CashFlowReport, EquityReport, EventResult, ProfitLoss, ProfitLossReport, SalesRecapReport,
  TaxMonth, TrialBalanceRow,
} from "../../types";
import { acct, num, tgl } from "../../utils/format";
import type { ReportRow } from "./ReportTable";

const OPEX_LABEL: Record<string, string> = {
  "Beban Gaji": "Gaji karyawan",
  "Biaya Sewa Tempat": "Sewa tempat",
  "Biaya Tagihan Bulanan": "Listrik, air, internet & langganan",
  "Biaya Marketing & Promosi": "Marketing, promosi & event",
  "Beban Perlengkapan": "Perlengkapan",
  "Biaya Operasional Harian": "Operasional harian",
  "Biaya Pemeliharaan": "Pemeliharaan",
  "Biaya Compliment": "Compliment",
  "Biaya R&D": "Riset & pengembangan menu",
  "Dana Sosial & CSR": "Dana sosial & CSR",
  "Beban Penyusutan Peralatan": "Penyusutan peralatan",
};

/** Kolom = tiap bulan ditutup + total. */
export function profitLossRows(r: ProfitLossReport): ReportRow[] {
  const cols: ProfitLoss[] = [...r.months, r.total];
  const v = (fn: (p: ProfitLoss) => number) => cols.map(fn);
  const ratio = (fn: (p: ProfitLoss) => number) => cols.map((p) => (p.netRevenue ? fn(p) / p.netRevenue : null));
  const gaji = (p: ProfitLoss) => p.opex["Beban Gaji"] ?? 0;
  const sewa = (p: ProfitLoss) => p.opex["Biaya Sewa Tempat"] ?? 0;
  return [
    { label: "Pendapatan usaha", style: "h" },
    { label: "Penjualan cafe", style: "ind", values: v((p) => p.cafeRevenue) },
    { label: "Pendapatan event & non-cafe", style: "ind", values: v((p) => p.nonCafeRevenue) },
    { label: "Pendapatan kotor", style: "sum", values: v((p) => p.grossRevenue) },
    { label: "Dikurangi: pajak restoran (PBJT)", style: "ind", values: v((p) => -p.restaurantTax) },
    { label: "Pendapatan bersih", style: "sum", values: v((p) => p.netRevenue) },
    { label: "Beban pokok penjualan", style: "h" },
    { label: "Bahan baku", style: "ind", values: v((p) => p.rawMaterial) },
    { label: "Penyajian & kemasan", style: "ind", values: v((p) => p.serving) },
    { label: "Total beban pokok penjualan", style: "sum", values: v((p) => p.cogs) },
    { label: "Laba kotor", style: "grand", values: v((p) => p.grossProfit) },
    { label: "Margin laba kotor", style: "ratio", format: "pct", values: ratio((p) => p.grossProfit) },
    { label: "Beban usaha", style: "h" },
    ...r.opexAccounts.map((a): ReportRow => ({ label: OPEX_LABEL[a.name] ?? a.name, style: "ind", values: v((p) => p.opex[a.name] ?? 0) })),
    { label: "Total beban usaha", style: "sum", values: v((p) => p.totalOpex) },
    { label: "Laba (rugi) usaha", style: "sum", values: v((p) => p.operatingProfit) },
    { label: "EBITDA", style: "ind", values: v((p) => p.ebitda) },
    { label: "Pendapatan (beban) lain-lain", style: "h" },
    { label: "Pendapatan lain-lain", style: "ind", values: v((p) => p.otherIncome) },
    { label: "Beban lain-lain", style: "ind", values: v((p) => -p.otherExpense) },
    { label: "Laba (rugi) bersih", style: "grand", values: v((p) => p.netProfit) },
    { label: "Margin laba bersih", style: "ratio", format: "pct", values: ratio((p) => p.netProfit) },
    { label: "Indikator biaya (terhadap pendapatan bersih)", style: "h" },
    { label: "Food cost (HPP)", style: "ratio", format: "pct", limit: r.limits.foodCost, values: ratio((p) => p.cogs) },
    { label: "Payroll (gaji)", style: "ratio", format: "pct", limit: r.limits.payroll, values: ratio(gaji) },
    { label: "Occupancy (sewa)", style: "ratio", format: "pct", limit: r.limits.occupancy, values: ratio(sewa) },
    { label: "Prime cost (HPP + gaji)", style: "ratio", format: "pct", limit: r.limits.primeCost, values: ratio((p) => p.cogs + gaji(p)) },
    { label: "Marketing & event", style: "ratio", format: "pct", values: ratio((p) => p.opex["Biaya Marketing & Promosi"] ?? 0) },
  ];
}

export function balanceSheetRows(r: BalanceSheetReport): ReportRow[] {
  const v = (k: keyof BalanceSheet) => [r.opening[k], r.closing[k]];
  return [
    { label: "Aset lancar", style: "h" },
    { label: "Kas tunai", style: "ind", values: v("cashOnHand") },
    { label: "Kas di bank", style: "ind", values: v("cashInBank") },
    { label: "Kas kecil (warung)", style: "ind", values: v("pettyCash") },
    { label: "Piutang usaha", style: "ind", values: v("receivables") },
    { label: "Piutang lain-lain", style: "ind", values: v("otherReceivables") },
    { label: "Persediaan bahan baku", style: "ind", values: v("inventory") },
    { label: "Perlengkapan", style: "ind", values: v("supplies") },
    { label: "Beban dibayar di muka", style: "ind", values: v("prepaid") },
    { label: "Total aset lancar", style: "sum", values: v("currentAssets") },
    { label: "Aset tidak lancar", style: "h" },
    { label: "Peralatan (harga perolehan)", style: "ind", values: v("equipment") },
    { label: "Akumulasi penyusutan", style: "ind", values: v("accumulatedDepreciation") },
    { label: "Total aset tidak lancar", style: "sum", values: v("nonCurrentAssets") },
    { label: "Total aset", style: "grand", values: v("totalAssets") },
    { label: "Liabilitas jangka pendek", style: "h" },
    { label: "Utang usaha", style: "ind", values: v("accountsPayable") },
    { label: "Utang pajak daerah (PBJT)", style: "ind", values: v("taxPayable") },
    { label: "Utang lain-lain", style: "ind", values: v("otherPayables") },
    { label: "Total liabilitas jangka pendek", style: "sum", values: v("currentLiabilities") },
    { label: "Liabilitas jangka panjang", style: "h" },
    { label: "Utang usaha jangka panjang", style: "ind", values: v("longTermPayables") },
    { label: "Total liabilitas", style: "sum", values: v("totalLiabilities") },
    { label: "Ekuitas", style: "h" },
    { label: "Modal pemilik", style: "ind", values: v("ownerCapital") },
    { label: "Prive (pengambilan pemilik)", style: "ind", values: v("prive") },
    { label: "Laba (rugi) tahun berjalan", style: "ind", values: v("currentYearProfit") },
    { label: "Total ekuitas", style: "sum", values: v("totalEquity") },
    { label: "Total liabilitas dan ekuitas", style: "grand", values: v("totalLiabilitiesEquity") },
    { label: "Cek keseimbangan (harus 0)", style: "ratio", values: v("balanceCheck") },
  ];
}

const withTotal = (xs: number[]) => [...xs, xs.reduce((s, x) => s + x, 0)];

export function cashFlowRows(r: CashFlowReport): ReportRow[] {
  const L = (k: string) => withTotal(r.lines[k] ?? []);
  const M = (fn: (m: CashFlowReport["months"][number]) => number) => withTotal(r.months.map(fn));
  const first = r.months[0];
  const last = r.months[r.months.length - 1];
  return [
    { label: "Arus kas dari aktivitas operasi", style: "h" },
    { label: "Penerimaan dari pelanggan", style: "ind", values: L("OP1") },
    { label: "Penerimaan (pembayaran) lain-lain bersih", style: "ind", values: L("OP2") },
    { label: "Pembayaran bahan baku & penyajian", style: "ind", values: L("OP3") },
    { label: "Pembayaran gaji", style: "ind", values: L("OP4") },
    { label: "Pembayaran sewa", style: "ind", values: L("OP5") },
    { label: "Pembayaran beban operasional lainnya", style: "ind", values: L("OP6") },
    { label: "Pembayaran pajak restoran (PBJT)", style: "ind", values: L("OP7") },
    { label: "Kas bersih dari aktivitas operasi", style: "sum", values: M((m) => m.operating) },
    { label: "Arus kas dari aktivitas investasi", style: "h" },
    { label: "Pembelian peralatan", style: "ind", values: L("IN1") },
    { label: "Kas bersih dari aktivitas investasi", style: "sum", values: M((m) => m.investing) },
    { label: "Arus kas dari aktivitas pendanaan", style: "h" },
    { label: "Pengambilan pemilik (prive)", style: "ind", values: L("FN1") },
    { label: "Setoran modal pemilik", style: "ind", values: L("FN2") },
    { label: "Penerimaan (pembayaran) utang", style: "ind", values: L("FN3") },
    { label: "Kas bersih dari aktivitas pendanaan", style: "sum", values: M((m) => m.financing) },
    { label: "Kenaikan (penurunan) kas bersih", style: "grand", values: M((m) => m.netChange) },
    { label: "Kas awal periode", style: "ind", values: [...r.months.map((m) => m.opening), first?.opening ?? 0] },
    { label: "Kas akhir periode", style: "sum", values: [...r.months.map((m) => m.closing), last?.closing ?? 0] },
  ];
}

export function equityRows(r: EquityReport): ReportRow[] {
  const M = (fn: (m: EquityReport["months"][number]) => number) => withTotal(r.months.map(fn));
  const first = r.months[0];
  const last = r.months[r.months.length - 1];
  return [
    { label: "Ekuitas awal", values: [...r.months.map((m) => m.opening), first?.opening ?? 0] },
    { label: "Setoran modal", style: "ind", values: M((m) => m.capitalContribution) },
    { label: "Laba (rugi) bersih", style: "ind", values: M((m) => m.netProfit) },
    { label: "Prive (pengambilan pemilik)", style: "ind", values: M((m) => m.prive) },
    { label: "Ekuitas akhir", style: "grand", values: [...r.months.map((m) => m.closing), last?.closing ?? 0] },
  ];
}

export function trialBalanceRows(rows: TrialBalanceRow[]): ReportRow[] {
  const td = rows.reduce((s, r) => s + r.debitBalance, 0);
  const tc = rows.reduce((s, r) => s + r.creditBalance, 0);
  return [
    ...rows.map((r): ReportRow => ({
      label: `${r.code} · ${r.name}`,
      values: [r.signedOpening, r.debitMutation, r.creditMutation, r.debitBalance || null, r.creditBalance || null],
    })),
    { label: "Total", style: "grand", values: [null, null, null, td, tc] },
  ];
}

/** Sheet REKAP OMZET: kolom = tiap bulan (termasuk bulan berjalan) + total. */
export function salesRecapRows(r: SalesRecapReport): ReportRow[] {
  const ms = r.months;
  const sum = (fn: (m: SalesRecapReport["months"][number]) => number) => withTotal(ms.map(fn));
  const net = ms.reduce((s, m) => s + m.netRevenue, 0);
  const days = ms.reduce((s, m) => s + m.openDays, 0);
  const trx = ms.reduce((s, m) => s + m.transactions, 0);
  const target = r.target * ms.length;
  return [
    { label: "Omzet tercatat (POS)", style: "sum", values: sum((m) => m.totalPos) },
    { label: "Tunai", style: "ind", values: sum((m) => m.cashPos) },
    { label: "EDC / QRIS", style: "ind", values: sum((m) => m.edcPos) },
    { label: "Realisasi masuk kas", values: sum((m) => m.realized) },
    { label: "Selisih tunai", values: sum((m) => m.cashDiff) },
    { label: "dijelaskan: bon karyawan", style: "ind", values: sum((m) => m.staffBon) },
    { label: "dijelaskan: compliment", style: "ind", values: sum((m) => m.compliment) },
    { label: "dijelaskan: bill owner", style: "ind", values: sum((m) => m.ownerBill) },
    { label: "Selisih tunai tak terjelaskan", values: sum((m) => m.unexplainedCash) },
    { label: "Selisih EDC (MDR / settlement)", values: sum((m) => m.edcDiff) },
    { label: "Omzet bersih", style: "grand", values: sum((m) => m.netRevenue) },
    { label: "Indikator penjualan", style: "h" },
    { label: "Hari buka", style: "ind", values: sum((m) => m.openDays) },
    { label: "Rata-rata omzet bersih / hari", style: "ind", values: [...ms.map((m) => m.avgPerDay), days ? net / days : null] },
    { label: "Jumlah transaksi", style: "ind", values: sum((m) => m.transactions) },
    { label: "Rata-rata nilai / transaksi (avg ticket)", style: "ind", values: [...ms.map((m) => m.avgTicket), trx ? net / trx : null] },
    { label: "Produk terjual", style: "ind", values: sum((m) => m.itemsSold) },
    { label: "Target omzet", style: "ind", values: [...ms.map(() => r.target), target] },
    { label: "Pencapaian target", style: "ratio", format: "pct", values: [...ms.map((m) => m.targetAchievement), target ? net / target : null] },
    { label: "Pertumbuhan vs bulan lalu", style: "ratio", format: "pct", values: [...ms.map((m) => m.growth), null] },
    { label: "Hari belum direalisasi / perlu dicek", style: "ind", values: sum((m) => m.notOkDays) },
  ];
}

/** Sheet PAJAK: kolom = tiap bulan ditutup + total. */
export function taxRows(ms: TaxMonth[]): ReportRow[] {
  const sum = (fn: (m: TaxMonth) => number | null) => withTotal(ms.map((m) => fn(m) ?? 0));
  const val = (fn: (m: TaxMonth) => number | null) => [...ms.map(fn), ms.reduce((s, m) => s + (fn(m) ?? 0), 0)];
  const recorded = ms.reduce((s, m) => s + m.recordedRevenue, 0);
  const reported = ms.reduce((s, m) => s + (m.reportedRevenue ?? 0), 0);
  return [
    { label: "Omzet tercatat (asli, POS)", values: sum((m) => m.recordedRevenue) },
    { label: "Omzet dilaporkan ke Bapenda", values: val((m) => m.reportedRevenue) },
    { label: "% dilaporkan", style: "ratio", format: "pct", values: [...ms.map((m) => m.reportedPct), recorded ? reported / recorded : null] },
    { label: "Selisih omzet tak dilaporkan", values: val((m) => m.revenueGap) },
    { label: "Perhitungan PBJT", style: "h" },
    { label: "DPP seharusnya", style: "ind", values: sum((m) => m.dpp) },
    { label: "PBJT terutang", style: "ind", values: sum((m) => m.pbjtDue) },
    { label: "PBJT dibayar (SSPD)", style: "ind", values: val((m) => m.pbjtPaid) },
    { label: "PBJT kurang bayar", style: "grand", values: sum((m) => m.underpaid) },
    { label: "Cek ke jurnal", style: "h" },
    { label: "Dibayar menurut jurnal", style: "ind", values: sum((m) => m.paidPerJournal) },
    {
      label: "Cocok dengan SSPD?", style: "ind",
      text: [...ms.map((m) => (m.pbjtPaid == null ? "SSPD kosong" : m.matchesJournal ? "✔" : "✖")), ms.every((m) => m.matchesJournal) ? "✔" : "✖"],
    },
  ];
}

/** Sheet ANALISIS EVENT: satu baris per tag event + total. Kolom campuran, jadi ditulis sebagai teks. */
export const EVENT_COLUMNS = ["Mulai", "Transaksi", "Pendapatan", "Biaya", "Laba (rugi)", "Biaya per Rp1"];

export function eventRows(events: EventResult[]): ReportRow[] {
  const rev = events.reduce((s, e) => s + e.revenue, 0);
  const cost = events.reduce((s, e) => s + e.cost, 0);
  const ratio = (x: number | null) => (x == null ? "–" : x.toFixed(2).replace(".", ","));
  return [
    ...events.map((e): ReportRow => ({
      label: e.name,
      text: [tgl(e.firstDate), num(e.count), num(e.revenue), num(e.cost), acct(e.profit), ratio(e.costPerRevenue)],
    })),
    {
      label: "Total event", style: "grand",
      text: ["", num(events.reduce((s, e) => s + e.count, 0)), num(rev), num(cost), acct(rev - cost), ratio(rev ? cost / rev : null)],
    },
  ];
}
