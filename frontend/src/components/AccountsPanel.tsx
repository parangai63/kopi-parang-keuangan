import { FormEvent, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { masterApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { num } from "../utils/format";
import { ErrorBox, Field, Loading, Panel, Pill } from "./ui";
import MoneyInput from "./MoneyInput";
import type { Account } from "../types";

interface EditState {
  account: Account;
  name: string;
  description: string;
  openingBalance: number | null;
  isActive: boolean;
  details: { partyId: number | ""; amount: number | null }[];
}

/** Rincian per pihak hanya bermakna untuk piutang & utang (bukan kas, pendapatan, beban). */
const hasDetails = (a: Account) => (a.group === "ASET" || a.group === "LIABILITAS") && a.cashCategory !== "KAS" && a.cashCategory !== "NONKAS";
const isAutoEquity = (a: Account) => a.code === "3101";

/** Daftar akun & saldo awal (sheet AKUN) — owner bisa ubah, admin lihat. */
export default function AccountsPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user?.role === "OWNER";
  const accounts = useApi(() => masterApi.accounts(), []);
  const details = useApi(() => masterApi.openingDetails(), []);
  const parties = useApi(() => masterApi.parties(), []);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [adding, setAdding] = useState<{ code: string; name: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const detailsOf = (id: number) => (details.data ?? []).filter((d) => d.accountId === id);

  function startEdit(a: Account) {
    setAdding(null);
    setEdit({
      account: a, name: a.name, description: a.description ?? "", openingBalance: a.openingBalance, isActive: a.isActive,
      details: detailsOf(a.id).map((d) => ({ partyId: d.partyId, amount: d.amount })),
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const a = edit.account;
    if (edit.openingBalance !== a.openingBalance && (user?.closedMonth ?? 0) > 0 &&
      !window.confirm("Saldo awal 1 Januari ikut mengubah semua laporan, termasuk bulan yang sudah ditutup. Lanjutkan?")) return;
    setBusy(true);
    try {
      await masterApi.saveAccount(a.id, {
        ...(a.isUsed ? {} : { name: edit.name }),
        description: edit.description || null,
        isActive: edit.isActive,
        ...(isAutoEquity(a) ? {} : { openingBalance: edit.openingBalance ?? 0 }),
      });
      if (hasDetails(a)) {
        if (edit.details.some((d) => d.partyId === "")) throw new Error("Pilih pihak untuk setiap baris rincian.");
        await masterApi.saveOpeningDetails(a.id, edit.details.map((d) => ({ partyId: Number(d.partyId), amount: d.amount })));
      }
      toast(`Akun "${edit.name}" tersimpan.`);
      setEdit(null);
      accounts.reload();
      details.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveNew(e: FormEvent) {
    e.preventDefault();
    if (!adding) return;
    setBusy(true);
    try {
      await masterApi.createAccount({
        code: adding.code, name: adding.name, description: adding.description || null,
        group: "BEBAN", normalSide: "D", cashCategory: "OPERASI", cashFlowLine: "OP6",
      });
      toast(`Akun "${adding.name}" ditambahkan.`);
      setAdding(null);
      accounts.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setBusy(false);
    }
  }

  const detailTotal = edit ? edit.details.reduce((s, d) => s + (d.amount ?? 0), 0) : 0;

  return (
    <Panel
      title="Daftar akun & saldo awal"
      hint="Akun yang sudah dipakai tidak bisa dihapus atau diganti nama, hanya dinonaktifkan. Saldo awal Ekuitas Kopi Parang dihitung otomatis (aset − liabilitas per 1 Januari)."
    >
      {canEdit && !adding && !edit && (
        <div className="btns" style={{ marginTop: 0, marginBottom: 12 }}>
          <button className="btn ghost sm" onClick={() => setAdding({ code: "", name: "", description: "" })}>+ Akun beban baru</button>
        </div>
      )}

      {adding && (
        <form className="f" onSubmit={saveNew} style={{ marginBottom: 16 }}>
          <p className="note">
            Akun baru saat ini hanya untuk <b>beban usaha</b> (kode 6112, 6113, …) agar otomatis tampil di Laba Rugi dan Arus Kas
            (baris beban operasional lainnya). Untuk jenis akun lain, diskusikan dulu karena susunan Neraca perlu ikut diubah.
          </p>
          <fieldset>
            <Field label="Kode (61xx)"><input autoComplete="off" value={adding.code} onChange={(e) => setAdding({ ...adding, code: e.target.value })} /></Field>
            <Field label="Nama akun"><input autoComplete="off" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></Field>
            <Field label="Keterangan"><input autoComplete="off" value={adding.description} onChange={(e) => setAdding({ ...adding, description: e.target.value })} /></Field>
          </fieldset>
          <div className="btns">
            <button className="btn" type="submit" disabled={busy || !adding.code.trim() || !adding.name.trim()}>Simpan</button>
            <button type="button" className="btn ghost" onClick={() => setAdding(null)}>Batal</button>
          </div>
        </form>
      )}

      {edit && (
        <form className="f" onSubmit={saveEdit} style={{ marginBottom: 16 }}>
          <p className="note"><b className="mono">{edit.account.code}</b> · {edit.account.group} · saldo normal {edit.account.normalSide}</p>
          <fieldset>
            <Field label="Nama akun">
              <input value={edit.name} disabled={edit.account.isUsed} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Keterangan"><input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            {!isAutoEquity(edit.account) && (
              <Field label="Saldo awal 1 Jan">
                <MoneyInput value={edit.openingBalance} onChange={(v) => setEdit({ ...edit, openingBalance: v })} />
              </Field>
            )}
          </fieldset>
          <label className="check"><input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Akun aktif (bisa dipilih di jurnal)</label>

          {hasDetails(edit.account) && (
            <div style={{ marginTop: 14 }}>
              <p className="note">Rincian saldo awal per pihak (siapa yang berutang / kepada siapa kita berutang per 1 Januari).</p>
              {edit.details.map((d, i) => (
                <div key={i} className="toolbar" style={{ marginBottom: 6 }}>
                  <Field label="Pihak" className="q">
                    <select
                      value={d.partyId}
                      onChange={(e) => setEdit({ ...edit, details: edit.details.map((x, j) => (j === i ? { ...x, partyId: e.target.value ? Number(e.target.value) : "" } : x)) })}
                    >
                      <option value="">— pilih pihak —</option>
                      {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Nominal">
                    <MoneyInput value={d.amount} onChange={(v) => setEdit({ ...edit, details: edit.details.map((x, j) => (j === i ? { ...x, amount: v } : x)) })} />
                  </Field>
                  <button type="button" className="iconbtn" title="Hapus baris" aria-label="Hapus baris" onClick={() => setEdit({ ...edit, details: edit.details.filter((_, j) => j !== i) })}>
                    <Trash2 />
                  </button>
                </div>
              ))}
              <button type="button" className="linkbtn" onClick={() => setEdit({ ...edit, details: [...edit.details, { partyId: "", amount: null }] })}>+ Tambah pihak</button>
              <p className={`note ${detailTotal === (edit.openingBalance ?? 0) ? "" : "warn-text"}`}>
                Jumlah rincian {num(detailTotal)}
                {detailTotal === (edit.openingBalance ?? 0) ? " = saldo awal ✓" : ` ≠ saldo awal ${num(edit.openingBalance)}`}
              </p>
            </div>
          )}
          <div className="btns">
            <button className="btn" type="submit" disabled={busy}>Simpan akun</button>
            <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Batal</button>
          </div>
        </form>
      )}

      {accounts.loading ? <Loading /> : accounts.error || !accounts.data ? <ErrorBox message={accounts.error ?? ""} onRetry={accounts.reload} /> : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Kode</th><th>Nama akun</th><th>Kelompok</th><th>Normal</th><th>Kategori kas</th><th>Baris arus kas</th>
                <th className="r">Saldo awal 1 Jan</th><th /><th />
              </tr>
            </thead>
            <tbody>
              {accounts.data.map((a) => {
                const ds = detailsOf(a.id);
                return (
                  <tr key={a.id}>
                    <td className="mono">{a.code}</td>
                    <td className="acc">
                      {a.name}
                      {ds.length > 0 && <div className="note">{ds.map((d) => `${d.partyName} ${num(d.amount)}`).join(" · ")}</div>}
                    </td>
                    <td>{a.group}</td>
                    <td>{a.normalSide}</td>
                    <td>{a.cashCategory}</td>
                    <td>{a.cashFlowLine ?? "—"}</td>
                    <td className="r">{isAutoEquity(a) ? <span className="note">otomatis</span> : num(a.openingBalance)}</td>
                    <td>{!a.isActive && <Pill>nonaktif</Pill>}</td>
                    <td className="act">
                      {canEdit && (
                        <button className="iconbtn" title="Ubah" aria-label={`Ubah ${a.name}`} onClick={() => startEdit(a)}><Pencil /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
