// Reset data: KOSONGKAN semua data transaksi supaya owner bisa mulai dengan data asli
// (mis. membersihkan data dummy hasil `npm run seed`).
//
// Pengecualian tertulis dari aturan "hapus = soft delete" (spesifikasi: Reset data). Pengaman:
// hanya owner, pratinjau + cadangan JSON, konfirmasi ketik RESET + PIN owner, satu transaksi database,
// audit log TIDAK ikut dihapus dan reset itu sendiri dicatat. Bisa dimatikan dengan KPK_ALLOW_RESET=0.
//
// Dihapus : omzet harian (+ bon), semua jurnal (termasuk arsip jurnal sistem), aset tetap, SSPD, angka
//           Parang-ops, riwayat tutup buku, rincian saldo awal per pihak, pihak, event (+ catatan),
//           tahun buku selain yang pertama (+ teks CALK-nya).
// Diubah  : saldo awal semua akun → 0; bulan tutup buku tahun pertama → 0 (belum ada yang ditutup).
// Tetap   : daftar akun, pengguna & PIN, pengaturan tahun pertama, teks CALK tahun pertama, audit log.
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "../prismaClient";
import { SessionUser } from "../middleware/auth";
import { badRequest, forbidden, HttpError } from "../utils/httpError";
import { jsonSafe } from "../utils/money";
import { logAudit } from "./auditService";

type Db = Prisma.TransactionClient | typeof prisma;

export const resetEnabled = () => process.env.KPK_ALLOW_RESET !== "0";

function assertEnabled() {
  if (!resetEnabled()) throw forbidden("Fitur reset data dimatikan di server (KPK_ALLOW_RESET=0).");
}

async function firstSettings(db: Db) {
  const s = await db.setting.findFirst({ orderBy: { fiscalYear: "asc" } });
  if (!s) throw new HttpError(500, "Pengaturan tahun buku belum ada.");
  return s;
}

/** Jumlah baris per jenis. Query berurutan: fitur jarang dipakai dan pool koneksi Supabase (mode session) kecil. */
async function counts(db: Db) {
  const first = await firstSettings(db);
  const years = await db.setting.findMany({ where: { fiscalYear: { gt: first.fiscalYear } }, select: { fiscalYear: true } });
  return {
    firstYear: first.fiscalYear,
    closedMonth: first.closedMonth,
    dailySales: await db.dailySale.count(),
    staffBons: await db.dailyStaffBon.count(),
    manualJournals: await db.journalEntry.count({ where: { kind: "UMUM" } }),
    systemJournals: await db.journalEntry.count({ where: { kind: { not: "UMUM" } } }),
    assets: await db.fixedAsset.count(),
    taxFilings: await db.taxFiling.count(),
    opsFigures: await db.opsMonthlyFigure.count(),
    closings: await db.periodClosing.count(),
    openingDetails: await db.openingBalanceDetail.count(),
    parties: await db.party.count(),
    events: await db.event.count(),
    eventNotes: await db.eventNote.count(),
    openingBalances: await db.account.count({ where: { openingBalance: { not: 0n } } }),
    extraYears: years.map((y) => y.fiscalYear),
  };
}

type Counts = Awaited<ReturnType<typeof counts>>;

const isEmpty = (c: Counts) =>
  c.closedMonth === 0 && c.extraYears.length === 0 &&
  [c.dailySales, c.manualJournals, c.systemJournals, c.assets, c.taxFilings, c.opsFigures, c.closings,
    c.openingDetails, c.parties, c.events, c.eventNotes, c.openingBalances].every((n) => n === 0);

export async function resetPreview() {
  assertEnabled();
  const c = await counts(prisma);
  return { ...c, empty: isEmpty(c) };
}

/** Cadangan: semua baris yang akan dihapus/diubah, lengkap, sebagai JSON (nominal BigInt → string). */
export async function resetBackup() {
  assertEnabled();
  const db = prisma;
  return jsonSafe({
    kind: "kopi-parang-keuangan:reset-backup",
    createdAt: new Date().toISOString(),
    settings: await db.setting.findMany({ orderBy: { fiscalYear: "asc" } }),
    reportNotes: await db.reportNote.findMany(),
    accounts: await db.account.findMany({ orderBy: { code: "asc" } }),
    openingBalanceDetails: await db.openingBalanceDetail.findMany(),
    parties: await db.party.findMany(),
    events: await db.event.findMany(),
    eventNotes: await db.eventNote.findMany(),
    dailySales: await db.dailySale.findMany({ include: { staffBons: true }, orderBy: { date: "asc" } }),
    journalEntries: await db.journalEntry.findMany({ include: { lines: true }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
    fixedAssets: await db.fixedAsset.findMany(),
    taxFilings: await db.taxFiling.findMany(),
    opsMonthlyFigures: await db.opsMonthlyFigure.findMany(),
    periodClosings: await db.periodClosing.findMany(),
  });
}

export async function executeReset(user: SessionUser, body: { confirm?: unknown; pin?: unknown }) {
  assertEnabled();
  if (body.confirm !== "RESET") throw badRequest('Ketik "RESET" (huruf besar) untuk konfirmasi.');
  const owner = await prisma.user.findUnique({ where: { id: user.id } });
  if (!owner?.pinHash || !(await bcrypt.compare(String(body.pin ?? ""), owner.pinHash))) {
    throw badRequest("PIN salah.");
  }

  return prisma.$transaction(
    async (tx) => {
      const before = await counts(tx);
      if (isEmpty(before)) throw badRequest("Data sudah kosong; tidak ada yang perlu direset.");

      // Urutan mengikuti foreign key: transaksi dulu, master data terakhir.
      await tx.journalEntry.deleteMany({}); // journal_lines ikut (cascade)
      await tx.dailySale.deleteMany({}); // daily_staff_bons ikut (cascade)
      await tx.fixedAsset.deleteMany({});
      await tx.taxFiling.deleteMany({});
      await tx.opsMonthlyFigure.deleteMany({});
      await tx.periodClosing.deleteMany({});
      await tx.openingBalanceDetail.deleteMany({});
      await tx.eventNote.deleteMany({});
      await tx.event.deleteMany({});
      await tx.party.deleteMany({});
      await tx.reportNote.deleteMany({ where: { fiscalYear: { gt: before.firstYear } } });
      await tx.setting.deleteMany({ where: { fiscalYear: { gt: before.firstYear } } });
      await tx.setting.update({ where: { fiscalYear: before.firstYear }, data: { closedMonth: 0, updatedById: user.id } });
      await tx.account.updateMany({ data: { openingBalance: 0n } });

      // Audit log tidak dihapus; reset dicatat dengan jumlah baris per jenis (isi lengkap ada di file cadangan).
      await logAudit(tx, {
        userId: user.id, tableName: "data_reset", recordId: new Date().toISOString(), action: "VOID",
        before, after: await counts(tx),
      });
      return before;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
