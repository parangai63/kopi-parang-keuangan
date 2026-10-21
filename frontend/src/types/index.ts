// Tipe data dari API backend Kopi Parang Keuangan. Nominal = integer Rupiah (number).

export type Role = "OWNER" | "ADMIN" | "KASIR";
export type DayStatus = "" | "Belum direalisasi" | "EDC belum settle" | "Cek selisih tunai" | "OK";
export type JournalKind = "UMUM" | "OTOMATIS" | "PENYESUAIAN";
export type PartyType = "KARYAWAN" | "SUPPLIER" | "PEMBERI_PINJAMAN" | "OWNER" | "LAINNYA";

export interface Me {
  id: number;
  name: string;
  email: string | null;
  role: Role;
  totpEnabled: boolean;
  /** tahun buku aktif & bulan terakhir yang ditutup (0 = belum ada), untuk chip di header */
  fiscalYear: number;
  closedMonth: number;
}

export interface Settings {
  fiscalYear: number;
  businessName: string;
  closedMonth: number;
  pbjtRate: number;
  priceIncludesTax: boolean;
  accruePbjt: boolean;
  revenueTarget: number;
  foodCostLimit: number;
  payrollLimit: number;
  occupancyLimit: number;
  primeCostLimit: number;
  netMarginTarget: number;
  cashDiffThreshold: number;
  opsPurchaseTolerancePct: number;
  opsSalesTolerancePct: number;
}

export interface Account {
  id: number;
  code: string;
  name: string;
  group: "ASET" | "LIABILITAS" | "EKUITAS" | "PENDAPATAN" | "BEBAN";
  reportLine: string | null;
  normalSide: "D" | "K";
  cashCategory: string;
  cashFlowLine: string | null;
  openingBalance: number;
  description: string | null;
  isActive: boolean;
  isUsed: boolean;
}

export interface Party {
  id: number;
  name: string;
  type: PartyType;
  isActive: boolean;
}

export interface EventItem {
  id: number;
  name: string;
  startDate: string | null;
  notes: string | null;
}

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

export interface DayBon {
  partyId: number;
  party: string;
  amount: number;
}

export interface DailyDay {
  date: string;
  cashPos: number | null;
  edcPos: number | null;
  cashShift1: number | null;
  cashShift2: number | null;
  edcSettled: number | null;
  compliment: number | null;
  ownerBill: number | null;
  itemsSold: number | null;
  transactions: number | null;
  bons: DayBon[];
  verifiedAt: string | null;
  calc: DayCalc;
}

export interface DailyMonth {
  year: number;
  month: number;
  locked: boolean;
  cashDiffThreshold: number;
  days: DailyDay[];
  summary: {
    totalPos: number;
    netRevenue: number;
    openDays: number;
    notOkDays: number;
    transactions: number;
    avgPerDay: number | null;
    targetAchievement: number | null;
  };
}

export interface KasirOverview {
  today: DailyDay;
  pendingDeposits: DailyDay[];
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
  isInventoryAdjustment?: boolean;
}

export interface JournalPage {
  total: number;
  totalAmount: number;
  page: number;
  pageSize: number;
  rows: LedgerEntry[];
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

export interface Limits {
  foodCost: number;
  payroll: number;
  occupancy: number;
  primeCost: number;
  netMargin: number;
}

export interface HealthCheck {
  label: string;
  ok: boolean;
  diff: number;
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

export interface Dashboard {
  year: number;
  closedMonth: number;
  total: ProfitLoss;
  monthly: { month: number; netRevenue: number; netProfit: number }[];
  netRevenuePerOpenDay: number;
  avgTicket: number;
  limits: Limits;
  costStructure: { label: string; amount: number; limit: number | null }[];
  checks: HealthCheck[];
  events: EventResult[];
  running: { month: number; openDays: number; notOkDays: number } | null;
}

export interface ProfitLossReport {
  year: number;
  closedMonth: number;
  opexAccounts: { code: string; name: string }[];
  months: (ProfitLoss & { month: number })[];
  total: ProfitLoss;
  limits: Limits;
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

export interface BalanceSheetReport {
  year: number;
  closedMonth: number;
  opening: BalanceSheet;
  closing: BalanceSheet;
}

export interface CashFlowReport {
  year: number;
  closedMonth: number;
  lines: Record<string, number[]>;
  months: { month: number; operating: number; investing: number; financing: number; netChange: number; opening: number; closing: number }[];
}

export interface EquityReport {
  year: number;
  closedMonth: number;
  months: { month: number; opening: number; capitalContribution: number; netProfit: number; prive: number; closing: number }[];
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  group: string;
  normal: "D" | "K";
  signedOpening: number;
  debitMutation: number;
  creditMutation: number;
  closing: number;
  debitBalance: number;
  creditBalance: number;
}

export interface GeneralLedgerReport {
  year: number;
  closedMonth: number;
  account: { code: string; name: string; normal: "D" | "K" };
  openingBalance: number;
  lines: { date: string; voucherNo: string; kind: JournalKind; description: string; counterAccount: string; debit: number; credit: number; balance: number }[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export interface AssetSchedule {
  id?: number;
  name: string;
  acquiredOn: string;
  cost: number;
  usefulLifeYears: number;
  perMonth: number;
  depreciationStart: string;
  accumulated: number;
  bookValue: number;
}

export interface AssetList {
  closedMonth: number;
  year: number;
  assets: AssetSchedule[];
  totals: { cost: number; accumulated: number; bookValue: number };
  ledgerCheck: { equipmentBalance: number; accumulatedBalance: number };
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

export interface ClosingPreview {
  year: number;
  closedMonth: number;
  nextMonth: number | null;
  lastDate?: string;
  notOkDays?: { date: string; status: DayStatus }[];
  opsFigures?: { stockValue: number | null; purchasesTotal: number | null; salesTotal: number | null; note: string | null } | null;
  taxFiling?: { reportedRevenue: number | null; pbjtPaid: number | null; sspdNo: string | null; filedOn: string | null } | null;
  opsCheck?: OpsCheckMonth;
  autoJournal?: LedgerEntry[];
  checks?: HealthCheck[];
  tolerances?: { purchase: number; sales: number };
  history: OpsCheckMonth[];
}

export interface UserRow {
  id: number;
  name: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  totpEnabled: boolean;
  hasPin: boolean;
}

export interface AuditRow {
  id: number;
  at: string;
  user: string | null;
  tableName: string;
  recordId: string;
  action: string;
  before: unknown;
  after: unknown;
}
