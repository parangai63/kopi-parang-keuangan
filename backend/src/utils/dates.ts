import { badRequest } from "./httpError";

// Kolom @db.Date dibaca Prisma sebagai Date jam 00:00 UTC. Semua tanggal bisnis
// diperlakukan sebagai string 'YYYY-MM-DD' supaya tidak bergeser zona waktu.

export const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

export function fromISODate(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw badRequest(`Format tanggal harus YYYY-MM-DD: ${s}`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (isNaN(d.getTime()) || toISODate(d) !== s) throw badRequest(`Tanggal tidak valid: ${s}`);
  return d;
}

/** Tanggal hari ini di Solo (WIB, UTC+7). */
export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export const monthOf = (iso: string) => Number(iso.slice(5, 7));
export const yearOf = (iso: string) => Number(iso.slice(0, 4));

export function daysInMonth(year: number, month: number): string[] {
  const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
}
