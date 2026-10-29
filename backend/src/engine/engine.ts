// Mesin hitung Kopi Parang Keuangan — terjemahan rumus Excel v2.
// Port 1:1 dari prototype/engine.js; rumus resmi ada di docs/SPESIFIKASI.md
// bagian "Logika perhitungan". Kalau mengubah file ini, WAJIB jalankan
// `npm run check:patokan` (backend) sampai semua angka cocok.
import {
  AssetSchedule,
  BalanceSheet,
  CashFlowMonth,
  DayCalc,
  DayRow,
  DayStatus,
  EngineAccount,
  EngineDay,
  EngineInput,
  EngineResult,
  EquityMonth,
  EventResult,
  HealthCheck,
  LedgerEntry,
  MonthSales,
  OpsCheckMonth,
  ProfitLoss,
  TaxMonth,
  TrialBalanceRow,
} from "./types";

export const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Nama akun yang dipakai rumus. Harus ada di tabel accounts (lihat Lampiran spesifikasi).
export const ACC = {
  KAS_TUNAI: "Kas Tunai",
  KAS_BANK: "Kas Bank",
  KAS_WARUNG: "Kas Warung",
  PIUTANG_CAFE: "Piutang Usaha Cafe",
  PIUTANG_NON_CAFE: "Piutang Usaha non Cafe",
  PIUTANG_LAIN: "Piutang Lainnya",
  INVENTORI: "Inventori",
  PERLENGKAPAN: "Perlengkapan",
  DIBAYAR_DIMUKA: "Beban Dibayar di Muka",
  PERALATAN: "Peralatan",
  AKUM_PENYUSUTAN: "Akumulasi Penyusutan Peralatan",
  UTANG_USAHA: "Utang Usaha Lancar",
  UTANG_PBJT: "Utang Pajak Daerah (PBJT)",
  UTANG_LAIN: "Utang Lainnya",
  UTANG_JP: "Utang Usaha Jangka Panjang",
  EKUITAS: "Ekuitas Kopi Parang",
  PRIVE: "Prive",
  PENDAPATAN_CAFE: "Pendapatan Cafe",
  PENDAPATAN_NON_CAFE: "Pendapatan non Cafe",
  PAJAK_RESTORAN: "Pajak Restoran",
  BAHAN_BAKU: "Biaya Bahan Baku",
  PENYAJIAN: "Biaya Penyajian",
  GAJI: "Beban Gaji",
  SEWA: "Biaya Sewa Tempat",
  TAGIHAN: "Biaya Tagihan Bulanan",
  MARKETING: "Biaya Marketing & Promosi",
  COMPLIMENT: "Biaya Compliment",
  PENYUSUTAN: "Beban Penyusutan Peralatan",
  PENDAPATAN_LAIN: "Pendapatan Lainnya",
  BIAYA_LAIN: "Biaya Lainnya",
} as const;

export const CASH_FLOW_LINES = ["OP1", "OP2", "OP3", "OP4", "OP5", "OP6", "OP7", "IN1", "FN1", "FN2", "FN3"] as const;
const OPERATING_LINES = ["OP1", "OP2", "OP3", "OP4", "OP5", "OP6", "OP7"];

const N = (v: number | null | undefined): number => (typeof v === "number" && isFinite(v) ? v : 0);
const pad2 = (n: number) => String(n).padStart(2, "0");

