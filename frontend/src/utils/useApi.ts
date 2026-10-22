import { DependencyList, useCallback, useEffect, useRef, useState } from "react";

// Cache hasil terakhir per halaman+parameter (stale-while-revalidate): saat halaman dibuka lagi,
// data lama langsung tampil dan diperbarui di latar belakang, jadi tidak menunggu spinner.
const cache = new Map<string, unknown>();

/** Kosongkan cache (dipanggil saat keluar/sesi berakhir supaya data tidak bocor ke pengguna lain). */
export const clearApiCache = () => cache.clear();

/** Fetch data dengan status loading/error yang wajib ditampilkan di UI (pedoman frontend). */
export function useApi<T>(fn: () => Promise<T>, deps: DependencyList) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const key = fn.toString() + JSON.stringify(deps);

  const [data, setData] = useState<T | null>(() => (cache.has(key) ? (cache.get(key) as T) : null));
  const [loading, setLoading] = useState(!cache.has(key));
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef(key);
  keyRef.current = key;

  const reload = useCallback(async () => {
    const k = keyRef.current;
    // Tanpa data lama (halaman baru / parameter baru) tampilkan spinner; dengan data lama, perbarui diam-diam.
    if (!cache.has(k)) setLoading(true);
    setError(null);
    try {
      const fresh = await load();
      cache.set(k, fresh);
      if (keyRef.current === k) setData(fresh);
    } catch (e) {
      if (keyRef.current === k && !cache.has(k)) setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      if (keyRef.current === k) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    // Parameter berubah: pakai cache milik parameter itu (atau kosongkan) sebelum memuat.
    setData(cache.has(key) ? (cache.get(key) as T) : null);
    setLoading(!cache.has(key));
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const setDataAndCache = useCallback((v: T | null | ((p: T | null) => T | null)) => {
    setData((p) => {
      const next = typeof v === "function" ? (v as (p: T | null) => T | null)(p) : v;
      if (next !== null) cache.set(keyRef.current, next);
      return next;
    });
  }, []);

  return { data, loading, error, reload, setData: setDataAndCache };
}
