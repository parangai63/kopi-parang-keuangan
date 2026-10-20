// Uji angka patokan Excel v2 (tutup buku September 2026) terhadap mesin hitung TypeScript,
// plus skenario tutup buku Okt–Nov dengan angka Parang-ops. Padanan scripts/check-patokan.js
// di root repo (yang menguji prototype/engine.js).
// Jalankan: cd backend && npm run check:patokan
import { compute } from "../src/engine/engine";
import type { EngineInput } from "../src/engine/types";
import { legacyEngineInput } from "../prisma/legacyData";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
let fail = 0;
const check = (label: string, got: number, want: number) => {
  const ok = Math.round(got) === want;
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "BEDA"}  ${label.padEnd(46)} ${fmt(Math.round(got)).padStart(14)}${ok ? "" : `  (harusnya ${fmt(want)})`}`);
};
const flag = (label: string, ok: boolean) => {
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "BEDA"}  ${label}`);
};

console.log("== Angka patokan Excel v2 (tutup buku September 2026) ==");
const R = compute(legacyEngineInput());
const B = R.balanceSheet.closing;
check("Pendapatan bersih Jan–Sep", R.profitLossTotal.netRevenue, 795505902);
check("Laba kotor Jan–Sep", R.profitLossTotal.grossProfit, 456926368);
check("Laba (rugi) bersih Jan–Sep", R.profitLossTotal.netProfit, -54996702);
check("Laba (rugi) bersih Januari", R.profitLoss[1].netProfit, -51148041);
check("Total aset 30 Sep", B.totalAssets, 101739014);
check("Total liabilitas 30 Sep", B.totalLiabilities, 74619781);
check("Total ekuitas 30 Sep", B.totalEquity, 27119233);
check("Kas tunai 30 Sep", B.cashOnHand, 51913400);
check("Kas bank 30 Sep", B.cashInBank, -2739792);
check("Kas warung 30 Sep", B.pettyCash, 4108000);
check("Akumulasi penyusutan 30 Sep", -B.accumulatedDepreciation, 2564119);
check("Omzet bersih per hari buka", R.netRevenuePerOpenDay, 3179317);
for (const c of R.checks) flag(`Cek: ${c.label}`, c.ok);

console.log("\n== Skenario: tutup buku Oktober & November dengan angka Parang-ops ==");
// Angka contoh, bukan data asli Parang-ops.
const s: EngineInput = legacyEngineInput();
s.settings.closedMonth = 11;
s.ops = {
  10: { stockValue: 12500000, purchasesTotal: 17200000, salesTotal: 33100000 },
  11: { stockValue: 11000000, purchasesTotal: 1000, salesTotal: null },
};
const R2 = compute(s);
const inv = R2.autoJournal.filter((j) => j.isInventoryAdjustment);
check("Saldo Inventori 30 Nov = nilai stok Nov", R2.closingBalance["Inventori"], 11000000);
check("Penyesuaian Okt (Dr Inventori)", inv.find((j) => j.month === 10 && j.debit === "Inventori")?.amount ?? 0, 12500000);
check("Penyesuaian Nov (Cr Inventori)", inv.find((j) => j.month === 11 && j.credit === "Inventori")?.amount ?? 0, 1500000);
check("Laba bersih Jan–Sep tidak berubah", R2.profitLoss.slice(1, 10).reduce((a, p) => a + p.netProfit, 0), -54996702);
check("Pembelian bahan Okt menurut jurnal Keuangan", R2.opsCheck[10].financePurchases, 16798420);
flag("Tanda selisih pembelian: Okt dalam toleransi, Nov melewati", !R2.opsCheck[10].purchaseFlag && R2.opsCheck[11].purchaseFlag);
for (const c of R2.checks) flag(`Cek: ${c.label}`, c.ok);

console.log(fail ? `\n${fail} angka tidak cocok.` : "\nSemua angka cocok dengan Excel v2, dan skenario Parang-ops lolos.");
process.exit(fail ? 1 : 0);
