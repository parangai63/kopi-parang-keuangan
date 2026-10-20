import { FormEvent, useState } from "react";
import { authApi, userApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ErrorBox, Field, Loading, PageHeader, Panel, Pill } from "../components/ui";
import type { Role } from "../types";

const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin keuangan", KASIR: "Kasir" };

/** Kelola pengguna, 2FA akun sendiri, dan riwayat perubahan (audit log). Owner saja. */
export default function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const users = useApi(() => userApi.list(), []);
  const [auditPage, setAuditPage] = useState(1);
  const audit = useApi(() => userApi.audit(auditPage), [auditPage]);
  const [form, setForm] = useState({ name: "", email: "", role: "KASIR" as Role, password: "", pin: "" });
  const [totp, setTotp] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const body = form.role === "KASIR" ? { name: form.name, role: form.role, pin: form.pin } : { name: form.name, role: form.role, email: form.email, password: form.password };
      await userApi.create(body);
      toast(`Pengguna ${form.name} dibuat.`);
      setForm({ name: "", email: "", role: "KASIR", password: "", pin: "" });
      users.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  async function toggle(id: number, isActive: boolean) {
    try {
      await userApi.update(id, { isActive });
      users.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  async function confirmTotp(e: FormEvent) {
    e.preventDefault();
    try {
      await authApi.totpConfirm(code);
      toast("Verifikasi 2 langkah aktif.");
      setTotp(null);
      users.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  const me = users.data?.find((u) => u.id === user?.id);

  return (
    <>
      <PageHeader title="Pengguna & riwayat perubahan" subtitle="Tabel pengguna & PIN sendiri — tidak disinkronkan dengan Parang-ops." />
      <div className="space-y-4">
        {me && !me.totpEnabled && (
          <Panel title="Aktifkan verifikasi 2 langkah" hint="Wajib untuk owner dan admin (spesifikasi). Pakai Google Authenticator / aplikasi sejenis.">
            {!totp ? (
              <button className="btn" onClick={async () => setTotp(await authApi.totpSetup())}>Mulai aktivasi</button>
            ) : (
              <form onSubmit={confirmTotp} className="space-y-3">
                <p className="text-sm">Tambahkan akun di aplikasi authenticator dengan kunci berikut, lalu masukkan kode 6 digit:</p>
                <code className="block bg-parang-bg rounded p-2 text-sm break-all">{totp.secret}</code>
                <div className="flex gap-2 items-end">
                  <Field label="Kode"><input className="input w-32 tnum" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
                  <button className="btn">Aktifkan</button>
                </div>
              </form>
            )}
          </Panel>
        )}

        <Panel title="Pengguna">
          <form onSubmit={add} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end mb-4">
            <Field label="Nama"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Peran">
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            {form.role === "KASIR" ? (
              <Field label="PIN 6 digit"><input className="input tnum" inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} /></Field>
            ) : (
              <>
                <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Kata sandi (min. 10)"><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
              </>
            )}
            <button className="btn" disabled={!form.name.trim()}>Tambah</button>
          </form>
          {users.loading ? <Loading /> : users.error || !users.data ? <ErrorBox message={users.error ?? ""} onRetry={users.reload} /> : (
            <table className="w-full text-sm">
              <thead className="text-xs text-parang-subtle text-left"><tr><th className="py-2">Nama</th><th>Peran</th><th>Login</th><th>Status</th><th /></tr></thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id} className="border-t border-parang-divider/60">
                    <td className="py-2">{u.name}</td>
                    <td>{ROLE_LABEL[u.role]}</td>
                    <td className="text-xs">{u.role === "KASIR" ? "PIN" : <>{u.email} {u.totpEnabled ? <Pill tone="ok">2FA</Pill> : <Pill tone="wait">tanpa 2FA</Pill>}</>}</td>
                    <td>{u.isActive ? <Pill tone="ok">aktif</Pill> : <Pill>nonaktif</Pill>}</td>
                    <td className="text-right">{u.id !== user?.id && <button className="text-sm text-accent-primary" onClick={() => toggle(u.id, !u.isActive)}>{u.isActive ? "Nonaktifkan" : "Aktifkan"}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Riwayat perubahan" hint="Setiap tambah, ubah, batal, tutup buku, dan buka kembali. Tidak bisa dihapus dari aplikasi.">
          {audit.loading ? <Loading /> : audit.error || !audit.data ? <ErrorBox message={audit.error ?? ""} onRetry={audit.reload} /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-parang-subtle text-left"><tr><th className="py-2 pr-2">Waktu</th><th className="pr-2">Pengguna</th><th className="pr-2">Aksi</th><th className="pr-2">Tabel</th><th>Data</th></tr></thead>
                  <tbody>
                    {audit.data.rows.map((r) => (
                      <tr key={r.id} className="border-t border-parang-divider/60 align-top">
                        <td className="py-1.5 pr-2 whitespace-nowrap text-xs">{new Date(r.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
                        <td className="pr-2">{r.user ?? "—"}</td>
                        <td className="pr-2"><Pill tone={r.action === "VOID" || r.action === "REOPEN" ? "bad" : "info"}>{r.action}</Pill></td>
                        <td className="pr-2 text-xs font-mono">{r.tableName} #{r.recordId}</td>
                        <td>
                          <details className="text-xs">
                            <summary className="cursor-pointer text-accent-primary">lihat</summary>
                            <pre className="whitespace-pre-wrap break-all bg-parang-bg rounded p-2 mt-1 max-w-xl">{JSON.stringify({ sebelum: r.before, sesudah: r.after }, null, 1)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button className="btn-ghost" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>Sebelumnya</button>
                <button className="btn-ghost" disabled={auditPage * audit.data.pageSize >= audit.data.total} onClick={() => setAuditPage((p) => p + 1)}>Berikutnya</button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
