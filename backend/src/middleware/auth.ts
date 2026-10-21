import { NextFunction, Request, Response } from "express";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "../prismaClient";
import { HttpError, forbidden } from "../utils/httpError";

// Sesi = JWT di cookie httpOnly. Nama cookie & rahasia SENGAJA beda dengan Parang-ops
// (spesifikasi: tidak ada login bersama / SSO).
export const SESSION_COOKIE = "kpk_session";

/** Sesi berakhir setelah tidak aktif: 12 jam (owner/admin), 8 jam (kasir). */
const IDLE_HOURS: Record<Role, number> = { OWNER: 12, ADMIN: 12, KASIR: 8 };

export interface SessionUser {
  id: number;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

// Di development tidak perlu diset: dibuat acak tiap server start (sesi login hilang saat restart).
// Di production WAJIB diset, karena server bisa berjalan di beberapa instance (mis. Vercel).
let devSecret: string | undefined;
function secret(): string {
  const s = process.env.KPK_SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("KPK_SESSION_SECRET wajib diset di production (min. 16 karakter).");
  }
  return (devSecret ??= randomBytes(32).toString("hex"));
}

export function issueSession(res: Response, user: SessionUser) {
  const hours = IDLE_HOURS[user.role];
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, secret(), { expiresIn: `${hours}h` });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: hours * 3600 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Wajib login. Mengecek ulang user di database (supaya penonaktifan langsung berlaku)
 * dan memperpanjang sesi (sliding expiration = batas tidak aktif). */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new HttpError(401, "Silakan masuk terlebih dahulu.");
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, secret()) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, "Sesi berakhir. Silakan masuk lagi.");
    }
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user || !user.isActive) throw new HttpError(401, "Akun tidak aktif.");
    req.user = { id: user.id, name: user.name, role: user.role };
    issueSession(res, req.user);
    next();
  } catch (err) {
    next(err);
  }
}

/** Hak akses dicek di server untuk setiap permintaan (bukan hanya disembunyikan di UI). */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Silakan masuk terlebih dahulu."));
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
