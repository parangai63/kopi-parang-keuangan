// Controller modul input: Omzet Harian, Jurnal, Aset Tetap, Tutup Buku.
// Tipis: validasi parameter dasar → panggil service → JSON.
import { Request, Response } from "express";
import * as daily from "../services/dailySalesService";
import * as journal from "../services/journalService";
import * as assets from "../services/assetService";
import * as closing from "../services/closingService";
import { badRequest } from "../utils/httpError";

const intParam = (v: unknown, name: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw badRequest(`${name} tidak valid.`);
  return n;
};
const optInt = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));

// ---------- omzet harian ----------
export async function getDailyMonth(req: Request, res: Response) {
  res.json(await daily.listMonth(intParam(req.query.month, "Bulan")));
}
export async function getKasirOverview(_req: Request, res: Response) {
  res.json(await daily.kasirOverview());
}
export async function putDaily(req: Request, res: Response) {
  res.json(await daily.upsertDay(req.user!, req.params.date, req.body ?? {}));
}
export async function postDailyVerify(req: Request, res: Response) {
  res.json(await daily.verifyDay(req.user!, req.params.date));
}

// ---------- jurnal ----------
export async function getJournal(req: Request, res: Response) {
  const q = req.query;
  res.json(
    await journal.listJournal({
      q: q.q ? String(q.q) : undefined,
      month: optInt(q.month),
      account: q.account ? String(q.account) : undefined,
      event: q.event ? String(q.event) : undefined,
      kind: q.kind === "UMUM" || q.kind === "AUTO" ? q.kind : undefined,
      page: optInt(q.page),
      pageSize: optInt(q.pageSize),
    }),
  );
}
export async function getJournalById(req: Request, res: Response) {
  res.json(await journal.getJournal(intParam(req.params.id, "ID")));
}
export async function postJournal(req: Request, res: Response) {
  res.status(201).json(await journal.createJournal(req.user!, req.body ?? {}));
}
export async function putJournal(req: Request, res: Response) {
  res.json(await journal.updateJournal(req.user!, intParam(req.params.id, "ID"), req.body ?? {}));
}
export async function postJournalVoid(req: Request, res: Response) {
  res.json(await journal.voidJournal(req.user!, intParam(req.params.id, "ID")));
}

// ---------- aset tetap ----------
export async function getAssets(_req: Request, res: Response) {
  res.json(await assets.listAssets());
}
export async function postAsset(req: Request, res: Response) {
  res.status(201).json({ id: await assets.createAsset(req.user!, req.body ?? {}) });
}
export async function putAsset(req: Request, res: Response) {
  res.json({ id: await assets.updateAsset(req.user!, intParam(req.params.id, "ID"), req.body ?? {}) });
}
export async function postAssetVoid(req: Request, res: Response) {
  res.json({ id: await assets.voidAsset(req.user!, intParam(req.params.id, "ID")) });
}

// ---------- tutup buku ----------
export async function getClosingPreview(_req: Request, res: Response) {
  res.json(await closing.closingPreview());
}
export async function getClosingHistory(_req: Request, res: Response) {
  res.json(await closing.closingHistory());
}
export async function putTaxFiling(req: Request, res: Response) {
  res.json({ id: await closing.saveTaxFiling(req.user!, intParam(req.params.month, "Bulan"), req.body ?? {}) });
}
export async function putOpsFigures(req: Request, res: Response) {
  res.json({ id: await closing.saveOpsFigures(req.user!, intParam(req.params.month, "Bulan"), req.body ?? {}) });
}
export async function postClose(req: Request, res: Response) {
  res.json(await closing.closeMonth(req.user!, req.body ?? {}));
}
export async function postReopen(req: Request, res: Response) {
  res.json(await closing.reopenMonth(req.user!));
}
