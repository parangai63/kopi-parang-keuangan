export const API_URL = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Semua panggilan API lewat sini: cookie sesi ikut terkirim (credentials: include),
 * dan pesan error dari server (bahasa Indonesia) diteruskan apa adanya ke UI. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: init.method ?? "GET",
    credentials: "include",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
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
