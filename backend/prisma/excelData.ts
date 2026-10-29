// Membaca file Excel v2 (KOPI_PARANG_LAPORAN_KEUANGAN_2026_v2.xlsx) langsung — skrip migrasi resmi
// (docs/SPESIFIKASI.md bagian Migrasi). Hanya kolom INPUT yang diambil; kolom rumus dibiarkan karena
// mesin hitung membuatnya ulang. Jurnal OTOMATIS/PENYESUAIAN tidak diimpor.
//
// Nilai sel dibaca dari hasil hitung terakhir yang tersimpan di file (cached value), jadi file harus
// pernah disimpan dari Excel/Google Sheets setelah rumusnya dihitung.
import path from "path";
import * as XLSX from "xlsx";
import { compute } from "../src/engine/engine";
import type { AccountGroup, CashCategory, EngineInput, NormalSide } from "../src/engine/types";

export const DEFAULT_EXCEL_FILE = path.resolve(__dirname, "../../KOPI_PARANG_LAPORAN_KEUANGAN_2026_v2.xlsx");

/** Pihak pengganti untuk bon karyawan lama yang di Excel hanya total per hari. */
export const LEGACY_BON_PARTY = "Bon karyawan (data Excel)";

export interface ExcelV2 {
  input: EngineInput;
  revenueTarget: number;
  limits: { foodCost: number; payroll: number; occupancy: number; primeCost: number; netMargin: number };
  /** kolom "Pos Laporan" & "Keterangan" sheet AKUN, per kode akun */
  accountMeta: Record<string, { reportLine: string | null; description: string | null }>;
  /** rincian saldo awal per pihak (sheet AKUN, bagian bawah) */
  openingDetails: { account: string; party: string; amount: number }[];
  /** kolom "Keterangan" sheet ANALISIS EVENT */
  eventNotes: Record<string, string>;
  /** sheet MUTASI (sheet hitung Excel): mutasi bertanda per bulan [indeks 1–12], saldo awal & akhir — untuk uji kecocokan */
  mutasi: Record<string, { months: number[]; opening: number; closing: number }>;
  /** hal yang perlu dibereskan manual (nama tidak cocok, baris dilewati) */
  warnings: string[];
}

type Cell = string | number | boolean | null;

function sheetReader(wb: XLSX.WorkBook, name: string) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" tidak ada di file Excel.`);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const get = (addr: string): Cell => {
    const c = ws[addr] as XLSX.CellObject | undefined;
    if (!c || c.v === undefined || c.v === "") return null;
    return c.v as Cell;
  };
  return { get, lastRow: range.e.r + 1 };
}

const str = (v: Cell) => (v == null ? "" : String(v).trim());
const num = (v: Cell): number | null => (v == null ? null : typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, "")));
const int = (v: Cell) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

