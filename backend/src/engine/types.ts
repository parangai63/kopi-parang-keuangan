// Tipe input/output mesin hitung. Mesin ini murni (tanpa Prisma/Express) supaya
// bisa diuji langsung terhadap angka patokan Excel v2 (scripts/check-patokan.ts).
// Semua nominal = number berisi integer Rupiah. Akun dirujuk dengan NAMA (unik).

export type AccountGroup = "ASET" | "LIABILITAS" | "EKUITAS" | "PENDAPATAN" | "BEBAN";
export type NormalSide = "D" | "K";
export type CashCategory = "KAS" | "OPERASI" | "INVESTASI" | "PENDANAAN" | "NONKAS";
export type JournalKind = "UMUM" | "OTOMATIS" | "PENYESUAIAN";
export type DayStatus = "" | "Belum direalisasi" | "EDC belum settle" | "Cek selisih tunai" | "OK";

export interface EngineSettings {
  year: number;
  /** 0–12 */
  closedMonth: number;
  pbjtRate: number;
  priceIncludesTax: boolean;
  accruePbjt: boolean;
  cashDiffThreshold: number;
  opsPurchaseTolerancePct: number;
  opsSalesTolerancePct: number;
}

export interface EngineAccount {
  code: string;
  name: string;
  group: AccountGroup;
  normal: NormalSide;
  cashCategory: CashCategory;
  cashFlowLine: string | null;
  openingBalance: number;
}

export interface StaffBon {
  party: string;
  amount: number;
}

/** Satu baris omzet harian. null = belum diisi (beda dengan 0). */
export interface EngineDay {
  date: string; // YYYY-MM-DD
  cashPos: number | null;
  edcPos: number | null;
  cashShift1: number | null;
  cashShift2: number | null;
  edcSettled: number | null;
  compliment: number | null;
  ownerBill: number | null;
  itemsSold: number | null;
  transactions: number | null;
  bons: StaffBon[];
}

export interface EngineJournal {
  id?: number;
  voucherNo: string;
  date: string;
  debit: string;
  credit: string;
  amount: number;
  description: string;
  event: string;
  party: string;
  receiptNo: string;
}

export interface EngineAsset {
  id?: number;
  name: string;
  acquiredOn: string;
  cost: number;
  usefulLifeYears: number;
}

export interface EngineOpsFigure {
  stockValue: number | null;
  purchasesTotal: number | null;
  salesTotal: number | null;
}

export interface EngineTaxFiling {
  reportedRevenue: number | null;
  pbjtPaid: number | null;
}

export interface EngineInput {
  settings: EngineSettings;
  accounts: EngineAccount[];
  daily: EngineDay[];
  /** Hanya jurnal UMUM yang belum dibatalkan. Jurnal sistem dibuat ulang oleh mesin. */
  journal: EngineJournal[];
  assets: EngineAsset[];
  taxFilings: Record<number, EngineTaxFiling>;
  ops: Record<number, EngineOpsFigure>;
}

// ---------- output ----------

export interface DayCalc {
  staffBon: number;
  totalPos: number;
  totalRealized: number;
  cashDiff: number;
  edcDiff: number;
  unexplainedCash: number;
  diffCost: number;
  netRevenue: number;
  status: DayStatus;
  avgTicket: number | null;
}

export interface DayRow extends EngineDay {
  month: number;
  calc: DayCalc;
}

export interface MonthSales {
  totalPos: number;
  cashPos: number;
  edcPos: number;
  netRevenue: number;
  realized: number;
  cashDeposited: number;
  edcSettled: number;
  staffBon: number;
  compliment: number;
  ownerBill: number;
  cashDiff: number;
  unexplainedCash: number;
  edcDiff: number;
  itemsSold: number;
  transactions: number;
  openDays: number;
  notOkDays: number;
  bonByParty: Record<string, number>;
}

export interface LedgerEntry {
  id?: number;
  voucherNo: string;
  date: string;
  month: number;
  year: number;
  debit: string;
  credit: string;
  amount: number;
  description: string;
  event: string;
  party: string;
  receiptNo: string;
  kind: JournalKind;
  sourceType?: string;
  sourceRef?: string;
  isInventoryAdjustment?: boolean;
}

