import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "../api";
import { clearApiCache } from "../utils/useApi";
import type { Me } from "../types";

interface AuthState {
  user: Me | null;
  checking: boolean;
  setUser: (u: Me | null) => void;
  logout: () => Promise<void>;
  /** muat ulang profil (mis. setelah tutup buku, supaya chip "Tutup buku s.d." ikut berubah) */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Sesi disimpan server di cookie httpOnly; di sini hanya cache profil pengguna. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
    const onUnauthorized = () => { clearApiCache(); setUser(null); };
    window.addEventListener("kpk:unauthorized", onUnauthorized);
    return () => window.removeEventListener("kpk:unauthorized", onUnauthorized);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    clearApiCache();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    await authApi.me().then((r) => setUser(r.user)).catch(() => undefined);
  }, []);

  return <AuthContext.Provider value={{ user, checking, setUser, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus di dalam AuthProvider");
  return ctx;
}