/** Nomor seri tanggal Excel → 'YYYY-MM-DD' (tanpa Date lokal, supaya tidak geser karena zona waktu). */
function isoDate(v: Cell, where: string): string {
  if (typeof v !== "number") throw new Error(`${where}: tanggal tidak valid (${String(v)}).`);
  const d = XLSX.SSF.parse_date_code(v);
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

export function readExcelV2(file = DEFAULT_EXCEL_FILE): ExcelV2 {
  const wb = XLSX.readFile(file, { cellDates: false });
  const warnings: string[] = [];

  // ---------- PENGATURAN ----------
  const P = sheetReader(wb, "PENGATURAN");
  const yes = (addr: string) => str(P.get(addr)).toUpperCase() === "YA";
  const settings: EngineInput["settings"] = {
    year: int(P.get("C5"))!,
    closedMonth: int(P.get("C6"))!,
    pbjtRate: num(P.get("C8"))!,
    priceIncludesTax: yes("C9"),
    accruePbjt: yes("C10"),
    cashDiffThreshold: 50000, // batas status "Cek selisih tunai" (tertulis di rumus OMZET HARIAN)
    opsPurchaseTolerancePct: 0.05,
    opsSalesTolerancePct: 0.02,
  };
  const limits = {
    foodCost: num(P.get("C14"))!, payroll: num(P.get("C15"))!, occupancy: num(P.get("C16"))!,
    primeCost: num(P.get("C17"))!, netMargin: num(P.get("C18"))!,
  };

  // ---------- AKUN ----------
  const A = sheetReader(wb, "AKUN");
  const accounts: EngineInput["accounts"] = [];
  const accountMeta: ExcelV2["accountMeta"] = {};
  const openingDetails: ExcelV2["openingDetails"] = [];
  let inDetails = false;
  for (let r = 6; r <= A.lastRow; r++) {
    const code = str(A.get(`A${r}`));
    if (/^\d{4}$/.test(code)) {
      accounts.push({
        code, name: str(A.get(`B${r}`)), group: str(A.get(`C${r}`)) as AccountGroup, normal: str(A.get(`E${r}`)) as NormalSide,
        cashCategory: str(A.get(`F${r}`)) as CashCategory, cashFlowLine: str(A.get(`G${r}`)) || null,
        // 3101 Ekuitas Kopi Parang: di Excel berupa rumus (aset − liabilitas); mesin menghitungnya sendiri.
        openingBalance: code === "3101" ? 0 : int(A.get(`H${r}`)) ?? 0,
      });
      accountMeta[code] = { reportLine: str(A.get(`D${r}`)) || null, description: str(A.get(`I${r}`)) || null };
      continue;
    }
    const label = str(A.get(`B${r}`));
    if (label.toLowerCase().startsWith("rincian saldo awal")) { inDetails = true; continue; }
    if (inDetails) {
      const party = str(A.get(`D${r}`));
      const amount = int(A.get(`H${r}`));
      if (!label || !party || amount == null) { inDetails = false; continue; }
      openingDetails.push({ account: label, party, amount });
    }
  }
  const accountNames = new Set(accounts.map((a) => a.name));
  for (const d of openingDetails) {
    if (!accountNames.has(d.account)) warnings.push(`AKUN rincian saldo awal: akun "${d.account}" tidak ada di daftar akun.`);
  }

  // ---------- OMZET HARIAN (kolom input: C D F G H L M N R S) ----------
  const O = sheetReader(wb, "OMZET HARIAN");
  const daily: EngineInput["daily"] = [];
  for (let r = 5; r <= O.lastRow; r++) {
    if (O.get(`A${r}`) == null) continue;
    const cashPos = int(O.get(`C${r}`));
    const edcPos = int(O.get(`D${r}`));
    if (cashPos == null && edcPos == null) continue; // hari belum diisi
    const bon = int(O.get(`L${r}`));
    daily.push({
      date: isoDate(O.get(`A${r}`), `OMZET HARIAN baris ${r}`),
      cashPos, edcPos, cashShift1: int(O.get(`F${r}`)), cashShift2: int(O.get(`G${r}`)), edcSettled: int(O.get(`H${r}`)),
      compliment: int(O.get(`M${r}`)), ownerBill: int(O.get(`N${r}`)), itemsSold: int(O.get(`R${r}`)), transactions: int(O.get(`S${r}`)),
      bons: bon ? [{ party: LEGACY_BON_PARTY, amount: bon }] : [],
    });
  }

  // ---------- JURNAL (kolom A–I, hanya jenis UMUM) ----------
  const J = sheetReader(wb, "JURNAL");
  const journal: EngineInput["journal"] = [];
  for (let r = 5; r <= J.lastRow; r++) {
    const voucherNo = str(J.get(`A${r}`));
    if (!voucherNo) continue;
    const kind = str(J.get(`I${r}`)).toUpperCase();
    if (kind && kind !== "UMUM") continue; // OTOMATIS/PENYESUAIAN dibuat ulang mesin
    const j = {
      voucherNo, date: isoDate(J.get(`B${r}`), `JURNAL ${voucherNo}`), debit: str(J.get(`C${r}`)), credit: str(J.get(`D${r}`)),
      amount: int(J.get(`E${r}`)) ?? 0, description: J.get(`F${r}`) == null ? "" : String(J.get(`F${r}`)), event: str(J.get(`G${r}`)), party: str(J.get(`H${r}`)), receiptNo: "",
    };
    for (const side of [j.debit, j.credit]) {
      if (!accountNames.has(side)) warnings.push(`JURNAL ${voucherNo}: akun "${side}" tidak ada di daftar akun.`);
    }
    journal.push(j);
  }

  // ---------- ASET TETAP (kolom B–E) ----------
  const T = sheetReader(wb, "ASET TETAP");
  const assets: EngineInput["assets"] = [];
  for (let r = 6; r <= T.lastRow; r++) {
    const name = str(T.get(`B${r}`));
    if (!name || name.toUpperCase() === "TOTAL") break;
    if (T.get(`C${r}`) == null) {
      warnings.push(`ASET TETAP baris ${r} "${name}" belum punya tanggal perolehan — dilewati.`);
      continue;
    }
    assets.push({ name, acquiredOn: isoDate(T.get(`C${r}`), `ASET TETAP baris ${r}`), cost: int(T.get(`D${r}`)) ?? 0, usefulLifeYears: int(T.get(`E${r}`)) ?? 4 });
  }

  // ---------- PAJAK (kolom D omzet dilaporkan, H PBJT dibayar) ----------
  const X = sheetReader(wb, "PAJAK");
  const taxFilings: EngineInput["taxFilings"] = {};
  for (let r = 6; r <= 17; r++) {
    const m = int(X.get(`A${r}`));
    const reported = int(X.get(`D${r}`));
    const paid = int(X.get(`H${r}`));
    if (m && (reported != null || paid != null)) taxFilings[m] = { pbjtPaid: paid, reportedRevenue: reported };
  }

  // ---------- ANALISIS EVENT (kolom H keterangan) ----------
  const E = sheetReader(wb, "ANALISIS EVENT");
  const eventNotes: Record<string, string> = {};
  for (let r = 5; r <= E.lastRow; r++) {
    const name = str(E.get(`B${r}`));
    if (!name || name.toUpperCase().startsWith("TOTAL")) break;
    const note = str(E.get(`H${r}`));
    if (note) eventNotes[name] = note;
  }

  // ---------- MUTASI (untuk uji kecocokan saja) ----------
  const M = sheetReader(wb, "MUTASI");
  const cols = ["E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
  const mutasi: ExcelV2["mutasi"] = {};
  for (let r = 6; r <= M.lastRow; r++) {
    const name = str(M.get(`B${r}`));
    if (!/^\d{4}$/.test(str(M.get(`A${r}`)))) continue;
    mutasi[name] = {
      months: [0, ...cols.map((c) => int(M.get(`${c}${r}`)) ?? 0)],
      opening: int(M.get(`Q${r}`)) ?? 0,
      closing: int(M.get(`S${r}`)) ?? 0,
    };
  }

  return {
    input: { settings, accounts, daily, journal, assets, taxFilings, ops: {} },
    revenueTarget: int(P.get("C12")) ?? 0,
    limits, accountMeta, openingDetails, eventNotes, mutasi, warnings,
  };
}

/** Langkah 4 migrasi: hitung ulang dengan mesin, lalu bandingkan mutasi tiap akun per bulan dengan sheet MUTASI. */
export function compareWithMutasi(x: ExcelV2): string[] {
  const R = compute(x.input);
  const diffs: string[] = [];
  for (const [name, m] of Object.entries(x.mutasi)) {
    if (!R.mutations[name]) {
      diffs.push(`${name}: akun tidak ada di hasil impor`);
      continue;
    }
    for (let i = 1; i <= 12; i++) {
      const got = Math.round(R.mutations[name][i]);
      if (got !== m.months[i]) diffs.push(`${name} bulan ${i}: aplikasi ${got}, Excel ${m.months[i]}`);
    }
  }
  return diffs;
}
