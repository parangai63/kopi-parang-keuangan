// Controller: auth, pengguna, audit log, pengaturan, akun, pihak, event.
import { Request, Response } from "express";
import prisma from "../prismaClient";
import * as auth from "../services/authService";
import * as master from "../services/masterDataService";
import { clearSession, issueSession } from "../middleware/auth";
import { getActiveSettings, serializeSettings } from "../services/settingsService";
import { logAudit } from "../services/auditService";
import { badRequest } from "../utils/httpError";
import { parseAmount } from "../utils/money";

const intParam = (v: unknown, name: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw badRequest(`${name} tidak valid.`);
  return n;
};

// ---------- auth ----------
export async function postLogin(req: Request, res: Response) {
  const { email, password, totp } = req.body ?? {};
  if (!email || !password) throw badRequest("Email dan kata sandi wajib diisi.");
  const r = await auth.loginWithPassword(String(email), String(password), totp ? String(totp) : undefined);
  if ("needTotp" in r) return res.json({ needTotp: true });
  issueSession(res, r.user);
  res.json({ user: await auth.getMe(r.user.id) });
}
export async function getKasirList(_req: Request, res: Response) {
  res.json(await auth.listKasir());
}
export async function postPinLogin(req: Request, res: Response) {
  const { userId, pin } = req.body ?? {};
  const user = await auth.loginWithPin(intParam(userId, "Kasir"), String(pin ?? ""));
  issueSession(res, user);
  res.json({ user: await auth.getMe(user.id) });
}
export async function postLogout(_req: Request, res: Response) {
  clearSession(res);
  res.json({ ok: true });
}
export async function getMe(req: Request, res: Response) {
  res.json({ user: await auth.getMe(req.user!.id) });
}
export async function postTotpSetup(req: Request, res: Response) {
  res.json(await auth.startTotpSetup(req.user!));
}
export async function postTotpConfirm(req: Request, res: Response) {
  await auth.confirmTotpSetup(req.user!, String(req.body?.code ?? ""));
  res.json({ ok: true });
}

// ---------- pengguna & audit (owner) ----------
export async function getUsers(_req: Request, res: Response) {
  res.json(await auth.listUsers());
}
export async function postUser(req: Request, res: Response) {
  res.status(201).json({ id: await auth.saveUser(req.user!, null, req.body ?? {}) });
}
export async function putUser(req: Request, res: Response) {
  res.json({ id: await auth.saveUser(req.user!, intParam(req.params.id, "ID"), req.body ?? {}) });
}
export async function getAuditLogs(req: Request, res: Response) {
  res.json(
    await auth.listAuditLogs({
      table: req.query.table ? String(req.query.table) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
    }),
  );
}

// ---------- pengaturan ----------
export async function getSettings(_req: Request, res: Response) {
  res.json(serializeSettings(await getActiveSettings()));
}

const RATIO_FIELDS = [
  "pbjtRate", "foodCostLimit", "payrollLimit", "occupancyLimit", "primeCostLimit", "netMarginTarget",
  "opsPurchaseTolerancePct", "opsSalesTolerancePct",
] as const;

/** closedMonth TIDAK bisa diubah di sini — hanya lewat wizard Tutup Buku / buka kembali. */
export async function putSettings(req: Request, res: Response) {
  const before = await getActiveSettings();
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.businessName !== undefined) {
    if (!String(b.businessName).trim()) throw badRequest("Nama usaha wajib diisi.");
    data.businessName = String(b.businessName).trim();
  }
  for (const f of RATIO_FIELDS) {
    if (b[f] === undefined) continue;
    const n = Number(b[f]);
    if (!isFinite(n) || n < 0 || n > 1) throw badRequest(`${f} harus desimal 0–1 (mis. 0.35 untuk 35%).`);
    data[f] = n;
  }
  if (b.priceIncludesTax !== undefined) data.priceIncludesTax = Boolean(b.priceIncludesTax);
  if (b.accruePbjt !== undefined) data.accruePbjt = Boolean(b.accruePbjt);
  if (b.revenueTarget !== undefined) data.revenueTarget = parseAmount(b.revenueTarget, "Target omzet");
  if (b.cashDiffThreshold !== undefined) data.cashDiffThreshold = parseAmount(b.cashDiffThreshold, "Batas selisih tunai");
  const after = await prisma.setting.update({ where: { id: before.id }, data: { ...data, updatedById: req.user!.id } });
  await logAudit(prisma, { userId: req.user!.id, tableName: "settings", recordId: after.id, action: "UPDATE", before, after });
  res.json(serializeSettings(after));
}

// ---------- akun ----------
export async function getAccounts(_req: Request, res: Response) {
  res.json(await master.listAccounts());
}
export async function postAccount(req: Request, res: Response) {
  res.status(201).json({ id: await master.createAccount(req.user!, req.body ?? {}) });
}
export async function putAccount(req: Request, res: Response) {
  res.json({ id: await master.updateAccount(req.user!, intParam(req.params.id, "ID"), req.body ?? {}) });
}

// ---------- pihak ----------
export async function getParties(req: Request, res: Response) {
  res.json(
    await master.listParties({
      type: req.query.type ? String(req.query.type) : undefined,
      activeOnly: req.query.active === "1",
    }),
  );
}
export async function postParty(req: Request, res: Response) {
  res.status(201).json({ id: await master.upsertParty(req.user!, null, req.body ?? {}) });
}
export async function putParty(req: Request, res: Response) {
  res.json({ id: await master.upsertParty(req.user!, intParam(req.params.id, "ID"), req.body ?? {}) });
}

// ---------- event ----------
export async function getEventList(_req: Request, res: Response) {
  res.json(await master.listEvents());
}
export async function postEvent(req: Request, res: Response) {
  res.status(201).json({ id: await master.createEvent(req.user!, req.body ?? {}) });
}
