// Wizard Tutup Buku (spesifikasi: Alur kerja + Logika 2 & 12).
import prisma from "../prismaClient";
import { SessionUser } from "../middleware/auth";
import { BULAN } from "../engine/engine";
import { badRequest, locked } from "../utils/httpError";
import { fromISODate, toISODate } from "../utils/dates";
import { parseAmount, toNum } from "../utils/money";
import { assertMonthOpen, getActiveSettings } from "./settingsService";
import { computeLedger } from "./ledgerService";
import { logAudit } from "./auditService";

/** Bulan berikutnya yang akan ditutup + pratinjau semua yang dibutuhkan wizard. */
export async function closingPreview() {
  const s = await getActiveSettings();
  const next = s.closedMonth + 1;
  const { result: current } = await computeLedger(prisma, { settings: s });
  const history = current.opsCheck.slice(1, Math.min(12, next) + 1);
  if (next > 12) {
    return { year: s.fiscalYear, closedMonth: s.closedMonth, nextMonth: null, history };
  }
  // Hitung seolah bulan `next` sudah ditutup → jurnal otomatis & cek kesehatan bulan itu.
  const { result: R } = await computeLedger(prisma, { settings: s, closedMonth: next });
  const [ops, filing] = await Promise.all([
    prisma.opsMonthlyFigure.findUnique({ where: { year_month: { year: s.fiscalYear, month: next } } }),
    prisma.taxFiling.findUnique({ where: { year_month: { year: s.fiscalYear, month: next } } }),
  ]);
  const notOkDays = R.days
    .filter((d) => d.month === next && d.calc.totalPos > 0 && d.calc.status !== "OK")
    .map((d) => ({ date: d.date, status: d.calc.status }));
  return {
    year: s.fiscalYear,
    closedMonth: s.closedMonth,
    nextMonth: next,
    lastDate: `${s.fiscalYear}-${String(next).padStart(2, "0")}-${new Date(Date.UTC(s.fiscalYear, next, 0)).getUTCDate()}`,
    notOkDays,
    opsFigures: ops
      ? { stockValue: toNum(ops.stockValue), purchasesTotal: toNum(ops.purchasesTotal), salesTotal: toNum(ops.salesTotal), note: ops.note }
      : null,
    taxFiling: filing
      ? {
          reportedRevenue: toNum(filing.reportedRevenue), pbjtPaid: toNum(filing.pbjtPaid), sspdNo: filing.sspdNo,
          filedOn: filing.filedOn ? toISODate(filing.filedOn) : null,
        }
      : null,
    opsCheck: R.opsCheck[next],
    tax: R.tax[next],
    autoJournal: R.autoJournal.filter((j) => j.month === next),
    checks: R.checks,
    tolerances: { purchase: Number(s.opsPurchaseTolerancePct), sales: Number(s.opsSalesTolerancePct) },
    history,
  };
}

export async function saveTaxFiling(
  user: SessionUser,
  month: number,
  body: { reportedRevenue?: unknown; pbjtPaid?: unknown; sspdNo?: string | null; filedOn?: string | null },
) {
  const s = await getActiveSettings();
  assertMonthOpen(s, month);
  const data = {
    reportedRevenue: parseAmount(body.reportedRevenue, "Omzet dilaporkan", { allowNull: true }),
    pbjtPaid: parseAmount(body.pbjtPaid, "PBJT dibayar", { allowNull: true }),
    sspdNo: body.sspdNo?.trim() || null,
    filedOn: body.filedOn ? fromISODate(body.filedOn) : null,
  };
  const key = { year_month: { year: s.fiscalYear, month } };
  const before = await prisma.taxFiling.findUnique({ where: key });
  const row = await prisma.taxFiling.upsert({ where: key, create: { year: s.fiscalYear, month, ...data }, update: data });
  await logAudit(prisma, {
    userId: user.id, tableName: "tax_filings", recordId: row.id, action: before ? "UPDATE" : "CREATE",
    before: before ?? undefined, after: row,
  });
  return row.id;
}

/** Tiga angka dari Parang-ops — diketik manual (TIDAK ada koneksi ke Parang-ops). */
export async function saveOpsFigures(
  user: SessionUser,
  month: number,
  body: { stockValue?: unknown; purchasesTotal?: unknown; salesTotal?: unknown; note?: string | null },
) {
  const s = await getActiveSettings();
  assertMonthOpen(s, month);
  const data = {
    stockValue: parseAmount(body.stockValue, "Nilai stok akhir")!,
    purchasesTotal: parseAmount(body.purchasesTotal, "Total pembelian")!,
    salesTotal: parseAmount(body.salesTotal, "Total penjualan Majoo", { allowNull: true }),
    note: body.note?.trim() || null,
  };
  const key = { year_month: { year: s.fiscalYear, month } };
  const before = await prisma.opsMonthlyFigure.findUnique({ where: key });
  const row = await prisma.opsMonthlyFigure.upsert({
    where: key,
    create: { year: s.fiscalYear, month, ...data, enteredById: user.id },
    update: { ...data, enteredById: user.id },
  });
  await logAudit(prisma, {
    userId: user.id, tableName: "ops_monthly_figures", recordId: row.id, action: before ? "UPDATE" : "CREATE",
    before: before ?? undefined, after: row,
  });
  return row.id;
}

