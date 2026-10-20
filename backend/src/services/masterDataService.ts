// Master data: Daftar Akun, Pihak (karyawan & supplier), Event.
import { AccountGroup, CashCategory, NormalSide, PartyType, Prisma } from "@prisma/client";
import prisma from "../prismaClient";
import { SessionUser } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { parseAmount, toNum0 } from "../utils/money";
import { fromISODate, toISODate } from "../utils/dates";
import { logAudit } from "./auditService";

const ACCOUNT_GROUPS = Object.values(AccountGroup) as string[];
const CASH_CATEGORIES = Object.values(CashCategory) as string[];
const CASH_FLOW_LINES = ["OP1", "OP2", "OP3", "OP4", "OP5", "OP6", "OP7", "IN1", "FN1", "FN2", "FN3"];
const PARTY_TYPES = Object.values(PartyType) as string[];

// ---------- akun ----------
export async function listAccounts() {
  const rows = await prisma.account.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { journalLines: true } } },
  });
  return rows.map((a) => ({
    id: a.id, code: a.code, name: a.name, group: a.group, reportLine: a.reportLine, normalSide: a.normalSide,
    cashCategory: a.cashCategory, cashFlowLine: a.cashFlowLine, openingBalance: toNum0(a.openingBalance),
    description: a.description, isActive: a.isActive, isUsed: a._count.journalLines > 0,
  }));
}

export interface AccountInput {
  code?: string;
  name?: string;
  group?: string;
  reportLine?: string | null;
  normalSide?: string;
  cashCategory?: string;
  cashFlowLine?: string | null;
  openingBalance?: unknown;
  description?: string | null;
  isActive?: boolean;
}

function validateAccount(i: AccountInput, partial: boolean): Prisma.AccountUpdateInput {
  const data: Prisma.AccountUpdateInput = {};
  if (!partial || i.code !== undefined) {
    if (!i.code?.trim()) throw badRequest("Kode akun wajib diisi.");
    data.code = i.code.trim();
  }
  if (!partial || i.name !== undefined) {
    if (!i.name?.trim()) throw badRequest("Nama akun wajib diisi.");
    data.name = i.name.trim();
  }
  if (!partial || i.group !== undefined) {
    if (!ACCOUNT_GROUPS.includes(i.group ?? "")) throw badRequest("Kelompok akun tidak valid.");
    data.group = i.group as AccountGroup;
  }
  if (!partial || i.normalSide !== undefined) {
    if (i.normalSide !== "D" && i.normalSide !== "K") throw badRequest("Saldo normal harus D atau K.");
    data.normalSide = i.normalSide as NormalSide;
  }
  if (!partial || i.cashCategory !== undefined) {
    if (!CASH_CATEGORIES.includes(i.cashCategory ?? "")) throw badRequest("Kategori arus kas tidak valid.");
    data.cashCategory = i.cashCategory as CashCategory;
  }
  if (i.cashFlowLine !== undefined) {
    if (i.cashFlowLine && !CASH_FLOW_LINES.includes(i.cashFlowLine)) throw badRequest("Baris arus kas tidak valid.");
    data.cashFlowLine = i.cashFlowLine || null;
  }
  if (i.openingBalance !== undefined) {
    data.openingBalance = parseAmount(i.openingBalance, "Saldo awal", { allowNull: true }) ?? 0n;
  }
  if (i.reportLine !== undefined) data.reportLine = i.reportLine || null;
  if (i.description !== undefined) data.description = i.description || null;
  if (i.isActive !== undefined) data.isActive = Boolean(i.isActive);
  return data;
}

export async function createAccount(user: SessionUser, i: AccountInput) {
  const data = validateAccount(i, false) as Prisma.AccountCreateInput;
  const row = await prisma.account.create({ data });
  await logAudit(prisma, { userId: user.id, tableName: "accounts", recordId: row.id, action: "CREATE", after: row });
  return row.id;
}

/** Akun yang sudah dipakai tidak boleh dihapus — hanya dinonaktifkan (isActive=false). */
export async function updateAccount(user: SessionUser, id: number, i: AccountInput) {
  const before = await prisma.account.findUnique({ where: { id } });
  if (!before) throw notFound("Akun tidak ditemukan.");
  const data = validateAccount(i, true);
  const used = (await prisma.journalLine.count({ where: { accountId: id } })) > 0;
  if (used && ((data.normalSide && data.normalSide !== before.normalSide) || (data.group && data.group !== before.group))) {
    throw badRequest("Akun yang sudah dipakai tidak boleh diubah kelompok atau saldo normalnya.");
  }
  if (used && data.name && data.name !== before.name) {
    // Mesin hitung merujuk akun inti berdasarkan nama (lihat ACC di engine.ts).
    throw badRequest("Nama akun yang sudah dipakai tidak boleh diubah.");
  }
  const row = await prisma.account.update({ where: { id }, data });
  await logAudit(prisma, { userId: user.id, tableName: "accounts", recordId: id, action: "UPDATE", before, after: row });
  return id;
}

// ---------- pihak ----------
export async function listParties(opts: { type?: string; activeOnly?: boolean } = {}) {
  const rows = await prisma.party.findMany({
    where: {
      ...(opts.type && PARTY_TYPES.includes(opts.type) ? { type: opts.type as PartyType } : {}),
      ...(opts.activeOnly ? { isActive: true } : {}),
    },
    orderBy: { name: "asc" },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, type: p.type, isActive: p.isActive }));
}

export async function upsertParty(
  user: SessionUser,
  id: number | null,
  i: { name?: string; type?: string; isActive?: boolean },
) {
  const data: Prisma.PartyUpdateInput = {};
  if (!id || i.name !== undefined) {
    const name = (i.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw badRequest("Nama wajib diisi. Ejaan harus sama dengan master Staff/Suppliers di Parang-ops.");
    data.name = name;
  }
  if (!id || i.type !== undefined) {
    if (!PARTY_TYPES.includes(i.type ?? "")) throw badRequest("Jenis pihak tidak valid.");
    data.type = i.type as PartyType;
  }
  if (i.isActive !== undefined) data.isActive = Boolean(i.isActive);
  if (id) {
    const before = await prisma.party.findUnique({ where: { id } });
    if (!before) throw notFound("Pihak tidak ditemukan.");
    const row = await prisma.party.update({ where: { id }, data });
    await logAudit(prisma, { userId: user.id, tableName: "parties", recordId: id, action: "UPDATE", before, after: row });
    return id;
  }
  const row = await prisma.party.create({ data: data as Prisma.PartyCreateInput });
  await logAudit(prisma, { userId: user.id, tableName: "parties", recordId: row.id, action: "CREATE", after: row });
  return row.id;
}

// ---------- event ----------
export async function listEvents() {
  const rows = await prisma.event.findMany({ orderBy: [{ startDate: "asc" }, { name: "asc" }] });
  return rows.map((e) => ({
    id: e.id, name: e.name, startDate: e.startDate ? toISODate(e.startDate) : null, notes: e.notes,
  }));
}

export async function createEvent(user: SessionUser, i: { name?: string; startDate?: string | null; notes?: string | null }) {
  const name = (i.name ?? "").trim();
  if (!name) throw badRequest("Nama event wajib diisi.");
  const row = await prisma.event.create({
    data: { name, startDate: i.startDate ? fromISODate(i.startDate) : null, notes: i.notes || null },
  });
  await logAudit(prisma, { userId: user.id, tableName: "events", recordId: row.id, action: "CREATE", after: row });
  return row.id;
}
