export const API_URL = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Tahun buku yang dipilih di pemilih tahun (null = tahun terbaru). Dikirim sebagai header X-Fiscal-Year
// di setiap permintaan; disimpan di browser supaya tetap setelah halaman dimuat ulang.
const YEAR_KEY = "kpk_fiscal_year";
let fiscalYear: number | null = (() => {
  try {
    const v = Number(localStorage.getItem(YEAR_KEY));
    return Number.isInteger(v) && v > 2000 ? v : null;
  } catch {
    return null;
  }
})();

export const getSelectedFiscalYear = () => fiscalYear;
export function setSelectedFiscalYear(year: number | null) {
  fiscalYear = year;
  try {
    if (year === null) localStorage.removeItem(YEAR_KEY);
    else localStorage.setItem(YEAR_KEY, String(year));
  } catch {
    /* penyimpanan browser tidak tersedia: pilihan hanya berlaku sampai halaman dimuat ulang */
  }
}

/** Semua panggilan API lewat sini: cookie sesi ikut terkirim (credentials: include),
 * dan pesan error dari server (bahasa Indonesia) diteruskan apa adanya ke UI. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (fiscalYear !== null) headers["X-Fiscal-Year"] = String(fiscalYear);
  const res = await fetch(`${API_URL}/api${path}`, {
    method: init.method ?? "GET",
    credentials: "include",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("kpk:unauthorized"));
    throw new ApiError(res.status, data?.message ?? `Permintaan gagal (${res.status}).`);
  }
  return data as T;
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return p.length ? "?" + new URLSearchParams(p.map(([k, v]) => [k, String(v)])).toString() : "";
};
