import { DailySale, DailyStaffBon, Party, Prisma } from "@prisma/client";
import prisma from "../prismaClient";
import { calcDay } from "../engine/engine";
import { EngineDay } from "../engine/types";
import { SessionUser } from "../middleware/auth";
import { badRequest, forbidden, notFound } from "../utils/httpError";
import { daysInMonth, fromISODate, toISODate, todayJakarta } from "../utils/dates";
import { parseAmount, parseCount, toNum, toNum0 } from "../utils/money";
import { assertDateOpen, getActiveSettings } from "./settingsService";
import { logAudit } from "./auditService";

type DailyWithBons = DailySale & { staffBons: (DailyStaffBon & { party: Party })[] };

const MONEY_FIELDS = ["cashPos", "edcPos", "cashShift1", "cashShift2", "edcSettled", "compliment", "ownerBill"] as const;
const COUNT_FIELDS = ["itemsSold", "transactions"] as const;
type MoneyField = (typeof MONEY_FIELDS)[number];
type CountField = (typeof COUNT_FIELDS)[number];
type Field = MoneyField | CountField | "bons";

const FIELD_LABEL: Record<Field, string> = {
  cashPos: "Tunai (POS)", edcPos: "EDC / QRIS (POS)", cashShift1: "Setoran shift 1", cashShift2: "Setoran shift 2",
  edcSettled: "Settlement EDC", compliment: "Compliment", ownerBill: "Bill owner",
  itemsSold: "Produk terjual", transactions: "Jumlah transaksi", bons: "Bon karyawan",
};

/** Kasir: angka tutup kasir hanya untuk HARI INI; setoran shift untuk hari sebelumnya
 * yang belum diverifikasi admin. Settlement EDC hanya admin/owner. */
const KASIR_TODAY_FIELDS: Field[] = ["cashPos", "edcPos", "compliment", "ownerBill", "itemsSold", "transactions", "bons", "cashShift1", "cashShift2"];
const KASIR_PAST_FIELDS: Field[] = ["cashShift1", "cashShift2"];

function toEngineDay(iso: string, d?: DailyWithBons | null): EngineDay {
  return {
    date: iso,
    cashPos: toNum(d?.cashPos), edcPos: toNum(d?.edcPos), cashShift1: toNum(d?.cashShift1), cashShift2: toNum(d?.cashShift2),
    edcSettled: toNum(d?.edcSettled), compliment: toNum(d?.compliment), ownerBill: toNum(d?.ownerBill),
    itemsSold: d?.itemsSold ?? null, transactions: d?.transactions ?? null,
    bons: (d?.staffBons ?? []).map((b) => ({ party: b.party.name, amount: toNum0(b.amount) })),
  };
}

function serializeDay(iso: string, d: DailyWithBons | null | undefined, threshold: number) {
  const day = toEngineDay(iso, d);
  return {
    ...day,
    bons: (d?.staffBons ?? []).map((b) => ({ partyId: b.partyId, party: b.party.name, amount: toNum0(b.amount) })),
    verifiedAt: d?.verifiedAt ?? null,
    calc: calcDay(day, threshold),
  };
}

const include = { staffBons: { include: { party: true } } } as const;

/** Semua tanggal dalam satu bulan (yang belum diisi tampil kosong) + ringkasan bulan. */
export async function listMonth(month: number) {
  const s = await getActiveSettings();
  if (!Number.isInteger(month) || month < 1 || month > 12) throw badRequest("Bulan harus 1–12.");
  const threshold = toNum0(s.cashDiffThreshold);
  const dates = daysInMonth(s.fiscalYear, month);
  const rows = await prisma.dailySale.findMany({
    where: { date: { gte: fromISODate(dates[0]), lte: fromISODate(dates[dates.length - 1]) } },
    include,
  });
  const byDate = new Map(rows.map((r) => [toISODate(r.date), r]));
  const days = dates.map((iso) => serializeDay(iso, byDate.get(iso), threshold));

  const sum = { totalPos: 0, netRevenue: 0, openDays: 0, notOkDays: 0, transactions: 0 };
  for (const d of days) {
    sum.totalPos += d.calc.totalPos;
    sum.netRevenue += d.calc.netRevenue;
    sum.transactions += d.transactions ?? 0;
    if (d.calc.totalPos > 0) {
      sum.openDays++;
      if (d.calc.status !== "OK") sum.notOkDays++;
    }
  }
  const target = toNum0(s.revenueTarget);
  return {
    year: s.fiscalYear,
    month,
    locked: month <= s.closedMonth,
    cashDiffThreshold: threshold,
    days,
    summary: {
      ...sum,
      avgPerDay: sum.openDays ? sum.netRevenue / sum.openDays : null,
      targetAchievement: target && sum.netRevenue ? sum.netRevenue / target : null,
    },
  };
}