/**
 * Tutup buku bulan berikutnya. Syarat: konfirmasi tagihan rutin, konfirmasi hari yang belum OK
 * (jika ada), dan angka Parang-ops (stok + pembelian) sudah diisi. Cek selisih Parang-ops
 * TIDAK memblokir. Jurnal sistem bulan itu dibekukan ke journal_entries sebagai arsip.
 */
export async function closeMonth(user: SessionUser, body: { ackRecurring?: boolean; ackNotOkDays?: boolean }) {
  const s = await getActiveSettings();
  const month = s.closedMonth + 1;
  if (month > 12) throw badRequest("Semua bulan di tahun buku ini sudah ditutup.");
  if (!body.ackRecurring) throw badRequest("Centang konfirmasi bahwa semua tagihan rutin sudah dijurnal.");
  const ops = await prisma.opsMonthlyFigure.findUnique({ where: { year_month: { year: s.fiscalYear, month } } });
  if (!ops) throw badRequest("Isi nilai stok akhir dan total pembelian dari Parang-ops terlebih dahulu.");

  const { result: R } = await computeLedger(prisma, { settings: s, closedMonth: month });
  const notOk = R.days.filter((d) => d.month === month && d.calc.totalPos > 0 && d.calc.status !== "OK");
  if (notOk.length && !body.ackNotOkDays) {
    throw badRequest(`${notOk.length} hari di ${BULAN[month - 1]} belum berstatus OK. Centang konfirmasi untuk tetap melanjutkan.`);
  }
  const autos = R.autoJournal.filter((j) => j.month === month);
  const accounts = await prisma.account.findMany({ select: { id: true, name: true } });
  const accountId = new Map(accounts.map((a) => [a.name, a.id]));
  const parties = await prisma.party.findMany({ select: { id: true, name: true } });
  const partyId = new Map(parties.map((p) => [p.name, p.id]));

  return prisma.$transaction(async (tx) => {
    // Kunci optimistis: pastikan tidak ada yang menutup bulan yang sama bersamaan.
    const updated = await tx.setting.updateMany({
      where: { id: s.id, closedMonth: s.closedMonth },
      data: { closedMonth: month, updatedById: user.id },
    });
    if (updated.count !== 1) throw locked("Status tutup buku berubah. Muat ulang halaman.");
    const closing = await tx.periodClosing.create({ data: { year: s.fiscalYear, month, closedById: user.id } });
    let seq = 0;
    for (const j of autos) {
      seq++;
      await tx.journalEntry.create({
        data: {
          voucherNo: `AUTO-${closing.id}-${String(seq).padStart(2, "0")}`,
          date: fromISODate(j.date),
          description: j.description,
          kind: j.kind,
          partyId: j.party ? partyId.get(j.party) ?? null : null,
          sourceType: j.sourceType,
          sourceRef: j.sourceRef,
          createdById: user.id,
          lines: {
            create: [
              { accountId: accountId.get(j.debit)!, debit: BigInt(j.amount), credit: 0n },
              { accountId: accountId.get(j.credit)!, debit: 0n, credit: BigInt(j.amount) },
            ],
          },
        },
      });
    }
    await logAudit(tx, {
      userId: user.id, tableName: "period_closings", recordId: closing.id, action: "CLOSE",
      before: { closedMonth: s.closedMonth },
      after: { closedMonth: month, autoJournalCount: autos.length, checks: R.checks, opsCheck: R.opsCheck[month] },
    });
    return { month, checks: R.checks, autoJournalCount: autos.length };
  });
}

/** Buka kembali bulan terakhir yang ditutup. Hanya owner; tercatat di riwayat. */
export async function reopenMonth(user: SessionUser) {
  const s = await getActiveSettings();
  const month = s.closedMonth;
  if (month < 1) throw badRequest("Belum ada bulan yang ditutup.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.setting.updateMany({
      where: { id: s.id, closedMonth: month },
      data: { closedMonth: month - 1, updatedById: user.id },
    });
    if (updated.count !== 1) throw locked("Status tutup buku berubah. Muat ulang halaman.");
    const closing = await tx.periodClosing.findFirst({
      where: { year: s.fiscalYear, month, reopenedAt: null },
      orderBy: { closedAt: "desc" },
    });
    if (closing) {
      await tx.periodClosing.update({ where: { id: closing.id }, data: { reopenedAt: new Date(), reopenedById: user.id } });
      // Arsip jurnal sistem bulan itu dibatalkan; akan dibuat ulang saat ditutup lagi.
      await tx.journalEntry.updateMany({
        where: { voucherNo: { startsWith: `AUTO-${closing.id}-` }, voidedAt: null },
        data: { voidedAt: new Date(), voidedById: user.id },
      });
    }
    await logAudit(tx, {
      userId: user.id, tableName: "period_closings", recordId: closing?.id ?? `${s.fiscalYear}-${month}`,
      action: "REOPEN", before: { closedMonth: month }, after: { closedMonth: month - 1 },
    });
    return { month };
  });
}

export async function closingHistory() {
  const s = await getActiveSettings();
  const rows = await prisma.periodClosing.findMany({ where: { year: s.fiscalYear }, orderBy: { closedAt: "desc" } });
  return rows.map((r) => ({
    id: r.id, month: r.month, closedAt: r.closedAt, closedById: r.closedById,
    reopenedAt: r.reopenedAt, reopenedById: r.reopenedById,
  }));
}
