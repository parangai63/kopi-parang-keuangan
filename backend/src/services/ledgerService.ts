import { Prisma, Setting } from "@prisma/client";
import prisma from "../prismaClient";
import { carryForwardOpening, compute } from "../engine/engine";
import { EngineInput, EngineResult } from "../engine/types";
import { toISODate } from "../utils/dates";
import { toNum, toNum0 } from "../utils/money";
import { getActiveSettings, getFirstFiscalYear, getSettingsForYear, toEngineSettings } from "./settingsService";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Memuat seluruh data tahun buku aktif dari database ke bentuk input mesin hitung.
 *
 * Hanya jurnal UMUM yang belum dibatalkan yang dimuat. Jurnal OTOMATIS/PENYESUAIAN
 * selalu dibuat ulang oleh mesin dari daily_sales, aset, tax_filings, dan
 * ops_monthly_figures — baris sistem yang dibekukan saat tutup buku hanya arsip.
 *
 * Volume per tahun kecil (±1.500 jurnal, 365 hari), jadi dihitung di memori
 * server; target spesifikasi "5.000 jurnal < 2 detik" tetap terpenuhi.
 */
export async function loadEngineInput(db: Db = prisma, settingsArg?: Setting, closedMonthOverride?: number): Promise<EngineInput> {
  const s = settingsArg ?? (await getActiveSettings(db));
  const Y = s.fiscalYear;
  const from = new Date(Date.UTC(Y, 0, 1));
  const to = new Date(Date.UTC(Y + 1, 0, 1));
  const firstYear = await getFirstFiscalYear(db);
  const opening = Y > firstYear ? await openingFromPreviousYear(db, Y) : null;

  const [accounts, daily, entries, assets, filings, ops] = await Promise.all([
    db.account.findMany({ orderBy: { code: "asc" } }),
    db.dailySale.findMany({
      where: { date: { gte: from, lt: to } },
      include: { staffBons: { include: { party: true } } },
      orderBy: { date: "asc" },
    }),
    db.journalEntry.findMany({
      where: { kind: "UMUM", voidedAt: null, date: { gte: from, lt: to } },
      include: { lines: { include: { account: true } }, event: true, party: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    // Aset yang diperoleh sesudah tahun ini belum ada di tahun ini.
    db.fixedAsset.findMany({ where: { voidedAt: null, acquiredOn: { lt: to } }, orderBy: [{ acquiredOn: "asc" }, { id: "asc" }] }),
    db.taxFiling.findMany({ where: { year: Y } }),
    db.opsMonthlyFigure.findMany({ where: { year: Y } }),
  ]);

  return {
    settings: { ...toEngineSettings(s, closedMonthOverride), firstYear },
    accounts: accounts.map((a) => ({
      code: a.code,
      name: a.name,
      group: a.group,
      normal: a.normalSide,
      cashCategory: a.cashCategory,
      cashFlowLine: a.cashFlowLine,
      // Tahun pertama: saldo awal yang diinput di Daftar Akun. Tahun berikutnya: saldo akhir tahun sebelumnya.
      openingBalance: opening ? opening[a.name] ?? 0 : toNum0(a.openingBalance),
    })),
    daily: daily.map((d) => ({
      date: toISODate(d.date),
      cashPos: toNum(d.cashPos),
      edcPos: toNum(d.edcPos),
      cashShift1: toNum(d.cashShift1),
      cashShift2: toNum(d.cashShift2),
      edcSettled: toNum(d.edcSettled),
      compliment: toNum(d.compliment),
      ownerBill: toNum(d.ownerBill),
      itemsSold: d.itemsSold,
      transactions: d.transactions,
      bons: d.staffBons.map((b) => ({ party: b.party.name, amount: toNum0(b.amount) })),
    })),
    journal: entries.map((e) => {
      const debitLine = e.lines.find((l) => l.debit > 0n);
      const creditLine = e.lines.find((l) => l.credit > 0n);
      if (!debitLine || !creditLine || e.lines.length !== 2) {
        // Jurnal majemuk belum didukung form maupun mesin hitung.
        throw new Error(`Jurnal ${e.voucherNo} harus tepat 1 baris debet dan 1 baris kredit.`);
      }
      return {
        id: e.id,
        voucherNo: e.voucherNo,
        date: toISODate(e.date),
        debit: debitLine.account.name,
        credit: creditLine.account.name,
        amount: toNum0(debitLine.debit),
        description: e.description,
        event: e.event?.name ?? "",
        party: e.party?.name ?? "",
        receiptNo: e.receiptNo ?? "",
      };
    }),
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      acquiredOn: toISODate(a.acquiredOn),
      cost: toNum0(a.cost),
      usefulLifeYears: a.usefulLifeYears,
    })),
    taxFilings: Object.fromEntries(
      filings.map((f) => [f.month, { pbjtPaid: toNum(f.pbjtPaid), reportedRevenue: toNum(f.reportedRevenue) }]),
    ),
    ops: Object.fromEntries(
      ops.map((o) => [
        o.month,
        { stockValue: toNum(o.stockValue), purchasesTotal: toNum(o.purchasesTotal), salesTotal: toNum(o.salesTotal) },
      ]),
    ),
  };
}

/**
 * Saldo awal 1 Januari tahun Y = saldo akhir 31 Desember tahun Y−1, dihitung ulang setiap kali (tidak disimpan),
 * supaya perbaikan di tahun sebelumnya (mis. Desember dibuka kembali) otomatis terbawa.
 * Tahun Y−1 dihitung s.d. Desember walau belum semua bulannya ditutup: selama itu saldo awal Y bersifat sementara,
 * dan bulan di tahun Y tidak bisa ditutup sebelum Desember Y−1 ditutup (closingService).
 */
export async function openingFromPreviousYear(db: Db, year: number): Promise<Record<string, number>> {
  const prev = await getSettingsForYear(year - 1, db);
  if (!prev) throw new Error(`Tahun buku ${year - 1} tidak ditemukan; saldo awal ${year} tidak bisa dihitung.`);
  const { result } = await computeLedger(db, { settings: prev, closedMonth: 12 });
  return carryForwardOpening(result);
}

/** Hitung semua laporan untuk tahun buku aktif. */
export async function computeLedger(
  db: Db = prisma,
  opts: { settings?: Setting; closedMonth?: number } = {},
): Promise<{ settings: Setting; result: EngineResult }> {
  const settings = opts.settings ?? (await getActiveSettings(db));
  const input = await loadEngineInput(db, settings, opts.closedMonth);
  return { settings, result: compute(input) };
}