export interface AssetSchedule {
  id?: number;
  name: string;
  acquiredOn: string;
  cost: number;
  usefulLifeYears: number;
  perMonth: number;
  depreciationStart: string;
  /** index 1–12 */
  schedule: number[];
  accumulated: number;
  bookValue: number;
}

export interface ProfitLoss {
  cafeRevenue: number;
  nonCafeRevenue: number;
  grossRevenue: number;
  restaurantTax: number;
  netRevenue: number;
  rawMaterial: number;
  serving: number;
  cogs: number;
  grossProfit: number;
  opex: Record<string, number>;
  totalOpex: number;
  operatingProfit: number;
  ebitda: number;
  otherIncome: number;
  otherExpense: number;
  otherNet: number;
  netProfit: number;
}

export interface BalanceSheet {
  cashOnHand: number;
  cashInBank: number;
  pettyCash: number;
  receivables: number;
  otherReceivables: number;
  inventory: number;
  supplies: number;
  prepaid: number;
  currentAssets: number;
  equipment: number;
  accumulatedDepreciation: number;
  nonCurrentAssets: number;
  totalAssets: number;
  accountsPayable: number;
  taxPayable: number;
  otherPayables: number;
  currentLiabilities: number;
  longTermPayables: number;
  totalLiabilities: number;
  ownerCapital: number;
  prive: number;
  currentYearProfit: number;
  totalEquity: number;
  totalLiabilitiesEquity: number;
  balanceCheck: number;
}

export interface CashFlowMonth {
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  opening: number;
  closing: number;
}

export interface EquityMonth {
  opening: number;
  capitalContribution: number;
  netProfit: number;
  prive: number;
  closing: number;
}

export interface TrialBalanceRow extends EngineAccount {
  signedOpening: number;
  debitMutation: number;
  creditMutation: number;
  closing: number;
  debitBalance: number;
  creditBalance: number;
}

export interface EventResult {
  name: string;
  firstDate: string;
  revenue: number;
  cost: number;
  profit: number;
  costPerRevenue: number | null;
  count: number;
}

export interface TaxMonth {
  month: number;
  recordedRevenue: number;
  dpp: number;
  pbjtDue: number;
  pbjtPaid: number | null;
  underpaid: number;
  reportedRevenue: number | null;
  reportedPct: number | null;
  revenueGap: number | null;
  paidPerJournal: number;
  matchesJournal: boolean;
}

export interface OpsCheckMonth {
  month: number;
  stockValue: number | null;
  purchasesTotal: number | null;
  salesTotal: number | null;
  financePurchases: number;
  recordedRevenue: number;
  purchaseDiff: number | null;
  salesDiff: number | null;
  purchaseFlag: boolean;
  salesFlag: boolean;
}

export interface HealthCheck {
  label: string;
  ok: boolean;
  diff: number;
  /** "warn" = peringatan (⚠), bukan kesalahan hitung; tidak ikut syarat "semua hijau". */
  level?: "warn";
  note?: string;
}

export interface EngineResult {
  year: number;
  closedMonth: number;
  accounts: EngineAccount[];
  days: DayRow[];
  /** index 0–12; index 0 tidak dipakai */
  months: MonthSales[];
  assets: AssetSchedule[];
  autoJournal: LedgerEntry[];
  manualJournal: LedgerEntry[];
  allJournal: LedgerEntry[];
  /** mutasi bertanda per akun, index 0–12 */
  mutations: Record<string, number[]>;
  signedOpening: Record<string, number>;
  closingBalance: Record<string, number>;
  profitLoss: ProfitLoss[]; // index 1–12 (0 = kosong)
  profitLossTotal: ProfitLoss;
  balanceSheet: { opening: BalanceSheet; closing: BalanceSheet };
  cashFlowLines: Record<string, number[]>;
  cashFlow: CashFlowMonth[]; // index 1–closedMonth
  cashLedgerTotal: number;
  equity: EquityMonth[]; // index 1–closedMonth
  trialBalance: TrialBalanceRow[];
  events: EventResult[];
  tax: TaxMonth[]; // index 1–12
  opsCheck: OpsCheckMonth[]; // index 1–12
  checks: HealthCheck[];
  netRevenuePerOpenDay: number;
  avgTicket: number;
}
