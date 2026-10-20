// Definisi baris tiap laporan keuangan (mengikuti susunan sheet Excel v2).
import type { BalanceSheet, BalanceSheetReport, CashFlowReport, EquityReport, ProfitLoss, ProfitLossReport, TrialBalanceRow } from "../../types";
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
