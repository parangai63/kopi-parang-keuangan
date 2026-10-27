import type { Role } from "./index";

export type PageId = "dashboard" | "omzet" | "kasir" | "jurnal" | "laporan" | "analisis" | "aset" | "pihak" | "tutup-buku" | "pengaturan" | "pengguna";

export interface NavItem {
  id: PageId;
  label: string;
  roles: Role[];
}

/** Menu per peran — cermin tabel hak akses di spesifikasi. Server tetap mengecek ulang. */
export const NAV: NavItem[] = [
  { id: "dashboard", label: "Ringkasan", roles: ["OWNER", "ADMIN"] },
  { id: "kasir", label: "Omzet Hari Ini", roles: ["KASIR"] },
  { id: "omzet", label: "Omzet Harian", roles: ["OWNER", "ADMIN"] },
  { id: "jurnal", label: "Jurnal", roles: ["OWNER", "ADMIN"] },
  { id: "laporan", label: "Laporan", roles: ["OWNER", "ADMIN"] },
  { id: "analisis", label: "Analisis", roles: ["OWNER", "ADMIN"] },
  { id: "aset", label: "Aset Tetap", roles: ["OWNER", "ADMIN"] },
  { id: "pihak", label: "Pihak", roles: ["OWNER", "ADMIN"] },
  { id: "tutup-buku", label: "Tutup Buku", roles: ["OWNER", "ADMIN"] },
  { id: "pengaturan", label: "Akun & Pengaturan", roles: ["OWNER", "ADMIN"] },
  { id: "pengguna", label: "Pengguna & Riwayat", roles: ["OWNER"] },
];
