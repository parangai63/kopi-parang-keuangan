import { Request, Response } from "express";
import { generalLedger } from "../engine/engine";
import { computeLedger } from "../services/ledgerService";
import { latestEventNotes } from "../services/masterDataService";
import * as notes from "../services/notesService";
import { serializeSettings } from "../services/settingsService";
import prisma from "../prismaClient";
import { badRequest } from "../utils/httpError";

// Semua laporan hanya-baca, dihitung dari mesin (src/engine). Bulan > closedMonth
// tidak ditampilkan di laporan resmi bulanan.

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

function limitsOf(s: ReturnType<typeof serializeSettings>) {
  return {
    foodCost: s.foodCostLimit,
    payroll: s.payrollLimit,
    occupancy: s.occupancyLimit,
    primeCost: s.primeCostLimit,
    netMargin: s.netMarginTarget,
  };
}

export async function getDashboard(_req: Request, res: Response) {
  const { settings, result: R } = await computeLedger();
  const s = serializeSettings(settings);
  const T = R.profitLossTotal;
  const op = (name: string) => T.opex[name] ?? 0;
  const known = op("Beban Gaji") + op("Biaya Sewa Tempat") + op("Biaya Marketing & Promosi") + op("Biaya Tagihan Bulanan");
  const running = R.closedMonth < 12 ? R.months[R.closedMonth + 1] : null;
  res.json({
    year: R.year,
    closedMonth: R.closedMonth,
    total: T,
    monthly: range(R.closedMonth).map((m) => ({
      month: m,
      netRevenue: R.profitLoss[m].netRevenue,
      grossProfit: R.profitLoss[m].grossProfit,
      netProfit: R.profitLoss[m].netProfit,
      cogs: R.profitLoss[m].cogs,
      payroll: R.profitLoss[m].opex["Beban Gaji"] ?? 0,
      cashClosing: R.cashFlow[m].closing,
    })),
    cash: {
      onHand: R.balanceSheet.closing.cashOnHand,
      bank: R.balanceSheet.closing.cashInBank,
      petty: R.balanceSheet.closing.pettyCash,
    },
    netRevenuePerOpenDay: R.netRevenuePerOpenDay,
    avgTicket: R.avgTicket,
    limits: limitsOf(s),
    costStructure: [
      { label: "HPP (food cost)", amount: T.cogs, limit: s.foodCostLimit },
      { label: "Gaji", amount: op("Beban Gaji"), limit: s.payrollLimit },
      { label: "Sewa", amount: op("Biaya Sewa Tempat"), limit: s.occupancyLimit },
      { label: "Marketing & event", amount: op("Biaya Marketing & Promosi"), limit: null },
      { label: "Tagihan bulanan", amount: op("Biaya Tagihan Bulanan"), limit: null },
      { label: "Beban lainnya", amount: T.totalOpex - known, limit: null },
    ],
    checks: R.checks,
    events: R.events,
    running: running && { month: R.closedMonth + 1, openDays: running.openDays, notOkDays: running.notOkDays },
  });
}

export async function getProfitLoss(_req: Request, res: Response) {
  const { settings, result: R } = await computeLedger();
  res.json({
    year: R.year,
    closedMonth: R.closedMonth,
    opexAccounts: R.accounts.filter((a) => a.code.startsWith("61")).map((a) => ({ code: a.code, name: a.name })),
    months: range(R.closedMonth).map((m) => ({ month: m, ...R.profitLoss[m] })),
    total: R.profitLossTotal,
    limits: limitsOf(serializeSettings(settings)),
  });
}

export async function getBalanceSheet(_req: Request, res: Response) {
  const { result: R } = await computeLedger();
  res.json({ year: R.year, closedMonth: R.closedMonth, ...R.balanceSheet });
}

export async function getCashFlow(_req: Request, res: Response) {
  const { result: R } = await computeLedger();
  const months = range(R.closedMonth);
  res.json({
    year: R.year,
    closedMonth: R.closedMonth,
    lines: Object.fromEntries(Object.entries(R.cashFlowLines).map(([k, v]) => [k, months.map((m) => v[m])])),
    months: months.map((m) => ({ month: m, ...R.cashFlow[m] })),
    cashLedgerTotal: R.cashLedgerTotal,
  });
}

export async function getEquityChanges(_req: Request, res: Response) {
  const { result: R } = await computeLedger();
  res.json({ year: R.year, closedMonth: R.closedMonth, months: range(R.closedMonth).map((m) => ({ month: m, ...R.equity[m] })) });
}

export async function getTrialBalance(_req: Request, res: Response) {
  const { result: R } = await computeLedger();
  res.json({ year: R.year, closedMonth: R.closedMonth, rows: R.trialBalance });
}

export async function getGeneralLedger(req: Request, res: Response) {
  const account = String(req.query.account ?? "");
  if (!account) throw badRequest("Parameter ?account= (nama akun) wajib diisi.");
  const { result: R } = await computeLedger();
  const gl = generalLedger(R, account);
  if (!gl) throw badRequest(`Akun "${account}" tidak ditemukan.`);
  res.json({ year: R.year, closedMonth: R.closedMonth, ...gl });
}

export async function getEvents(_req: Request, res: Response) {
  const { result: R } = await computeLedger();
  const [noteByName, ids] = await Promise.all([latestEventNotes(), prisma.event.findMany({ select: { id: true, name: true } })]);
  const idByName = new Map(ids.map((e) => [e.name, e.id]));
  res.json({
    year: R.year,
    closedMonth: R.closedMonth,
    events: R.events.map((e) => ({ ...e, id: idByName.get(e.name) ?? null, note: noteByName[e.name] ?? "" })),
  });
}

/** Rekap omzet termasuk bulan berjalan (Logika 11). */
export async function getSalesRecap(_req: Request, res: Response) {
  const { settings, result: R } = await computeLedger();
  const target = Number(settings.revenueTarget);
  const last = Math.min(12, R.closedMonth + 1);
  res.json({
    year: R.year,
    closedMonth: R.closedMonth,
    target,
    months: range(last).map((m) => {
      const o = R.months[m];
      const prev = m > 1 ? R.months[m - 1].netRevenue : 0;
      const { bonByParty, ...rest } = o;
      return {
        month: m,
        ...rest,
        avgPerDay: o.openDays ? o.netRevenue / o.openDays : null,
        avgTicket: o.transactions ? o.netRevenue / o.transactions : null,
        targetAchievement: target ? o.netRevenue / target : null,
        growth: prev ? o.netRevenue / prev - 1 : null,
      };
    }),
  });
}

export async function getTax(_req: Request, res: Response) {
  const { result: R } = await computeLedger();
  res.json({ year: R.year, closedMonth: R.closedMonth, months: R.tax.slice(1, Math.min(12, R.closedMonth + 1) + 1) });
}

/** CALK (sheet CALK): teks per bagian dengan angka terisi otomatis. */
export async function getNotes(_req: Request, res: Response) {
  res.json(await notes.getNotes());
}

export async function putNotes(req: Request, res: Response) {
  await notes.saveNotes(req.user!, req.body?.sections ?? null);
  res.json(await notes.getNotes());
}
