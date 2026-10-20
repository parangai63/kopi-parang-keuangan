import { Prisma, Setting } from "@prisma/client";
import prisma from "../prismaClient";
import { EngineSettings } from "../engine/types";
import { BULAN } from "../engine/engine";
import { decToNum, toNum0 } from "../utils/money";
import { locked, badRequest, HttpError } from "../utils/httpError";
import { monthOf, yearOf } from "../utils/dates";

type Db = Prisma.TransactionClient | typeof prisma;

/** Pengaturan tahun buku aktif (tahun terbesar di tabel settings). */
export async function getActiveSettings(db: Db = prisma): Promise<Setting> {
  const s = await db.setting.findFirst({ orderBy: { fiscalYear: "desc" } });
  if (!s) throw new HttpError(500, "Pengaturan tahun buku belum ada. Jalankan seed.");
  return s;
}

export function toEngineSettings(s: Setting, closedMonthOverride?: number): EngineSettings {
  return {
    year: s.fiscalYear,
    closedMonth: closedMonthOverride ?? s.closedMonth,
    pbjtRate: decToNum(s.pbjtRate),
    priceIncludesTax: s.priceIncludesTax,
    accruePbjt: s.accruePbjt,
    cashDiffThreshold: toNum0(s.cashDiffThreshold),
    opsPurchaseTolerancePct: decToNum(s.opsPurchaseTolerancePct),
    opsSalesTolerancePct: decToNum(s.opsSalesTolerancePct),
  };
}

export function serializeSettings(s: Setting) {
  return {
    fiscalYear: s.fiscalYear,
    businessName: s.businessName,
    closedMonth: s.closedMonth,
    pbjtRate: decToNum(s.pbjtRate),
    priceIncludesTax: s.priceIncludesTax,
    accruePbjt: s.accruePbjt,
    revenueTarget: toNum0(s.revenueTarget),
    foodCostLimit: decToNum(s.foodCostLimit),
    payrollLimit: decToNum(s.payrollLimit),
    occupancyLimit: decToNum(s.occupancyLimit),
    primeCostLimit: decToNum(s.primeCostLimit),
    netMarginTarget: decToNum(s.netMarginTarget),
    cashDiffThreshold: toNum0(s.cashDiffThreshold),
    opsPurchaseTolerancePct: decToNum(s.opsPurchaseTolerancePct),
    opsSalesTolerancePct: decToNum(s.opsSalesTolerancePct),
  };
}

/** Validasi: tanggal di tahun buku aktif dan di bulan yang belum ditutup. */
export function assertDateOpen(s: Setting, iso: string) {
  if (yearOf(iso) !== s.fiscalYear) throw badRequest(`Tanggal harus di tahun buku ${s.fiscalYear}.`);
  const m = monthOf(iso);
  if (m <= s.closedMonth) {
    throw locked(`Bulan ${BULAN[m - 1]} ${s.fiscalYear} sudah ditutup. Owner harus membuka kembali bulan itu untuk mengubah data.`);
  }
}

export function assertMonthOpen(s: Setting, month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw badRequest("Bulan harus 1–12.");
  if (month <= s.closedMonth) throw locked(`Bulan ${BULAN[month - 1]} ${s.fiscalYear} sudah ditutup.`);
}
