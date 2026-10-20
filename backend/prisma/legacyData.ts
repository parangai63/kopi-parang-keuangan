// Membaca data asli Excel v2 yang sudah diekstrak ke prototype/data.js
// (Jan – 11 Okt 2026) dan mengubahnya ke bentuk input mesin hitung.
// Dipakai oleh prisma/seed.ts dan scripts/check-patokan.ts.
//
// Catatan: skrip migrasi resmi Fase 2 harus membaca file Excel v2 langsung
// (docs/SPESIFIKASI.md bagian Migrasi). data.js adalah jembatan sementara.
import fs from "fs";
import path from "path";
import vm from "vm";
import type { EngineInput, AccountGroup, NormalSide, CashCategory } from "../src/engine/types";

/** Pihak pengganti untuk bon karyawan lama yang di Excel hanya total per hari. */
export const LEGACY_BON_PARTY = "Bon karyawan (data Excel)";

type RawAccount = [string, string, AccountGroup, NormalSide, CashCategory, string, number];
type RawDaily = [string, ...(number | null)[]];
type RawJournal = [string, string, string, string, number, string, string, string, string?];
type RawAsset = [string, string, number, number];

interface RawData {
  settings: { year: number; bln: number; rate: number; inkl: boolean; accr: boolean; target: number };
  accounts: RawAccount[];
  daily: RawDaily[];
  journal: RawJournal[];
  assets: RawAsset[];
  paid: Record<string, number>;
}

export function readRawData(): RawData {
  const file = path.resolve(__dirname, "../../prototype/data.js");
  const ctx: { window: { KP_DATA?: RawData } } = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx);
  if (!ctx.window.KP_DATA) throw new Error(`KP_DATA tidak ditemukan di ${file}`);
  return ctx.window.KP_DATA;
}

export function legacyEngineInput(): EngineInput {
  const D = readRawData();
  return {
    settings: {
      year: D.settings.year,
      closedMonth: D.settings.bln,
      pbjtRate: D.settings.rate,
      priceIncludesTax: D.settings.inkl,
      accruePbjt: D.settings.accr,
      cashDiffThreshold: 50000,
      opsPurchaseTolerancePct: 0.05,
      opsSalesTolerancePct: 0.02,
    },
    accounts: D.accounts.map((a) => ({
      code: a[0], name: a[1], group: a[2], normal: a[3], cashCategory: a[4],
      cashFlowLine: a[5] || null, openingBalance: a[6],
    })),
    daily: D.daily.map((r) => {
      const v = (i: number) => (r[i] as number | null) ?? null;
      const bon = v(6);
      return {
        date: r[0],
        cashPos: v(1), edcPos: v(2), cashShift1: v(3), cashShift2: v(4), edcSettled: v(5),
        compliment: v(7), ownerBill: v(8), itemsSold: v(9), transactions: v(10),
        bons: bon ? [{ party: LEGACY_BON_PARTY, amount: bon }] : [],
      };
    }),
    journal: D.journal.map((j) => ({
      voucherNo: j[0], date: j[1], debit: j[2], credit: j[3], amount: j[4],
      description: j[5], event: j[6] || "", party: j[7] || "", receiptNo: j[8] || "",
    })),
    assets: D.assets.map((a) => ({ name: a[0], acquiredOn: a[1], cost: a[2], usefulLifeYears: a[3] })),
    taxFilings: Object.fromEntries(
      Object.entries(D.paid).map(([m, paid]) => [Number(m), { pbjtPaid: paid, reportedRevenue: null }]),
    ),
    ops: {},
  };
}
