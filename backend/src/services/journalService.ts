import { Prisma } from "@prisma/client";
import prisma from "../prismaClient";
import { SessionUser } from "../middleware/auth";
import { LedgerEntry } from "../engine/types";
import { badRequest, notFound } from "../utils/httpError";
import { fromISODate, monthOf, toISODate } from "../utils/dates";
import { parseAmount, toNum0 } from "../utils/money";
import { assertDateOpen, getActiveSettings } from "./settingsService";
import { computeLedger } from "./ledgerService";
import { logAudit } from "./auditService";

export interface JournalFilters {
  q?: string;
  month?: number;
  account?: string;
  event?: string;
  kind?: "UMUM" | "AUTO";
  page?: number;
  pageSize?: number;
}

/** Daftar jurnal = jurnal UMUM dari database + jurnal sistem yang dihitung ulang mesin. */
export async function listJournal(f: JournalFilters) {
  const { result } = await computeLedger();
  let rows: LedgerEntry[] = result.manualJournal.concat(result.autoJournal).filter((j) => j.year === result.year);
  if (f.month) rows = rows.filter((j) => j.month === f.month);
  if (f.account) rows = rows.filter((j) => j.debit === f.account || j.credit === f.account);
  if (f.event) rows = rows.filter((j) => j.event === f.event);
  if (f.kind) rows = rows.filter((j) => (f.kind === "UMUM" ? j.kind === "UMUM" : j.kind !== "UMUM"));
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter((j) => `${j.description} ${j.voucherNo} ${j.party} ${j.receiptNo}`.toLowerCase().includes(q));
  }
  rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      Number(a.kind === "UMUM") - Number(b.kind === "UMUM") ||
      b.voucherNo.localeCompare(a.voucherNo),
  );
  const pageSize = Math.min(Math.max(f.pageSize ?? 50, 1), 500);
  const page = Math.max(f.page ?? 1, 1);
  return {
    total: rows.length,
    totalAmount: rows.reduce((s, j) => s + j.amount, 0),
    page,
    pageSize,
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
  };
}

interface JournalInput {
  date?: string;
  debitAccountId?: number;
  creditAccountId?: number;
  amount?: unknown;
  description?: string;
  receiptNo?: string;
  eventId?: number | null;
  partyId?: number | null;
}

async function validate(input: JournalInput) {
  const s = await getActiveSettings();
  if (!input.date) throw badRequest("Tanggal wajib diisi.");
  const date = fromISODate(input.date);
  assertDateOpen(s, input.date);
  const debitId = Number(input.debitAccountId);
  const creditId = Number(input.creditAccountId);
  if (!debitId || !creditId) throw badRequest("Pilih akun debet dan akun kredit.");
  if (debitId === creditId) throw badRequest("Akun debet dan akun kredit tidak boleh sama.");
  const accounts = await prisma.account.findMany({ where: { id: { in: [debitId, creditId] }, isActive: true } });
  if (accounts.length !== 2) throw badRequest("Akun tidak ditemukan atau tidak aktif.");
  const amount = parseAmount(input.amount, "Nominal", { positive: true })!;
  const description = (input.description ?? "").trim();
  if (!description) throw badRequest("Isi keterangan agar transaksi mudah dicari nanti.");
  return {
    date, debitId, creditId, amount, description,
    receiptNo: input.receiptNo?.trim() || null,
    eventId: input.eventId ? Number(input.eventId) : null,
    partyId: input.partyId ? Number(input.partyId) : null,
  };
}

async function nextVoucherNo(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(voucher_no FROM 4) AS INTEGER)) AS max
    FROM journal_entries WHERE voucher_no ~ '^JU-[0-9]+$'`;
  const next = (rows[0]?.max ?? 0) + 1;
  return `JU-${String(next).padStart(4, "0")}`;
}

const include = { lines: { include: { account: true } }, event: true, party: true } as const;

export async function createJournal(user: SessionUser, input: JournalInput) {
  const v = await validate(input);
  // Retry kecil jika dua admin menyimpan bersamaan dan nomor bukti bentrok (unique).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const voucherNo = await nextVoucherNo(tx);
        const entry = await tx.journalEntry.create({
          data: {
            voucherNo, date: v.date, description: v.description, receiptNo: v.receiptNo, kind: "UMUM",
            eventId: v.eventId, partyId: v.partyId, createdById: user.id, updatedById: user.id,
            lines: {
              create: [
                { accountId: v.debitId, debit: v.amount, credit: 0n },
                { accountId: v.creditId, debit: 0n, credit: v.amount },
              ],
            },
          },
          include,
        });
        await logAudit(tx, { userId: user.id, tableName: "journal_entries", recordId: entry.id, action: "CREATE", after: entry });
        return { id: entry.id, voucherNo };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("Gagal membuat nomor bukti.");
}

export async function updateJournal(user: SessionUser, id: number, input: JournalInput) {
  const s = await getActiveSettings();
  const existing = await prisma.journalEntry.findUnique({ where: { id }, include });
  if (!existing || existing.voidedAt) throw notFound("Jurnal tidak ditemukan.");
  if (existing.kind !== "UMUM") throw badRequest("Jurnal sistem tidak bisa diedit manual.");
  assertDateOpen(s, toISODate(existing.date));
  const v = await validate(input);
  return prisma.$transaction(async (tx) => {
    await tx.journalLine.deleteMany({ where: { entryId: id } });
    const entry = await tx.journalEntry.update({
      where: { id },
      data: {
        date: v.date, description: v.description, receiptNo: v.receiptNo, eventId: v.eventId, partyId: v.partyId,
        updatedById: user.id,
        lines: {
          create: [
            { accountId: v.debitId, debit: v.amount, credit: 0n },
            { accountId: v.creditId, debit: 0n, credit: v.amount },
          ],
        },
      },
      include,
    });
    await logAudit(tx, { userId: user.id, tableName: "journal_entries", recordId: id, action: "UPDATE", before: existing, after: entry });
    return { id, voucherNo: entry.voucherNo };
  });
}

/** Hapus = soft delete (voided_at). Hanya owner. */
export async function voidJournal(user: SessionUser, id: number) {
  const s = await getActiveSettings();
  const existing = await prisma.journalEntry.findUnique({ where: { id }, include });
  if (!existing || existing.voidedAt) throw notFound("Jurnal tidak ditemukan.");
  if (existing.kind !== "UMUM") throw badRequest("Jurnal sistem tidak bisa dibatalkan manual.");
  assertDateOpen(s, toISODate(existing.date));
  await prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.update({ where: { id }, data: { voidedAt: new Date(), voidedById: user.id } });
    await logAudit(tx, { userId: user.id, tableName: "journal_entries", recordId: id, action: "VOID", before: existing, after: entry });
  });
  return { id, voucherNo: existing.voucherNo };
}

export async function getJournal(id: number) {
  const e = await prisma.journalEntry.findUnique({ where: { id }, include });
  if (!e || e.voidedAt) throw notFound("Jurnal tidak ditemukan.");
  const d = e.lines.find((l) => l.debit > 0n)!;
  const c = e.lines.find((l) => l.credit > 0n)!;
  return {
    id: e.id, voucherNo: e.voucherNo, date: toISODate(e.date), month: monthOf(toISODate(e.date)),
    debitAccountId: d.accountId, creditAccountId: c.accountId, amount: toNum0(d.debit),
    description: e.description, receiptNo: e.receiptNo, eventId: e.eventId, partyId: e.partyId,
  };
}
