// Daftar akun awal (35 akun, Lampiran spesifikasi). Struktur akun sama dengan Excel v2;
// saldo awal di sini adalah angka DUMMY untuk seed.ts. Saldo awal data asli ada di prototype/data.js.
import type { AccountGroup, CashCategory, NormalSide } from "../src/engine/types";

export interface ChartAccount {
  code: string;
  name: string;
  group: AccountGroup;
  normal: NormalSide;
  cashCategory: CashCategory;
  cashFlowLine: string | null;
  openingBalance: number;
}

const a = (
  code: string, name: string, group: AccountGroup, normal: NormalSide,
  cashCategory: CashCategory, cashFlowLine: string | null, openingBalance = 0,
): ChartAccount => ({ code, name, group, normal, cashCategory, cashFlowLine, openingBalance });

export const CHART_OF_ACCOUNTS: ChartAccount[] = [
  a("1101", "Kas Tunai", "ASET", "D", "KAS", null, 10_000_000),
  a("1102", "Kas Bank", "ASET", "D", "KAS", null, 50_000_000),
  a("1103", "Kas Warung", "ASET", "D", "KAS", null, 2_000_000),
  a("1201", "Piutang Usaha Cafe", "ASET", "D", "OPERASI", "OP1"),
  a("1202", "Piutang Usaha non Cafe", "ASET", "D", "OPERASI", "OP1"),
  a("1203", "Piutang Lainnya", "ASET", "D", "OPERASI", "OP2", 1_000_000),
  a("1301", "Inventori", "ASET", "D", "OPERASI", "OP3"),
  a("1302", "Perlengkapan", "ASET", "D", "OPERASI", "OP6"),
  a("1303", "Beban Dibayar di Muka", "ASET", "D", "OPERASI", "OP6"),
  a("1501", "Peralatan", "ASET", "D", "INVESTASI", "IN1"),
  a("1502", "Akumulasi Penyusutan Peralatan", "ASET", "K", "NONKAS", null),
  a("2101", "Utang Usaha Lancar", "LIABILITAS", "K", "OPERASI", "OP6"),
  a("2102", "Utang Pajak Daerah (PBJT)", "LIABILITAS", "K", "OPERASI", "OP7"),
  a("2103", "Utang Lainnya", "LIABILITAS", "K", "PENDANAAN", "FN3", 2_000_000),
  a("2201", "Utang Usaha Jangka Panjang", "LIABILITAS", "K", "PENDANAAN", "FN3", 1_000_000),
  a("3101", "Ekuitas Kopi Parang", "EKUITAS", "K", "PENDANAAN", "FN2"),
  a("3102", "Prive", "EKUITAS", "D", "PENDANAAN", "FN1"),
  a("4101", "Pendapatan Cafe", "PENDAPATAN", "K", "OPERASI", "OP1"),
  a("4102", "Pendapatan non Cafe", "PENDAPATAN", "K", "OPERASI", "OP1"),
  a("4901", "Pajak Restoran", "PENDAPATAN", "D", "OPERASI", "OP7"),
  a("5101", "Biaya Bahan Baku", "BEBAN", "D", "OPERASI", "OP3"),
  a("5102", "Biaya Penyajian", "BEBAN", "D", "OPERASI", "OP3"),
  a("6101", "Beban Gaji", "BEBAN", "D", "OPERASI", "OP4"),
  a("6102", "Biaya Sewa Tempat", "BEBAN", "D", "OPERASI", "OP5"),
  a("6103", "Biaya Tagihan Bulanan", "BEBAN", "D", "OPERASI", "OP6"),
  a("6104", "Biaya Marketing & Promosi", "BEBAN", "D", "OPERASI", "OP6"),
  a("6105", "Beban Perlengkapan", "BEBAN", "D", "OPERASI", "OP6"),
  a("6106", "Biaya Operasional Harian", "BEBAN", "D", "OPERASI", "OP6"),
  a("6107", "Biaya Pemeliharaan", "BEBAN", "D", "OPERASI", "OP6"),
  a("6108", "Biaya Compliment", "BEBAN", "D", "OPERASI", "OP6"),
  a("6109", "Biaya R&D", "BEBAN", "D", "OPERASI", "OP6"),
  a("6110", "Dana Sosial & CSR", "BEBAN", "D", "OPERASI", "OP6"),
  a("6111", "Beban Penyusutan Peralatan", "BEBAN", "D", "NONKAS", null),
  a("7101", "Pendapatan Lainnya", "PENDAPATAN", "K", "OPERASI", "OP2"),
  a("7201", "Biaya Lainnya", "BEBAN", "D", "OPERASI", "OP2"),
];
