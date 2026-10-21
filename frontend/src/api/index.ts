// Endpoint per modul. Satu file karena tiap modul hanya beberapa baris.
import { api, qs } from "./client";
import type {
  Account, AssetList, Role, AuditRow, BalanceSheetReport, CashFlowReport, ClosingPreview, DailyDay, DailyMonth,
  Dashboard, EquityReport, EventItem, EventResult, GeneralLedgerReport, JournalPage, KasirOverview, Me, Party,
  ProfitLossReport, Settings, TrialBalanceRow, UserRow,
} from "../types";

type Id = { id: number };

export const authApi = {
  me: () => api<{ user: Me }>("/auth/me"),
  login: (email: string, password: string, totp?: string) =>
    api<{ user?: Me; needTotp?: boolean }>("/auth/login", { method: "POST", body: { email, password, totp } }),
  loginUsers: () => api<{ id: number; name: string; role: Role }[]>("/auth/users"),
  pin: (userId: number, pin: string) => api<{ user: Me }>("/auth/pin", { method: "POST", body: { userId, pin } }),
  logout: () => api<{ ok: true }>("/auth/logout", { method: "POST" }),
  totpSetup: () => api<{ secret: string; otpauthUrl: string }>("/auth/totp/setup", { method: "POST" }),
  totpConfirm: (code: string) => api<{ ok: true }>("/auth/totp/confirm", { method: "POST", body: { code } }),
};

export const dailyApi = {
  month: (month: number) => api<DailyMonth>(`/daily-sales${qs({ month })}`),
  kasir: () => api<KasirOverview>("/daily-sales/kasir"),
  staff: () => api<{ id: number; name: string }[]>("/daily-sales/staff"),
  save: (date: string, body: Record<string, unknown>) => api<DailyDay>(`/daily-sales/${date}`, { method: "PUT", body }),
  verify: (date: string) => api<DailyDay>(`/daily-sales/${date}/verify`, { method: "POST" }),
};

export interface JournalInput {
  date: string;
  debitAccountId: number | "";
  creditAccountId: number | "";
  amount: number | null;
  description: string;
  receiptNo: string;
  eventId: number | "";
  partyId: number | "";
}

export const journalApi = {
  list: (f: { q?: string; month?: number | ""; account?: string; event?: string; kind?: string; page?: number; pageSize?: number }) =>
    api<JournalPage>(`/journal${qs(f)}`),
  create: (body: JournalInput) => api<{ id: number; voucherNo: string }>("/journal", { method: "POST", body: clean(body) }),
  void: (id: number) => api<{ voucherNo: string }>(`/journal/${id}/void`, { method: "POST" }),
};

const clean = (b: JournalInput) => ({ ...b, eventId: b.eventId || null, partyId: b.partyId || null });

export const assetApi = {
  list: () => api<AssetList>("/assets"),
  create: (body: { name: string; acquiredOn: string; cost: number | null; usefulLifeYears: number }) =>
    api<Id>("/assets", { method: "POST", body }),
  void: (id: number) => api<Id>(`/assets/${id}/void`, { method: "POST" }),
};

export const masterApi = {
  settings: () => api<Settings>("/settings"),
  saveSettings: (body: Partial<Settings>) => api<Settings>("/settings", { method: "PUT", body }),
  accounts: () => api<Account[]>("/accounts"),
  saveAccount: (id: number, body: Partial<Account>) => api<Id>(`/accounts/${id}`, { method: "PUT", body }),
  parties: () => api<Party[]>("/parties"),
  createParty: (body: { name: string; type: string }) => api<Id>("/parties", { method: "POST", body }),
  updateParty: (id: number, body: Partial<Party>) => api<Id>(`/parties/${id}`, { method: "PUT", body }),
  events: () => api<EventItem[]>("/events"),
  createEvent: (body: { name: string; startDate?: string }) => api<Id>("/events", { method: "POST", body }),
};

export const reportApi = {
  dashboard: () => api<Dashboard>("/reports/dashboard"),
  profitLoss: () => api<ProfitLossReport>("/reports/profit-loss"),
  balanceSheet: () => api<BalanceSheetReport>("/reports/balance-sheet"),
  cashFlow: () => api<CashFlowReport>("/reports/cash-flow"),
  equity: () => api<EquityReport>("/reports/equity-changes"),
  trialBalance: () => api<{ year: number; closedMonth: number; rows: TrialBalanceRow[] }>("/reports/trial-balance"),
  generalLedger: (account: string) => api<GeneralLedgerReport>(`/reports/general-ledger${qs({ account })}`),
  events: () => api<{ year: number; events: EventResult[] }>("/reports/events"),
};

export const closingApi = {
  preview: () => api<ClosingPreview>("/closing/preview"),
  saveTax: (month: number, body: { reportedRevenue: number | null; pbjtPaid: number | null; sspdNo?: string }) =>
    api<Id>(`/closing/tax-filing/${month}`, { method: "PUT", body }),
  saveOps: (month: number, body: { stockValue: number | null; purchasesTotal: number | null; salesTotal: number | null; note?: string }) =>
    api<Id>(`/closing/ops-figures/${month}`, { method: "PUT", body }),
  close: (body: { ackRecurring: boolean; ackNotOkDays: boolean }) =>
    api<{ month: number; checks: { label: string; ok: boolean }[] }>("/closing/close", { method: "POST", body }),
  reopen: () => api<{ month: number }>("/closing/reopen", { method: "POST" }),
};

export const userApi = {
  list: () => api<UserRow[]>("/users"),
  create: (body: Record<string, unknown>) => api<Id>("/users", { method: "POST", body }),
  update: (id: number, body: Record<string, unknown>) => api<Id>(`/users/${id}`, { method: "PUT", body }),
  audit: (page = 1) => api<{ total: number; page: number; pageSize: number; rows: AuditRow[] }>(`/audit-logs${qs({ page })}`),
};
