// Daftar pilihan tetap yang dipakai di beberapa dropdown.
import type { PartyType } from "../types";

export const PARTY_TYPES: [PartyType, string][] = [
  ["KARYAWAN", "Karyawan"], ["SUPPLIER", "Supplier"], ["PEMBERI_PINJAMAN", "Pemberi pinjaman"], ["OWNER", "Owner"], ["LAINNYA", "Lainnya"],
];

export const PARTY_TYPE_OPTIONS = PARTY_TYPES.map(([value, label]) => ({ value, label }));

/**
 * Kode akun beban baru berikutnya (61xx). Server hanya menerima akun baru berupa beban usaha 61xx
 * (supaya otomatis tampil di Laba Rugi), jadi dari dropdown akun kodenya dibuat otomatis.
 */
export function nextExpenseCode(codes: string[]): string {
  const used = new Set(codes);
  for (let n = 6101; n <= 6199; n++) if (!used.has(String(n))) return String(n);
  throw new Error("Kode akun beban 6101–6199 sudah habis. Tambahkan akun lewat Pengaturan.");
}
