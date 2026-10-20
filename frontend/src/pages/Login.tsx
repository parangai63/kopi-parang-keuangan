import { FormEvent, useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { authApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Field } from "../components/ui";

/** Owner/admin: email + kata sandi (+ kode 2FA). Kasir: pilih nama + PIN 6 digit.
 * PIN di sini dikelola aplikasi ini sendiri, BUKAN PIN Parang-ops. */
export default function LoginPage() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"staff" | "kasir">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [kasirList, setKasirList] = useState<{ id: number; name: string }[]>([]);
  const [kasirId, setKasirId] = useState<number | "">("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === "kasir") authApi.kasirList().then(setKasirList).catch(() => setKasirList([]));
  }, [mode]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "staff") {
        const r = await authApi.login(email, password, needTotp ? totp : undefined);
        if (r.needTotp) setNeedTotp(true);
        else if (r.user) setUser(r.user);
      } else {
        if (!kasirId) throw new Error("Pilih nama kasir.");
        setUser((await authApi.pin(kasirId, pin)).user);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal masuk.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-parang-bg grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-10 h-10 rounded-xl bg-parang-text text-white grid place-items-center">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-parang-text">Kopi Parang Keuangan</div>
            <div className="text-xs text-parang-subtle">Omzet, jurnal, aset, pajak, laporan</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-parang-divider p-5">
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-lg p-1 mb-5" role="tablist">
            {(["staff", "kasir"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setErr(""); }}
                className={`rounded-md py-1.5 text-sm font-medium ${mode === m ? "bg-white shadow-sm text-parang-text" : "text-parang-subtle"}`}
              >
                {m === "staff" ? "Owner / Admin" : "Kasir"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "staff" ? (
              <>
                <Field label="Email">
                  <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Field>
                <Field label="Kata sandi">
                  <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
                {needTotp && (
                  <Field label="Kode verifikasi (aplikasi authenticator)">
                    <input className="input tnum tracking-widest" inputMode="numeric" maxLength={6} autoFocus value={totp} onChange={(e) => setTotp(e.target.value)} />
                  </Field>
                )}
              </>
            ) : (
              <>
                <Field label="Nama kasir">
                  <select className="input" value={kasirId} onChange={(e) => setKasirId(Number(e.target.value) || "")}>
                    <option value="">Pilih nama…</option>
                    {kasirList.map((k) => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="PIN 6 digit">
                  <input className="input tnum tracking-[0.5em] text-center text-lg" type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
                </Field>
                <p className="text-xs text-parang-subtle">PIN ini terpisah dari PIN Parang-ops. Dikunci 15 menit setelah 5 kali salah.</p>
              </>
            )}
            {err && <div role="alert" className="text-sm text-accent-danger">{err}</div>}
            <button className="btn w-full" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
