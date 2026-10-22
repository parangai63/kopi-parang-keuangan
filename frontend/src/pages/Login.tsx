import { FormEvent, useState } from "react";
import { authApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Field, Panel } from "../components/ui";

/** Sementara semua peran (owner, admin, kasir) masuk dengan: cukup PIN 6 digit.
 * PIN dikelola aplikasi ini sendiri, BUKAN PIN Parang-ops. Gaya mengikuti layar PIN di rancangan original. */
export default function LoginPage() {
  const { setUser } = useAuth();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      setUser((await authApi.pin(pin)).user);
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
        <Panel title="Masukkan PIN" hint="PIN 6 digit, dikelola di aplikasi ini (bukan PIN Parang-ops). Perangkat dikunci 15 menit setelah 5 kali salah.">
          <form className="f" onSubmit={submit}>
            <Field label="PIN">
              <input
                className="pin-input"
                autoFocus
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
