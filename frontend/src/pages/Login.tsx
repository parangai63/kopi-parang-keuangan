import { FormEvent, useEffect, useState } from "react";
import { authApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Field, Panel, ROLE_LABEL } from "../components/ui";
import type { Role } from "../types";

/** Sementara semua peran (owner, admin, kasir) masuk dengan: pilih nama + PIN 6 digit.
 * PIN dikelola aplikasi ini sendiri, BUKAN PIN Parang-ops. Gaya mengikuti layar PIN di rancangan original. */
export default function LoginPage() {
  const { setUser } = useAuth();
  const [users, setUsers] = useState<{ id: number; name: string; role: Role }[]>([]);
  const [userId, setUserId] = useState<number | "">("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi.loginUsers().then(setUsers).catch(() => setErr("Tidak bisa terhubung ke server."));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!userId) return setErr("Pilih nama pengguna.");
    setBusy(true);
    try {
      setUser((await authApi.pin(userId, pin)).user);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal masuk.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand">
          <div className="mark" aria-hidden="true" />
          <div>
            <b>Kopi Parang</b>
            <span>Keuangan · omzet, jurnal, aset, pajak, laporan</span>
          </div>
        </div>
        <Panel title="Masukkan PIN" hint="PIN 6 digit, dikelola di aplikasi ini (bukan PIN Parang-ops). Dikunci 15 menit setelah 5 kali salah.">
          <form className="f" onSubmit={submit}>
            <Field label="Nama pengguna">
              <select value={userId} onChange={(e) => setUserId(Number(e.target.value) || "")}>
                <option value="">Pilih nama…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>
                ))}
              </select>
            </Field>
            <Field label="PIN">
              <input
                className="pin-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            {err && <div role="alert" className="err">{err}</div>}
            <div className="btns">
              <button className="btn" type="submit" disabled={busy || pin.length !== 6}>{busy ? "Memeriksa…" : "Masuk"}</button>
            </div>
          </form>
        </Panel>
        <p className="note" style={{ textAlign: "center", margin: 0 }}>Aplikasi terpisah dari Parang-ops dan Majoo.</p>
      </div>
    </div>
  );
}
