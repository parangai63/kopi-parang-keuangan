import { FormEvent, useEffect, useState } from "react";
import { journalApi, JournalInput, masterApi } from "../api";
import { PARTY_TYPE_OPTIONS } from "../utils/options";
import Select from "./Select";
import { todayJakarta } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { ErrorBox, Field, Loading, Panel } from "./ui";
import MoneyInput from "./MoneyInput";
import AccountSelect from "./AccountSelect";
import type { Account, EventItem, Party } from "../types";

/** Tanggal bawaan: hari ini, atau 31 Desember bila sedang melihat tahun buku lain (mis. koreksi tahun lalu). */
const defaultDate = (fiscalYear?: number) => {
  const t = todayJakarta();
  return fiscalYear && Number(t.slice(0, 4)) !== fiscalYear ? `${fiscalYear}-12-31` : t;
};

const EMPTY = (fiscalYear?: number): JournalInput => ({
  date: defaultDate(fiscalYear), debitAccountId: "", creditAccountId: "", amount: null,
  description: "", receiptNo: "", eventId: "", partyId: "",
});

/** Satu transaksi = satu akun debet + satu akun kredit. Nomor bukti dibuat server (JU-0001 dst).
 * Dengan `editId`, form memuat jurnal itu dan menyimpan lewat PUT (nomor bukti tetap).
 * Validasi utama dicek di server; di sini hanya pemeriksaan cepat agar pesan muncul lebih awal. */
export default function JournalForm({
  accounts, events, parties, editId, onMasterChanged, onSaved, onCancel,
}: {
  accounts: Account[];
  events: EventItem[];
  parties: Party[];
  editId?: number;
  /** dipanggil setelah akun/event/pihak baru ditambah dari dropdown, supaya daftarnya dimuat ulang */
  onMasterChanged?: () => void;
  onSaved: (voucherNo: string, id: number) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const [v, setV] = useState<JournalInput>(() => EMPTY(user?.fiscalYear));
  const [voucherNo, setVoucherNo] = useState("");
  const [loading, setLoading] = useState(!!editId);
  const [loadErr, setLoadErr] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<JournalInput>) => setV((s) => ({ ...s, ...patch }));

  async function load() {
    if (!editId) return;
    setLoading(true);
    setLoadErr("");
    try {
      const j = await journalApi.get(editId);
      setVoucherNo(j.voucherNo);
      setV({
        date: j.date, debitAccountId: j.debitAccountId, creditAccountId: j.creditAccountId, amount: j.amount,
        description: j.description, receiptNo: j.receiptNo ?? "", eventId: j.eventId ?? "", partyId: j.partyId ?? "",
      });
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Gagal memuat jurnal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!v.debitAccountId || !v.creditAccountId) return setErr("Pilih akun debet dan akun kredit.");
    if (v.debitAccountId === v.creditAccountId) return setErr("Akun debet dan akun kredit tidak boleh sama.");
    if (!v.amount || v.amount <= 0) return setErr("Nominal harus lebih dari 0.");
    if (!v.description.trim()) return setErr("Isi keterangan agar transaksi mudah dicari nanti.");
    setBusy(true);
    try {
      const r = editId ? await journalApi.update(editId, v) : await journalApi.create(v);
      onSaved(r.voucherNo, r.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const title = editId ? `Ubah transaksi ${voucherNo}` : "Transaksi baru";
  const hint = editId
    ? "Nomor bukti tetap. Perubahan tercatat di jejak audit beserta nilai sebelumnya."
    : "Satu transaksi = satu akun debet dan satu akun kredit. Nomor bukti dibuat otomatis.";

  return (
    <Panel title={title} hint={hint} className="mb-4">
      {loading ? (
        <Loading />
      ) : loadErr ? (
        <ErrorBox message={loadErr} onRetry={load} />
      ) : (
        <form className="f" onSubmit={submit}>
          <fieldset>
            <Field label="Tanggal">
              <input type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="Akun debet">
              <AccountSelect accounts={accounts} value={v.debitAccountId} onChange={(x) => set({ debitAccountId: x as number | "" })} onCreated={isOwner ? onMasterChanged : undefined} ariaLabel="Akun debet" />
            </Field>
            <Field label="Akun kredit">
              <AccountSelect accounts={accounts} value={v.creditAccountId} onChange={(x) => set({ creditAccountId: x as number | "" })} onCreated={isOwner ? onMasterChanged : undefined} ariaLabel="Akun kredit" />
            </Field>
            <Field label="Nominal (Rp)">
              <MoneyInput value={v.amount} onChange={(x) => set({ amount: x })} />
            </Field>
            <Field label="Keterangan" className="wide">
              <input autoComplete="off" value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="mis. Belanja susu fresh milk 2 karton" />
            </Field>
            <Field label="No. nota">
              <input autoComplete="off" value={v.receiptNo} onChange={(e) => set({ receiptNo: e.target.value })} placeholder="sama dengan di Parang-ops" />
            </Field>
            <Field label="Tag event">
              <Select
                value={v.eventId}
                options={events.map((ev) => ({ value: ev.id, label: ev.name }))}
                onChange={(x) => set({ eventId: x })}
                placeholder="Tanpa event"
                allowEmpty
                ariaLabel="Tag event"
                create={{
                  noun: "event",
                  onCreate: async (name) => {
                    const r = await masterApi.createEvent({ name, startDate: v.date || undefined });
                    onMasterChanged?.();
                    return r.id;
                  },
                  onRemove: async (id) => {
                    const r = await masterApi.removeEvent(id);
                    onMasterChanged?.();
                    return r.message;
                  },
                }}
              />
            </Field>
            <Field label="Pihak (opsional)">
              {/* Pihak nonaktif tetap muncul bila sudah terpasang di jurnal yang diedit. */}
              <Select
                value={v.partyId}
                options={parties.filter((p) => p.isActive || p.id === v.partyId).map((p) => ({ value: p.id, label: p.name }))}
                onChange={(x) => set({ partyId: x })}
                placeholder="Tanpa pihak"
                allowEmpty
                ariaLabel="Pihak"
                create={{
                  noun: "pihak",
                  types: PARTY_TYPE_OPTIONS,
                  onCreate: async (name, type) => {
                    const r = await masterApi.createParty({ name, type: type ?? "LAINNYA" });
                    onMasterChanged?.();
                    return r.id;
                  },
                  onRemove: async (id) => {
                    const r = await masterApi.removeParty(id);
                    onMasterChanged?.();
                    return r.message;
                  },
                }}
              />
            </Field>
          </fieldset>
          {err && <div role="alert" className="err">{err}</div>}
          <div className="btns">
            <button className="btn" type="submit" disabled={busy}>{busy ? "Menyimpan…" : editId ? "Simpan perubahan" : "Simpan transaksi"}</button>
            <button type="button" className="btn ghost" onClick={onCancel}>Batal</button>
          </div>
        </form>
      )}
    </Panel>
  );
}
