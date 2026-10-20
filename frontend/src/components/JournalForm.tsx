import { FormEvent, useState } from "react";
import { journalApi, JournalInput } from "../api";
import { todayJakarta } from "../utils/format";
import { Field, Panel } from "./ui";
import MoneyInput from "./MoneyInput";
import AccountSelect from "./AccountSelect";
import type { Account, EventItem, Party } from "../types";

/** Satu transaksi = satu akun debet + satu akun kredit. Nomor bukti dibuat server (JU-0001 dst).
 * Validasi utama dicek di server; di sini hanya pemeriksaan cepat agar pesan muncul lebih awal. */
export default function JournalForm({
  accounts, events, parties, onSaved, onCancel,
}: {
  accounts: Account[];
  events: EventItem[];
  parties: Party[];
  onSaved: (voucherNo: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<JournalInput>({
    date: todayJakarta(), debitAccountId: "", creditAccountId: "", amount: null,
    description: "", receiptNo: "", eventId: "", partyId: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<JournalInput>) => setV((s) => ({ ...s, ...patch }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!v.debitAccountId || !v.creditAccountId) return setErr("Pilih akun debet dan akun kredit.");
    if (v.debitAccountId === v.creditAccountId) return setErr("Akun debet dan akun kredit tidak boleh sama.");
    if (!v.amount || v.amount <= 0) return setErr("Nominal harus lebih dari 0.");
    if (!v.description.trim()) return setErr("Isi keterangan agar transaksi mudah dicari nanti.");
    setBusy(true);
    try {
      const r = await journalApi.create(v);
      onSaved(r.voucherNo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Transaksi baru" hint="Satu transaksi = satu akun debet dan satu akun kredit. Nomor bukti dibuat otomatis." className="mb-4">
      <form onSubmit={submit}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Tanggal">
            <input className="input" type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="Akun debet">
            <AccountSelect accounts={accounts} value={v.debitAccountId} blank="Pilih akun…" onChange={(x) => set({ debitAccountId: x as number })} />
          </Field>
          <Field label="Akun kredit">
            <AccountSelect accounts={accounts} value={v.creditAccountId} blank="Pilih akun…" onChange={(x) => set({ creditAccountId: x as number })} />
          </Field>
          <Field label="Nominal (Rp)">
            <MoneyInput value={v.amount} onChange={(x) => set({ amount: x })} />
          </Field>
          <Field label="Keterangan" className="sm:col-span-2">
            <input className="input" value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="mis. Belanja susu fresh milk 2 karton" />
          </Field>
          <Field label="No. nota">
            <input className="input" value={v.receiptNo} onChange={(e) => set({ receiptNo: e.target.value })} placeholder="sama dengan di Parang-ops" />
          </Field>
          <Field label="Tag event">
            <select className="input" value={v.eventId} onChange={(e) => set({ eventId: Number(e.target.value) || "" })}>
              <option value="">Tanpa event</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </Field>
          <Field label="Pihak (opsional)">
            <select className="input" value={v.partyId} onChange={(e) => set({ partyId: Number(e.target.value) || "" })}>
              <option value="">—</option>
              {parties.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        {err && <div role="alert" className="text-sm text-accent-danger mt-3">{err}</div>}
        <div className="flex gap-2 mt-4">
          <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Simpan transaksi"}</button>
          <button type="button" className="btn-ghost" onClick={onCancel}>Batal</button>
        </div>
      </form>
    </Panel>
  );
}
