import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "../api";
import { getSelectedFiscalYear, setSelectedFiscalYear } from "../api/client";
import { clearApiCache } from "../utils/useApi";
import type { Me } from "../types";

interface AuthState {
  user: Me | null;
  checking: boolean;
  setUser: (u: Me | null) => void;
  logout: () => Promise<void>;
  /** muat ulang profil (mis. setelah tutup buku, supaya chip "Tutup buku s.d." ikut berubah) */
  refresh: () => Promise<void>;
  /** ganti tahun buku yang dilihat; semua halaman memuat ulang data tahun itu */
  switchYear: (year: number) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Selaraskan pilihan tahun di browser dengan jawaban server. Kasir selalu di tahun terbaru (tanpa pemilih). */
function syncYear(u: Me): boolean {
  const sel = getSelectedFiscalYear();
  if (sel === null) return false;
  const stale = u.role === "KASIR" || sel === u.latestYear || !u.fiscalYears.some((y) => y.year === sel);
  if (stale) setSelectedFiscalYear(null);
  // Perlu memuat ulang profil bila server menjawab untuk tahun lain dari yang kini dipilih.
  return stale && u.fiscalYear !== u.latestYear;
}

/** Sesi disimpan server di cookie httpOnly; di sini hanya cache profil pengguna. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);

  const loadMe = useCallback(async () => {
    let r = await authApi.me();
    if (syncYear(r.user)) r = await authApi.me();
    setUserState(r.user);
  }, []);

  // Setelah login: jawaban login dihitung dengan header tahun saat itu, jadi selaraskan juga.
  const setUser = useCallback((u: Me | null) => {
    if (u && syncYear(u)) {
      clearApiCache();
      authApi.me().then((r) => setUserState(r.user)).catch(() => setUserState(u));
      return;
    }
    setUserState(u);
  }, []);

  useEffect(() => {
    loadMe()
      .catch(() => setUserState(null))
      .finally(() => setChecking(false));
    const onUnauthorized = () => { clearApiCache(); setUserState(null); };
    window.addEventListener("kpk:unauthorized", onUnauthorized);
    return () => window.removeEventListener("kpk:unauthorized", onUnauthorized);
  }, [loadMe]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    clearApiCache();
    setUserState(null);
  }, []);

  const refresh = useCallback(async () => {
    await loadMe().catch(() => undefined);
  }, [loadMe]);

  const switchYear = useCallback(async (year: number) => {
    setSelectedFiscalYear(year);
    // Cache useApi berisi data tahun sebelumnya — kosongkan supaya tidak tampil tercampur.
    clearApiCache();
    await loadMe().catch(() => undefined);
  }, [loadMe]);

  return <AuthContext.Provider value={{ user, checking, setUser, logout, refresh, switchYear }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus di dalam AuthProvider");
  return ctx;
}