export function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Spesifikasi Logika 1 — omzet harian per tanggal. */
export function calcDay(r: EngineDay, cashDiffThreshold = 50000): DayCalc {
  const staffBon = r.bons.reduce((s, b) => s + N(b.amount), 0);
  const totalPos = N(r.cashPos) + N(r.edcPos);
  const noShift = r.cashShift1 == null && r.cashShift2 == null;
  const cashDiff = noShift ? 0 : N(r.cashPos) - N(r.cashShift1) - N(r.cashShift2);
  const edcDiff = r.edcSettled == null ? 0 : N(r.edcPos) - N(r.edcSettled);
  const unexplainedCash = noShift ? 0 : cashDiff - staffBon - N(r.compliment) - N(r.ownerBill);
  const diffCost = edcDiff + unexplainedCash;
  const netRevenue = totalPos - diffCost;

  let status: DayStatus;
  if (totalPos === 0) status = "";
  else if (N(r.cashPos) > 0 && noShift) status = "Belum direalisasi";
  else if (N(r.edcPos) > 0 && r.edcSettled == null) status = "EDC belum settle";
  else if (Math.abs(unexplainedCash) > cashDiffThreshold) status = "Cek selisih tunai";
  else status = "OK";

  return {
    staffBon,
    totalPos,
    totalRealized: N(r.cashShift1) + N(r.cashShift2) + N(r.edcSettled),
    cashDiff,
    edcDiff,
    unexplainedCash,
    diffCost,
    netRevenue,
    status,
    avgTicket: N(r.transactions) ? netRevenue / N(r.transactions) : null,
  };
}

const emptyMonth = (): MonthSales => ({
  totalPos: 0, cashPos: 0, edcPos: 0, netRevenue: 0, realized: 0, cashDeposited: 0, edcSettled: 0,
  staffBon: 0, compliment: 0, ownerBill: 0, cashDiff: 0, unexplainedCash: 0, edcDiff: 0,
  itemsSold: 0, transactions: 0, openDays: 0, notOkDays: 0, bonByParty: {},
});

