import { FormEvent, useEffect, useState } from "react";
import { dailyApi } from "../api";
import { useApi } from "../utils/useApi";
import { useToast } from "../context/ToastContext";
import { dayOfWeek, HARI, num, tgl } from "../utils/format";
import { ErrorBox, Field, Loading, LockNote, PageHeader, Panel } from "../components/ui";
import MoneyInput from "../components/MoneyInput";
import BonEditor, { BonRow, bonsToPayload } from "../components/BonEditor";
import type { DailyDay } from "../types";

const TODAY_FIELDS = [
  ["cashPos", "Tunai (POS)"],
  ["edcPos", "EDC / QRIS (POS)"],
  ["itemsSold", "Produk terjual"],
  ["transactions", "Jumlah transaksi"],
  ["compliment", "Compliment"],
  ["ownerBill", "Bill owner"],
] as const;
type TodayField = (typeof TODAY_FIELDS)[number][0];

/** Tampilan kasir di HP (layar 360 px): angka tutup kasir hari ini + setoran H+1 (vKasir di rancangan original). */
export default function KasirPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => dailyApi.kasir(), []);
  const staff = useApi(() => dailyApi.staff(), []);
  const [form, setForm] = useState<Record<TodayField, number | null>>({ cashPos: null, edcPos: null, itemsSold: null, transactions: null, compliment: null, ownerBill: null });
  const [bons, setBons] = useState<BonRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const t = data.today;
    setForm({ cashPos: t.cashPos, edcPos: t.edcPos, itemsSold: t.itemsSold, transactions: t.transactions, compliment: t.compliment, ownerBill: t.ownerBill });
    setBons(t.bons.map((b) => ({ partyId: b.partyId, amount: b.amount })));
  }, [data]);

  if (loading) return <><PageHeader title="Omzet hari ini" /><Loading /></>;
  if (error || !data) return <><PageHeader title="Omzet hari ini" /><ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} /></>;
  const t = data.today;
  const locked = Boolean(t.verifiedAt);

  async function saveToday(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await dailyApi.save(t.date, { ...form, bons: bonsToPayload(bons) });
      toast(`Omzet ${tgl(t.date)} tersimpan. Status: ${r.calc.status || "kosong"}.`);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Omzet hari ini" subtitle={`${HARI[dayOfWeek(t.date)]}, ${tgl(t.date)} · tampilan kasir di HP`} />
      <div className="kasir">
        <Panel title="Angka tutup kasir Majoo" hint="Isi saat tutup toko, salin dari laporan tutup kasir di Majoo.">
          {locked && <LockNote>Sudah diverifikasi admin, tidak bisa diubah lagi.</LockNote>}
          <form className="f" onSubmit={saveToday}>
            <fieldset>
              {TODAY_FIELDS.map(([k, label]) => (
                <Field key={k} label={label}>
                  <MoneyInput value={form[k]} disabled={locked} onChange={(v) => setForm((f) => ({ ...f, [k]: v }))} />
                </Field>
              ))}
            </fieldset>
            <fieldset>
              <legend className="wide">Bon karyawan</legend>
              <BonEditor rows={bons} onChange={setBons} staff={staff.data ?? []} disabled={locked} />
            </fieldset>
            {!locked && (
              <div className="btns">
                <button className="btn" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan omzet hari ini"}</button>
              </div>
            )}
          </form>
        </Panel>

        <Panel title="Setoran tunai yang belum diisi" hint="Isi jumlah uang tunai yang benar-benar disetor per shift (H+1). Settlement EDC diisi admin.">
          {data.pendingDeposits.length ? (
            data.pendingDeposits.map((d) => <DepositRow key={d.date} day={d} onSaved={reload} />)
          ) : (
            <p className="note">Semua setoran sudah diisi.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

function DepositRow({ day, onSaved }: { day: DailyDay; onSaved: () => void }) {
  const toast = useToast();
  const [s1, setS1] = useState<number | null>(day.cashShift1);
  const [s2, setS2] = useState<number | null>(day.cashShift2);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await dailyApi.save(day.date, { cashShift1: s1, cashShift2: s2 });
      toast(`Setoran ${tgl(day.date)} tersimpan. Status: ${r.calc.status}.`);
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="setor-row" onSubmit={save}>
      <div className="dl">
        <b>{tgl(day.date)}</b>
        <div className="note">POS tunai {num(day.cashPos)}</div>
      </div>
      <Field label="Shift 1"><MoneyInput value={s1} onChange={setS1} /></Field>
      <Field label="Shift 2"><MoneyInput value={s2} onChange={setS2} /></Field>
      <button className="btn" type="submit" disabled={busy}>Simpan</button>
    </form>
  );
}
