import { FormEvent, useState } from "react";
import { userApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ErrorBox, Field, Loading, PageHeader, Panel, Pill, ROLE_LABEL } from "../components/ui";
import type { Role } from "../types";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/** Kelola pengguna (login PIN 6 digit) dan riwayat perubahan (audit log). Owner saja. */
export default function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const users = useApi(() => userApi.list(), []);
  const [auditPage, setAuditPage] = useState(1);
  const audit = useApi(() => userApi.audit(auditPage), [auditPage]);
  const [form, setForm] = useState({ name: "", role: "KASIR" as Role, pin: "" });
  const [pinEdit, setPinEdit] = useState<{ id: number; pin: string } | null>(null);

  const fail = (err: unknown) => toast(err instanceof Error ? err.message : "Gagal.", "error");

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await userApi.create(form);
      toast(`Pengguna ${form.name} dibuat.`);
      setForm({ name: "", role: "KASIR", pin: "" });
      users.reload();
    } catch (err) {
      fail(err);
    }
  }

  async function toggle(id: number, isActive: boolean) {
    try {
      await userApi.update(id, { isActive });
      users.reload();
    } catch (err) {
      fail(err);
    }
  }

  async function savePin(e: FormEvent) {
    e.preventDefault();
    if (!pinEdit) return;
    try {
      await userApi.update(pinEdit.id, { pin: pinEdit.pin });
      toast("PIN diganti.");
      setPinEdit(null);
    } catch (err) {
      fail(err);
    }
  }

  return (
    <>
      <PageHeader title="Pengguna & riwayat perubahan" subtitle="Login memakai PIN 6 digit. Tabel pengguna & PIN sendiri, tidak disinkronkan dengan Parang-ops." />
      <div className="grid">
        <Panel title="Pengguna" hint="Owner bisa menambah, mengganti PIN, atau menonaktifkan pengguna.">
          <form className="toolbar" onSubmit={add}>
            <Field label="Nama" className="q"><input autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Peran">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            <Field label="PIN 6 digit">
              <input inputMode="numeric" maxLength={6} autoComplete="off" value={form.pin} onChange={(e) => setForm({ ...form, pin: digits(e.target.value) })} />
            </Field>
            <button className="btn" type="submit" disabled={!form.name.trim() || form.pin.length !== 6}>Tambah</button>
          </form>
          {users.loading ? <Loading /> : users.error || !users.data ? <ErrorBox message={users.error ?? ""} onRetry={users.reload} /> : (
            <div className="tw">
              <table className="t">
                <thead><tr><th>Nama</th><th>Peran</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {users.data.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}{u.id === user?.id && <span className="note"> (Anda)</span>}</td>
                      <td>{ROLE_LABEL[u.role]}</td>
                      <td>{u.isActive ? <Pill tone="ok">aktif</Pill> : <Pill>nonaktif</Pill>}</td>
                      <td className="act">
                        {pinEdit?.id === u.id ? (
                          <form onSubmit={savePin} className="btns" style={{ justifyContent: "flex-end" }}>
                            <input className="mini" inputMode="numeric" maxLength={6} autoFocus placeholder="PIN baru" aria-label="PIN baru" style={{ width: 96 }} value={pinEdit.pin} onChange={(e) => setPinEdit({ id: u.id, pin: digits(e.target.value) })} />
                            <button className="linkbtn" type="submit" disabled={pinEdit.pin.length !== 6}>Simpan</button>
                            <button type="button" className="linkbtn" style={{ color: "var(--muted)" }} onClick={() => setPinEdit(null)}>Batal</button>
                          </form>
                        ) : (
                          <div className="btns" style={{ justifyContent: "flex-end", gap: 14 }}>
                            <button className="linkbtn" onClick={() => setPinEdit({ id: u.id, pin: "" })}>Ganti PIN</button>
                            {u.id !== user?.id && <button className="linkbtn" onClick={() => toggle(u.id, !u.isActive)}>{u.isActive ? "Nonaktifkan" : "Aktifkan"}</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Riwayat perubahan" hint="Setiap tambah, ubah, batal, tutup buku, dan buka kembali. Tidak bisa dihapus dari aplikasi.">
          {audit.loading ? <Loading /> : audit.error || !audit.data ? <ErrorBox message={audit.error ?? ""} onRetry={audit.reload} /> : (
            <div className="tw">
              <table className="t">
                <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Tabel</th><th>Data</th></tr></thead>
                <tbody>
                  {audit.data.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="acc">{new Date(r.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
                      <td className="acc">{r.user ?? "—"}</td>
                      <td><Pill tone={r.action === "VOID" || r.action === "REOPEN" ? "bad" : "auto"}>{r.action}</Pill></td>
                      <td className="mono acc">{r.tableName} #{r.recordId}</td>
                      <td>
                        <details>
                          <summary>lihat</summary>
                          <pre>{JSON.stringify({ sebelum: r.before, sesudah: r.after }, null, 1)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                  {!audit.data.rows.length && <tr><td colSpan={5} className="empty-row">Belum ada perubahan tercatat.</td></tr>}
                </tbody>
              </table>
              <div className="pager">
                <span>Halaman {auditPage}</span>
                <div className="btns">
                  <button className="btn ghost sm" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>Sebelumnya</button>
                  <button className="btn ghost sm" disabled={auditPage * audit.data.pageSize >= audit.data.total} onClick={() => setAuditPage((p) => p + 1)}>Berikutnya</button>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