export function compute(input: EngineInput): EngineResult {
  const { settings } = input;
  const Y = settings.year;
  const BLN = settings.closedMonth;

  // ---------- akun & saldo awal ----------
  const acc: EngineAccount[] = input.accounts.map((a) => ({ ...a }));
  const A: Record<string, EngineAccount> = Object.fromEntries(acc.map((a) => [a.name, a]));
  for (const name of Object.values(ACC)) {
    if (!A[name]) throw new Error(`Akun wajib "${name}" tidak ditemukan di daftar akun.`);
  }
  // Saldo awal Ekuitas dihitung otomatis (Logika 3).
  A[ACC.EKUITAS].openingBalance =
    acc.filter((a) => a.group === "ASET" && a.normal === "D").reduce((s, a) => s + a.openingBalance, 0) -
    acc.filter((a) => a.group === "ASET" && a.normal === "K").reduce((s, a) => s + a.openingBalance, 0) -
    acc.filter((a) => a.group === "LIABILITAS").reduce((s, a) => s + a.openingBalance, 0);

  // ---------- omzet harian ----------
  const days: DayRow[] = input.daily
    .filter((r) => +r.date.slice(0, 4) === Y)
    .map((r) => ({ ...r, month: +r.date.slice(5, 7), calc: calcDay(r, settings.cashDiffThreshold) }));
  const months: MonthSales[] = Array.from({ length: 13 }, emptyMonth);
  for (const r of days) {
    const o = months[r.month];
    const x = r.calc;
    o.totalPos += x.totalPos;
    o.cashPos += N(r.cashPos);
    o.edcPos += N(r.edcPos);
    o.netRevenue += x.netRevenue;
    o.realized += x.totalRealized;
    o.cashDeposited += N(r.cashShift1) + N(r.cashShift2);
    o.edcSettled += N(r.edcSettled);
    o.staffBon += x.staffBon;
    o.compliment += N(r.compliment);
    o.ownerBill += N(r.ownerBill);
    o.cashDiff += x.cashDiff;
    o.unexplainedCash += x.unexplainedCash;
    o.edcDiff += x.edcDiff;
    o.itemsSold += N(r.itemsSold);
    o.transactions += N(r.transactions);
    for (const b of r.bons) o.bonByParty[b.party] = (o.bonByParty[b.party] ?? 0) + N(b.amount);
    if (x.totalPos > 0) {
      o.openDays++;
      if (x.status !== "OK") o.notOkDays++;
    }
  }

  // ---------- penyusutan (Logika 8) ----------
  const assets: AssetSchedule[] = input.assets.map((a) => {
    const [y, mo] = a.acquiredOn.split("-").map(Number);
    const sy = mo === 12 ? y + 1 : y;
    const sm = mo === 12 ? 1 : mo + 1;
    const perMonth = Math.round(a.cost / (a.usefulLifeYears * 12));
    const schedule = [0];
    for (let m = 1; m <= 12; m++) {
      const idx = (Y - sy) * 12 + (m - sm);
      schedule.push(m <= BLN && idx >= 0 && idx < a.usefulLifeYears * 12 ? perMonth : 0);
    }
    const accumulated = schedule.reduce((s, v) => s + v, 0);
    return {
      id: a.id, name: a.name, acquiredOn: a.acquiredOn, cost: a.cost, usefulLifeYears: a.usefulLifeYears,
      perMonth, depreciationStart: `${sy}-${pad2(sm)}-01`, schedule, accumulated, bookValue: a.cost - accumulated,
    };
  });
  const depreciation = (m: number) => assets.reduce((s, a) => s + a.schedule[m], 0);

  // ---------- PBJT (Logika 9) ----------
  const pbjt = (m: number) => {
    const om = months[m].totalPos;
    const dpp = settings.priceIncludesTax ? om / (1 + settings.pbjtRate) : om;
    const due = Math.round(dpp * settings.pbjtRate);
    const paid = input.taxFilings[m]?.pbjtPaid ?? null;
    return { om, dpp, due, paid, underpaid: due - N(paid) };
  };

  // ---------- jurnal otomatis (Logika 2) ----------
  const auto: LedgerEntry[] = [];
  for (let m = 1; m <= BLN; m++) {
    const d = lastDayOfMonth(Y, m);
    const o = months[m];
    const nm = BULAN[m - 1];
    const ym = `${Y}-${pad2(m)}`;
    let seq = 0;
    const push = (
      debit: string, credit: string, amount: number, description: string,
      sourceType: string, sourceRef: string, kind: "OTOMATIS" | "PENYESUAIAN" = "OTOMATIS", party = "",
    ) => {
      if (!amount) return;
      seq++;
      auto.push({
        voucherNo: `AUTO-${ym}-${pad2(seq)}`, date: d, month: m, year: Y, debit, credit, amount, description,
        event: "", party, receiptNo: "", kind, sourceType, sourceRef,
      });
    };
    push(ACC.PIUTANG_CAFE, ACC.PENDAPATAN_CAFE, o.netRevenue, `Omzet bersih bulan ${nm} (dari Omzet Harian)`, "daily_sales", `${ym}:revenue`);
    push(ACC.KAS_TUNAI, ACC.PIUTANG_CAFE, o.cashDeposited, `Realisasi tunai omzet bulan ${nm}`, "daily_sales", `${ym}:cash`);
    push(ACC.KAS_BANK, ACC.PIUTANG_CAFE, o.edcSettled, `Realisasi EDC/QRIS omzet bulan ${nm}`, "daily_sales", `${ym}:edc`);
    // Jurnal 4: satu jurnal per karyawan (party).
    for (const party of Object.keys(o.bonByParty).sort()) {
      push(ACC.PIUTANG_LAIN, ACC.PIUTANG_CAFE, o.bonByParty[party], `Bon karyawan bulan ${nm} · ${party}`, "daily_sales", `${ym}:bon:${party}`, "OTOMATIS", party);
    }
    push(ACC.COMPLIMENT, ACC.PIUTANG_CAFE, o.compliment, `Compliment bulan ${nm}`, "daily_sales", `${ym}:compliment`);
    push(ACC.PRIVE, ACC.PIUTANG_CAFE, o.ownerBill, `Bill owner bulan ${nm}`, "daily_sales", `${ym}:owner_bill`, "OTOMATIS", "Bill Owner");
    push(ACC.PENYUSUTAN, ACC.AKUM_PENYUSUTAN, depreciation(m), `Penyusutan peralatan bulan ${nm}`, "depreciation", ym);
    if (settings.accruePbjt) {
      push(ACC.PAJAK_RESTORAN, ACC.UTANG_PBJT, Math.max(0, pbjt(m).underpaid), `Estimasi PBJT kurang bayar bulan ${nm}`, "pbjt", ym, "PENYESUAIAN");
    }
  }

  const manual: LedgerEntry[] = input.journal.map((j) => ({
    id: j.id, voucherNo: j.voucherNo, date: j.date, month: +j.date.slice(5, 7), year: +j.date.slice(0, 4),
    debit: j.debit, credit: j.credit, amount: j.amount, description: j.description,
    event: j.event, party: j.party, receiptNo: j.receiptNo, kind: "UMUM",
  }));

  // Jurnal 9: penyesuaian persediaan dari nilai stok akhir Parang-ops. Hanya untuk bulan yang
  // punya stockValue; Jan–Sep 2026 tidak punya, jadi angka patokan tetap.
  const invBase = Array(13).fill(0);
  for (const j of manual.concat(auto)) {
    if (j.year !== Y) continue;
    if (j.debit === ACC.INVENTORI) invBase[j.month] += j.amount;
    if (j.credit === ACC.INVENTORI) invBase[j.month] -= j.amount;
  }
  let invRun = A[ACC.INVENTORI].openingBalance;
  for (let m = 1; m <= BLN; m++) {
    invRun += invBase[m];
    const sv = input.ops[m]?.stockValue;
    if (sv == null) continue;
    const adj = Math.round(sv - invRun);
    if (adj) {
      const ym = `${Y}-${pad2(m)}`;
      auto.push({
        voucherNo: `AUTO-${ym}-INV`, date: lastDayOfMonth(Y, m), month: m, year: Y,
        debit: adj > 0 ? ACC.INVENTORI : ACC.BAHAN_BAKU, credit: adj > 0 ? ACC.BAHAN_BAKU : ACC.INVENTORI,
        amount: Math.abs(adj),
        description: `Penyesuaian persediaan bulan ${BULAN[m - 1]} (nilai stok Parang-ops ${sv.toLocaleString("id-ID")})`,
        event: "", party: "", receiptNo: "", kind: "PENYESUAIAN", sourceType: "inventory", sourceRef: ym,
        isInventoryAdjustment: true,
      });
      invRun += adj;
    }
  }
  const all = manual.concat(auto).filter((j) => j.year === Y);

  // ---------- mutasi & saldo (Logika 3) ----------
  const mutations: Record<string, number[]> = Object.fromEntries(acc.map((a) => [a.name, Array(13).fill(0)]));
  for (const j of all) {
    if (!mutations[j.debit] || !mutations[j.credit]) {
      throw new Error(`Jurnal ${j.voucherNo} memakai akun yang tidak dikenal.`);
    }
    mutations[j.debit][j.month] += j.amount;
    mutations[j.credit][j.month] -= j.amount;
  }
  const sob = (n: string) => (A[n].normal === "D" ? A[n].openingBalance : -A[n].openingBalance);
  const upto = (n: string, M = BLN) => mutations[n].slice(1, M + 1).reduce((s, v) => s + v, 0);
  const end = (n: string) => sob(n) + upto(n);
  const signedOpening = Object.fromEntries(acc.map((a) => [a.name, sob(a.name)]));
  const closingBalance = Object.fromEntries(acc.map((a) => [a.name, end(a.name)]));

  // ---------- laba rugi (Logika 4) ----------
  const opexAccounts = acc.filter((a) => a.code.startsWith("61"));
  const emptyPL = (): ProfitLoss => ({
    cafeRevenue: 0, nonCafeRevenue: 0, grossRevenue: 0, restaurantTax: 0, netRevenue: 0, rawMaterial: 0,
    serving: 0, cogs: 0, grossProfit: 0, opex: {}, totalOpex: 0, operatingProfit: 0, ebitda: 0,
    otherIncome: 0, otherExpense: 0, otherNet: 0, netProfit: 0,
  });
  const profitLoss: ProfitLoss[] = [emptyPL()];
  for (let m = 1; m <= 12; m++) {
    const g = (n: string) => mutations[n][m];
    const cafeRevenue = -g(ACC.PENDAPATAN_CAFE);
    const nonCafeRevenue = -g(ACC.PENDAPATAN_NON_CAFE);
    const grossRevenue = cafeRevenue + nonCafeRevenue;
    const restaurantTax = g(ACC.PAJAK_RESTORAN);
    const netRevenue = grossRevenue - restaurantTax;
    const rawMaterial = g(ACC.BAHAN_BAKU);
    const serving = g(ACC.PENYAJIAN);
    const cogs = rawMaterial + serving;
    const grossProfit = netRevenue - cogs;
    const opex: Record<string, number> = {};
    for (const a of opexAccounts) opex[a.name] = g(a.name);
    const totalOpex = Object.values(opex).reduce((s, v) => s + v, 0);
    const operatingProfit = grossProfit - totalOpex;
    const ebitda = operatingProfit + (opex[ACC.PENYUSUTAN] ?? 0);
    const otherIncome = -g(ACC.PENDAPATAN_LAIN);
    const otherExpense = g(ACC.BIAYA_LAIN);
    const otherNet = otherIncome - otherExpense;
    const netProfit = operatingProfit + otherNet;
    profitLoss.push({
      cafeRevenue, nonCafeRevenue, grossRevenue, restaurantTax, netRevenue, rawMaterial, serving, cogs,
      grossProfit, opex, totalOpex, operatingProfit, ebitda, otherIncome, otherExpense, otherNet, netProfit,
    });
  }
  const closedPL = profitLoss.slice(1, BLN + 1);
  const profitLossTotal = emptyPL();
  for (const p of closedPL) {
    for (const k of Object.keys(p) as (keyof ProfitLoss)[]) {
      if (k === "opex") continue;
      (profitLossTotal[k] as number) += p[k] as number;
    }
  }
  for (const a of opexAccounts) profitLossTotal.opex[a.name] = closedPL.reduce((s, p) => s + p.opex[a.name], 0);

  // ---------- neraca (Logika 5) ----------
  const balanceSheet = (open: boolean): BalanceSheet => {
    const b = (n: string) => (open ? sob(n) : end(n));
    const cashOnHand = b(ACC.KAS_TUNAI);
    const cashInBank = b(ACC.KAS_BANK);
    const pettyCash = b(ACC.KAS_WARUNG);
    const receivables = b(ACC.PIUTANG_CAFE) + b(ACC.PIUTANG_NON_CAFE);
    const otherReceivables = b(ACC.PIUTANG_LAIN);
    const inventory = b(ACC.INVENTORI);
    const supplies = b(ACC.PERLENGKAPAN);
    const prepaid = b(ACC.DIBAYAR_DIMUKA);
    const equipment = b(ACC.PERALATAN);
    const accumulatedDepreciation = b(ACC.AKUM_PENYUSUTAN);
    const currentAssets = cashOnHand + cashInBank + pettyCash + receivables + otherReceivables + inventory + supplies + prepaid;
    const nonCurrentAssets = equipment + accumulatedDepreciation;
    const totalAssets = currentAssets + nonCurrentAssets;
    const accountsPayable = -b(ACC.UTANG_USAHA);
    const taxPayable = -b(ACC.UTANG_PBJT);
    const otherPayables = -b(ACC.UTANG_LAIN);
    const currentLiabilities = accountsPayable + taxPayable + otherPayables;
    const longTermPayables = -b(ACC.UTANG_JP);
    const totalLiabilities = currentLiabilities + longTermPayables;
    const ownerCapital = -b(ACC.EKUITAS);
    const prive = -b(ACC.PRIVE);
    const currentYearProfit = open
      ? 0
      : -acc.filter((a) => a.group === "PENDAPATAN" || a.group === "BEBAN").reduce((s, a) => s + upto(a.name), 0);
    const totalEquity = ownerCapital + prive + currentYearProfit;
    const totalLiabilitiesEquity = totalLiabilities + totalEquity;
    return {
      cashOnHand, cashInBank, pettyCash, receivables, otherReceivables, inventory, supplies, prepaid, currentAssets,
      equipment, accumulatedDepreciation, nonCurrentAssets, totalAssets, accountsPayable, taxPayable, otherPayables,
      currentLiabilities, longTermPayables, totalLiabilities, ownerCapital, prive, currentYearProfit, totalEquity,
      totalLiabilitiesEquity, balanceCheck: Math.round(totalAssets - totalLiabilitiesEquity),
    };
  };
  const neraca = { opening: balanceSheet(true), closing: balanceSheet(false) };

  // ---------- arus kas, metode langsung (Logika 6) ----------
  // Efek kas per jurnal: hanya jurnal yang TEPAT SATU sisinya akun KAS.
  const cashEffect = (j: LedgerEntry): { effect: number; counter: string } | null => {
    const kd = A[j.debit].cashCategory === "KAS";
    const kk = A[j.credit].cashCategory === "KAS";
    if (kd === kk) return null;
    return { effect: kd ? j.amount : -j.amount, counter: kd ? j.credit : j.debit };
  };
  const cashFlowLines: Record<string, number[]> = Object.fromEntries(CASH_FLOW_LINES.map((l) => [l, Array(13).fill(0)]));
  const taxPaidPerJournal = Array(13).fill(0);
  for (const j of all) {
    const ce = cashEffect(j);
    if (!ce) continue;
    if (ce.counter === ACC.PAJAK_RESTORAN) taxPaidPerJournal[j.month] -= ce.effect;
    if (j.month > BLN) continue;
    const line = A[ce.counter].cashFlowLine;
    if (line && cashFlowLines[line]) cashFlowLines[line][j.month] += ce.effect;
  }
  const cashAccounts = acc.filter((a) => a.cashCategory === "KAS").map((a) => a.name);
  const cashOpening = cashAccounts.reduce((s, n) => s + sob(n), 0);
  const cashFlow: CashFlowMonth[] = [{ operating: 0, investing: 0, financing: 0, netChange: 0, opening: 0, closing: 0 }];
  let run = cashOpening;
  for (let m = 1; m <= BLN; m++) {
    const g = (l: string) => cashFlowLines[l][m];
    const operating = OPERATING_LINES.reduce((s, l) => s + g(l), 0);
    const investing = g("IN1");
    const financing = g("FN1") + g("FN2") + g("FN3");
    const opening = run;
    const netChange = operating + investing + financing;
    run = opening + netChange;
    cashFlow.push({ operating, investing, financing, netChange, opening, closing: run });
  }
  const cashLedgerTotal = cashAccounts.reduce((s, n) => s + end(n), 0);

  // ---------- perubahan ekuitas (Logika 7) ----------
  const equity: EquityMonth[] = [{ opening: 0, capitalContribution: 0, netProfit: 0, prive: 0, closing: 0 }];
  let eq = -(sob(ACC.EKUITAS) + sob(ACC.PRIVE));
  for (let m = 1; m <= BLN; m++) {
    const capitalContribution = -mutations[ACC.EKUITAS][m];
    const prive = -mutations[ACC.PRIVE][m];
    const netProfit = profitLoss[m].netProfit;
    const closing = eq + capitalContribution + netProfit + prive;
    equity.push({ opening: eq, capitalContribution, netProfit, prive, closing });
    eq = closing;
  }

  // ---------- neraca saldo ----------
  const debitMut: Record<string, number> = Object.fromEntries(acc.map((a) => [a.name, 0]));
  const creditMut: Record<string, number> = Object.fromEntries(acc.map((a) => [a.name, 0]));
  for (const j of all) {
    if (j.month > BLN) continue;
    debitMut[j.debit] += j.amount;
    creditMut[j.credit] += j.amount;
  }
  const trialBalance: TrialBalanceRow[] = acc.map((a) => {
    const closing = end(a.name);
    return {
      ...a, signedOpening: sob(a.name), debitMutation: debitMut[a.name], creditMutation: creditMut[a.name],
      closing, debitBalance: Math.max(closing, 0), creditBalance: Math.max(-closing, 0),
    };
  });
  const tbDiff = Math.round(trialBalance.reduce((s, r) => s + r.debitBalance - r.creditBalance, 0));

  // ---------- analisis event (Logika 10) ----------
  const tags = [...new Set(manual.map((j) => j.event).filter(Boolean))];
  const events: EventResult[] = tags
    .map((t) => {
      const js = manual.filter((j) => j.event === t);
      const revenue = js.filter((j) => A[j.credit].group === "PENDAPATAN").reduce((s, j) => s + j.amount, 0);
      const cost = js.filter((j) => A[j.debit].group === "BEBAN").reduce((s, j) => s + j.amount, 0);
      return {
        name: t, firstDate: js.map((j) => j.date).sort()[0], revenue, cost, profit: revenue - cost,
        costPerRevenue: revenue ? cost / revenue : null, count: js.length,
      };
    })
    .sort((a, b) => a.firstDate.localeCompare(b.firstDate));

  // ---------- pajak PBJT (Logika 9) ----------
  const tax: TaxMonth[] = [];
  for (let m = 0; m <= 12; m++) {
    const p = pbjt(m);
    const reported = input.taxFilings[m]?.reportedRevenue ?? null;
    tax.push({
      month: m, recordedRevenue: p.om, dpp: p.dpp, pbjtDue: p.due, pbjtPaid: p.paid, underpaid: p.underpaid,
      reportedRevenue: reported, reportedPct: reported != null && p.om ? reported / p.om : null,
      revenueGap: reported != null ? p.om - reported : null, paidPerJournal: taxPaidPerJournal[m],
      matchesJournal: p.paid != null && p.paid === taxPaidPerJournal[m],
    });
  }

  // ---------- cek dengan Parang-ops (Logika 12) — tidak memblokir tutup buku ----------
  const tolP = settings.opsPurchaseTolerancePct;
  const tolS = settings.opsSalesTolerancePct;
  const opsCheck: OpsCheckMonth[] = [];
  for (let m = 0; m <= 12; m++) {
    const o = input.ops[m];
    const financePurchases = manual
      .filter((j) => j.year === Y && j.month === m && (j.debit === ACC.BAHAN_BAKU || j.debit === ACC.PENYAJIAN))
      .reduce((s, j) => s + j.amount, 0);
    const recordedRevenue = months[m].totalPos;
    const purchaseDiff = o?.purchasesTotal == null ? null : o.purchasesTotal - financePurchases;
    const salesDiff = o?.salesTotal == null ? null : o.salesTotal - recordedRevenue;
    opsCheck.push({
      month: m, stockValue: o?.stockValue ?? null, purchasesTotal: o?.purchasesTotal ?? null,
      salesTotal: o?.salesTotal ?? null, financePurchases, recordedRevenue, purchaseDiff, salesDiff,
      purchaseFlag: purchaseDiff != null && Math.abs(purchaseDiff) > tolP * financePurchases,
      salesFlag: salesDiff != null && Math.abs(salesDiff) > tolS * recordedRevenue,
    });
  }

  // ---------- KPI & cek kesehatan ----------
  const closedMonths = months.slice(1, BLN + 1);
  const openDays = closedMonths.reduce((s, o) => s + o.openDays, 0);
  const netYtd = closedMonths.reduce((s, o) => s + o.netRevenue, 0);
  const trxYtd = closedMonths.reduce((s, o) => s + o.transactions, 0);
  const cashDiffCheck = BLN ? Math.round(cashFlow[BLN].closing - cashLedgerTotal) : 0;
  const equityDiffCheck = BLN ? Math.round(equity[BLN].closing - neraca.closing.totalEquity) : 0;
  // Aset yang sudah diperoleh s.d. akhir bulan tutup buku harus sama dengan saldo akun Peralatan & Akumulasi.
  const lastClosed = BLN ? lastDayOfMonth(Y, BLN) : `${Y - 1}-12-31`;
  const ownedAssets = assets.filter((a) => a.acquiredOn <= lastClosed);
  const assetDiffCheck = ownedAssets.reduce((s, a) => s + a.cost, 0) - closingBalance[ACC.PERALATAN];
  const accumDiffCheck = ownedAssets.reduce((s, a) => s + a.accumulated, 0) + closingBalance[ACC.AKUM_PENYUSUTAN];
  const notOkDaysAll = days.filter((d) => d.calc.totalPos > 0 && d.calc.status !== "OK").length;
  const hasPriorAssets = assets.some((a) => Number(a.acquiredOn.slice(0, 4)) < Y);
  let pbjtUnderpaidYtd = 0;
  for (let m = 1; m <= BLN; m++) pbjtUnderpaidYtd += Math.max(0, pbjt(m).underpaid);
  const checks: HealthCheck[] = [
    { label: "Neraca seimbang", ok: neraca.closing.balanceCheck === 0, diff: neraca.closing.balanceCheck },
    { label: "Neraca saldo seimbang", ok: tbDiff === 0, diff: tbDiff },
    { label: "Kas di arus kas = kas di neraca", ok: cashDiffCheck === 0, diff: cashDiffCheck },
    { label: "Ekuitas: laporan perubahan = neraca", ok: equityDiffCheck === 0, diff: equityDiffCheck },
    { label: "Daftar aset tetap = akun Peralatan", ok: assetDiffCheck === 0 && accumDiffCheck === 0, diff: assetDiffCheck || accumDiffCheck },
    // Peringatan (sheet DASHBOARD Excel v2): tidak membuat laporan salah hitung, tapi perlu ditindaklanjuti.
    {
      label: "Hari omzet belum direalisasi / perlu cek", ok: notOkDaysAll === 0, diff: notOkDaysAll, level: "warn",
      note: `${notOkDaysAll} hari — cek Omzet Harian`,
    },
    {
      label: "Saldo awal aset tetap (sebelum " + Y + ")", ok: hasPriorAssets, diff: 0, level: "warn",
      note: "belum diinventarisasi",
    },
    {
      label: "Estimasi PBJT kurang bayar", ok: pbjtUnderpaidYtd <= 0, diff: pbjtUnderpaidYtd, level: "warn",
      note: `Rp ${pbjtUnderpaidYtd.toLocaleString("id-ID")} — lihat Pajak`,
    },
  ];

  return {
    year: Y, closedMonth: BLN, accounts: acc, days, months, assets, autoJournal: auto, manualJournal: manual,
    allJournal: all, mutations, signedOpening, closingBalance, profitLoss, profitLossTotal, balanceSheet: neraca,
    cashFlowLines, cashFlow, cashLedgerTotal, equity, trialBalance, events, tax, opsCheck, checks,
    netRevenuePerOpenDay: openDays ? netYtd / openDays : 0,
    avgTicket: trxYtd ? netYtd / trxYtd : 0,
  };
}

/** Buku besar satu akun s.d. closedMonth, dengan saldo berjalan mengikuti saldo normal. */
export function generalLedger(result: EngineResult, accountName: string) {
  const a = result.accounts.find((x) => x.name === accountName);
  if (!a) return null;
  const debitNormal = a.normal === "D";
  const rows = result.allJournal
    .filter((j) => j.month <= result.closedMonth && (j.debit === accountName || j.credit === accountName))
    .sort((x, y) => x.date.localeCompare(y.date) || Number(y.kind === "UMUM") - Number(x.kind === "UMUM"));
  let balance = a.openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const lines = rows.map((j) => {
    const debit = j.debit === accountName ? j.amount : 0;
    const credit = j.credit === accountName ? j.amount : 0;
    totalDebit += debit;
    totalCredit += credit;
    balance += debitNormal ? debit - credit : credit - debit;
    return {
      date: j.date, voucherNo: j.voucherNo, kind: j.kind, description: j.description,
      counterAccount: debit ? j.credit : j.debit, debit, credit, balance,
    };
  });
  return { account: a, openingBalance: a.openingBalance, lines, totalDebit, totalCredit, closingBalance: balance };
}