/** Tampilan kasir di HP: omzet hari ini + daftar setoran yang belum diisi. */
export async function kasirOverview() {
  const s = await getActiveSettings();
  const today = todayJakarta();
  const threshold = toNum0(s.cashDiffThreshold);
  const firstOpen = `${s.fiscalYear}-${String(s.closedMonth + 1).padStart(2, "0")}-01`;
  const [todayRow, pending] = await Promise.all([
    prisma.dailySale.findUnique({ where: { date: fromISODate(today) }, include }),
    s.closedMonth >= 12
      ? Promise.resolve([] as DailyWithBons[])
      : prisma.dailySale.findMany({
          where: {
            date: { gte: fromISODate(firstOpen), lt: fromISODate(today) },
            cashPos: { gt: 0 }, cashShift1: null, cashShift2: null, verifiedAt: null,
          },
          include,
          orderBy: { date: "asc" },
        }),
  ]);
  return {
    today: serializeDay(today, todayRow, threshold),
    pendingDeposits: pending.map((r) => serializeDay(toISODate(r.date), r, threshold)),
  };
}

interface BonInput {
  partyId: number;
  amount: unknown;
}

/** Simpan (upsert) satu tanggal. Hanya field yang dikirim yang diubah. */
export async function upsertDay(user: SessionUser, iso: string, body: Record<string, unknown>) {
  const s = await getActiveSettings();
  const date = fromISODate(iso);
  assertDateOpen(s, iso);
  const today = todayJakarta();
  if (iso > today) throw badRequest("Tidak bisa mengisi omzet untuk tanggal yang belum terjadi.");

  const existing = await prisma.dailySale.findUnique({ where: { date }, include });
  const sent = (Object.keys(FIELD_LABEL) as Field[]).filter((f) => f in body);
  if (!sent.length) throw badRequest("Tidak ada data yang dikirim.");

  if (user.role === "KASIR") {
    if (existing?.verifiedAt) throw forbidden("Omzet tanggal ini sudah diverifikasi admin dan tidak bisa diubah kasir.");
    const allowed = iso === today ? KASIR_TODAY_FIELDS : KASIR_PAST_FIELDS;
    const denied = sent.filter((f) => !allowed.includes(f));
    if (denied.length) {
      throw forbidden(`Kasir tidak bisa mengubah: ${denied.map((f) => FIELD_LABEL[f]).join(", ")}.`);
    }
  }

  const data: Prisma.DailySaleUncheckedCreateInput = { date };
  for (const f of MONEY_FIELDS) if (f in body) data[f] = parseAmount(body[f], FIELD_LABEL[f], { allowNull: true });
  for (const f of COUNT_FIELDS) if (f in body) data[f] = parseCount(body[f], FIELD_LABEL[f]);

  let bons: { partyId: number; amount: bigint }[] | undefined;
  if ("bons" in body) {
    if (!Array.isArray(body.bons)) throw badRequest("Bon karyawan harus berupa daftar.");
    const seen = new Set<number>();
    bons = [];
    for (const b of body.bons as BonInput[]) {
      const partyId = Number(b?.partyId);
      if (!Number.isInteger(partyId)) throw badRequest("Pilih nama karyawan untuk setiap bon.");
      if (seen.has(partyId)) throw badRequest("Satu karyawan hanya boleh satu baris bon per hari.");
      seen.add(partyId);
      const amount = parseAmount(b.amount, "Nominal bon", { positive: true })!;
      bons.push({ partyId, amount });
    }
    if (bons.length) {
      const found = await prisma.party.count({ where: { id: { in: [...seen] }, isActive: true } });
      if (found !== seen.size) throw badRequest("Ada nama karyawan yang tidak ditemukan atau tidak aktif.");
    }
  }

  const saved = await prisma.$transaction(async (tx) => {
    const { date: _d, ...updates } = data;
    const row = await tx.dailySale.upsert({
      where: { date },
      create: { ...data, createdById: user.id, updatedById: user.id },
      update: { ...updates, updatedById: user.id },
    });
    if (bons) {
      await tx.dailyStaffBon.deleteMany({ where: { dailySaleId: row.id } });
      if (bons.length) await tx.dailyStaffBon.createMany({ data: bons.map((b) => ({ ...b, dailySaleId: row.id })) });
    }
    const after = await tx.dailySale.findUniqueOrThrow({ where: { id: row.id }, include });
    await logAudit(tx, {
      userId: user.id, tableName: "daily_sales", recordId: iso,
      action: existing ? "UPDATE" : "CREATE", before: existing ?? undefined, after,
    });
    return after;
  });
  return serializeDay(iso, saved, toNum0(s.cashDiffThreshold));
}

/** Admin/owner memverifikasi realisasi; setelah ini kasir tidak bisa mengubah tanggal itu. */
export async function verifyDay(user: SessionUser, iso: string) {
  const s = await getActiveSettings();
  assertDateOpen(s, iso);
  const existing = await prisma.dailySale.findUnique({ where: { date: fromISODate(iso) }, include });
  if (!existing) throw notFound("Omzet tanggal ini belum diisi.");
  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.dailySale.update({
      where: { id: existing.id },
      data: { verifiedAt: new Date(), verifiedById: user.id },
      include,
    });
    await logAudit(tx, { userId: user.id, tableName: "daily_sales", recordId: iso, action: "VERIFY", before: existing, after: row });
    return row;
  });
  return serializeDay(iso, saved, toNum0(s.cashDiffThreshold));
}

