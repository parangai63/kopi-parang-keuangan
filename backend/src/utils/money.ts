import { Prisma } from "@prisma/client";
import { badRequest } from "./httpError";

// Nominal disimpan BigInt di database, tapi JSON & mesin hitung memakai number.
// Integer Rupiah aman sampai 9 kuadriliun (Number.MAX_SAFE_INTEGER).

export const toNum = (v: bigint | number | null | undefined): number | null =>
  v == null ? null : Number(v);

export const toNum0 = (v: bigint | number | null | undefined): number => (v == null ? 0 : Number(v));

export const decToNum = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

/** Validasi input nominal dari klien: null/'' = kosong, selain itu integer ≥ 0. */
export function parseAmount(v: unknown, field: string, opts: { allowNull?: boolean; positive?: boolean } = {}): bigint | null {
  if (v === null || v === undefined || v === "") {
    if (opts.allowNull) return null;
    throw badRequest(`${field} wajib diisi.`);
  }
  const n = typeof v === "string" ? Number(v.replace(/[^\d-]/g, "")) : Number(v);
  if (!Number.isSafeInteger(n)) throw badRequest(`${field} harus bilangan bulat Rupiah.`);
  if (n < 0) throw badRequest(`${field} tidak boleh negatif.`);
  if (opts.positive && n <= 0) throw badRequest(`${field} harus lebih dari 0.`);
  return BigInt(n);
}

export function parseCount(v: unknown, field: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0) throw badRequest(`${field} harus bilangan bulat ≥ 0.`);
  return n;
}

/** BigInt → number secara rekursif, untuk audit_logs (JSON) dan response. */
export function jsonSafe<T>(obj: T): unknown {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}
