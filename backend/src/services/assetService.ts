import prisma from "../prismaClient";
import { SessionUser } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { fromISODate, toISODate } from "../utils/dates";
import { parseAmount } from "../utils/money";
import { assertDateOpen, getActiveSettings } from "./settingsService";
import { computeLedger } from "./ledgerService";
import { logAudit } from "./auditService";

/** Daftar aset + jadwal penyusutan (dihitung mesin, Logika 8). */
export async function listAssets() {
  const { result } = await computeLedger();
  const assets = result.assets;
  return {
    closedMonth: result.closedMonth,
    year: result.year,
    assets,
    totals: {
      cost: assets.reduce((s, a) => s + a.cost, 0),
      accumulated: assets.reduce((s, a) => s + a.accumulated, 0),
      bookValue: assets.reduce((s, a) => s + a.bookValue, 0),
    },
    // Cek spesifikasi: total harga = saldo Peralatan, total akumulasi = saldo Akumulasi Penyusutan.
    ledgerCheck: {
      equipmentBalance: result.closingBalance["Peralatan"],
      accumulatedBalance: -result.closingBalance["Akumulasi Penyusutan Peralatan"],
    },
  };
}

interface AssetInput {
  name?: string;
  acquiredOn?: string;
  cost?: unknown;
  usefulLifeYears?: unknown;
}

/** Aset hanya bisa ditambah/diubah jika tanggal perolehannya di bulan yang belum ditutup,
 * supaya penyusutan bulan yang sudah dikunci tidak ikut berubah. */
async function validate(i: AssetInput) {
  const s = await getActiveSettings();
  const name = (i.name ?? "").trim();
  if (!name) throw badRequest("Nama aset wajib diisi.");
  if (!i.acquiredOn) throw badRequest("Tanggal perolehan wajib diisi.");
  const acquiredOn = fromISODate(i.acquiredOn);
  assertDateOpen(s, i.acquiredOn);
  const cost = parseAmount(i.cost, "Harga perolehan", { positive: true })!;
  const life = Number(i.usefulLifeYears);
  if (!Number.isInteger(life) || life < 1 || life > 50) throw badRequest("Masa manfaat harus 1–50 tahun.");
  const account = await prisma.account.findUnique({ where: { name: "Peralatan" } });
  return { name, acquiredOn, cost, usefulLifeYears: life, accountId: account?.id ?? null };
}

export async function createAsset(user: SessionUser, i: AssetInput) {
  const data = await validate(i);
  const row = await prisma.fixedAsset.create({ data: { ...data, createdById: user.id, updatedById: user.id } });
  await logAudit(prisma, { userId: user.id, tableName: "fixed_assets", recordId: row.id, action: "CREATE", after: row });
  return row.id;
}

async function loadEditable(id: number) {
  const s = await getActiveSettings();
  const before = await prisma.fixedAsset.findUnique({ where: { id } });
  if (!before || before.voidedAt) throw notFound("Aset tidak ditemukan.");
  assertDateOpen(s, toISODate(before.acquiredOn));
  return before;
}

export async function updateAsset(user: SessionUser, id: number, i: AssetInput) {
  const before = await loadEditable(id);
  const data = await validate(i);
  const row = await prisma.fixedAsset.update({ where: { id }, data: { ...data, updatedById: user.id } });
  await logAudit(prisma, { userId: user.id, tableName: "fixed_assets", recordId: id, action: "UPDATE", before, after: row });
  return id;
}

export async function voidAsset(user: SessionUser, id: number) {
  const before = await loadEditable(id);
  const row = await prisma.fixedAsset.update({ where: { id }, data: { voidedAt: new Date(), updatedById: user.id } });
  await logAudit(prisma, { userId: user.id, tableName: "fixed_assets", recordId: id, action: "VOID", before, after: row });
  return id;
}
