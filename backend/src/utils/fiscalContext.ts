// Tahun buku yang dipilih pengguna untuk satu permintaan (header `X-Fiscal-Year` dari frontend).
// Disimpan di AsyncLocalStorage supaya getActiveSettings() di semua service otomatis memakai tahun itu
// tanpa harus meneruskan `req` ke setiap fungsi. Tanpa header = tahun buku terbaru.
import { AsyncLocalStorage } from "async_hooks";
import { NextFunction, Request, Response } from "express";

const store = new AsyncLocalStorage<{ year?: number }>();

export function fiscalYearMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = req.header("x-fiscal-year");
  const year = raw && /^\d{4}$/.test(raw) ? Number(raw) : undefined;
  store.run({ year }, () => next());
}

/** Tahun buku yang diminta untuk permintaan ini, atau undefined (= terbaru). */
export const requestedFiscalYear = () => store.getStore()?.year;
