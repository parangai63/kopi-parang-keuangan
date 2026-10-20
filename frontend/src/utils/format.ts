// Format angka & tanggal Indonesia (spesifikasi: Rupiah tanpa desimal, pemisah ribuan titik,
// negatif dalam kurung di laporan, tanggal "12 Okt 2026").

export const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const BLN3 = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 1.234.567 */
export const num = (n: number | null | undefined) => nf.format(Math.round(n ?? 0));

/** Rp1.234.567 / −Rp1.234.567 */
export const rp = (n: number | null | undefined) => {
  const v = Math.round(n ?? 0);
  return (v < 0 ? "−Rp" : "Rp") + nf.format(Math.abs(v));
};

/** Format akuntansi: negatif dalam kurung. */
export const acct = (n: number | null | undefined) => {
  if (n == null) return "";
  const v = Math.round(n);
  return v < 0 ? `(${nf.format(Math.abs(v))})` : nf.format(v);
};

/** 12,5 jt */
export const jt = (n: number) => {
  const v = n / 1e6;
  const f = new Intl.NumberFormat("id-ID", { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1 });
  return (v < 0 ? "−" : "") + f.format(Math.abs(v)) + " jt";
};

export const pct = (n: number | null | undefined, digits = 1) =>
  n == null || !isFinite(n)
    ? "–"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n * 100) + "%";

/** '2026-10-12' → '12 Okt 2026' */
export const tgl = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${BLN3[m - 1]} ${y}`;
};

export const dayOfWeek = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

export const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

export const periodLabel = (year: number, closedMonth: number) =>
  closedMonth ? `Periode 1 Januari – ${lastDay(year, closedMonth).slice(8)} ${BULAN[closedMonth - 1]} ${year}` : "Belum ada bulan ditutup";

/** Input uang: buang semua selain angka. '' → null (kosong ≠ 0). */
export const parseMoney = (v: string): number | null => {
  const s = v.replace(/[^\d]/g, "");
  return s === "" ? null : Number(s);
};

export const todayJakarta = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
