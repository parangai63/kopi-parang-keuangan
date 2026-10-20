import { NextFunction, Request, RequestHandler, Response } from "express";
import { Prisma } from "@prisma/client";

/** Error dengan HTTP status. 400 validasi, 401 belum login, 403 tidak berhak,
 * 404 tidak ditemukan, 409 konflik, 423 bulan sudah ditutup (terkunci). */
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const notFound = (msg: string) => new HttpError(404, msg);
export const forbidden = (msg = "Anda tidak punya akses untuk tindakan ini.") => new HttpError(403, msg);
export const locked = (msg: string) => new HttpError(423, msg);

/** Membungkus handler async supaya error otomatis diteruskan ke errorMiddleware. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return res.status(409).json({ message: "Data dengan nilai unik yang sama sudah ada.", details: err.meta });
  }
  console.error(err);
  res.status(500).json({ message: "Terjadi kesalahan di server." });
}
