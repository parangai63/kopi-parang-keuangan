import { FormEvent, useEffect, useState } from "react";
import { dailyApi } from "../api";
import { useApi } from "../utils/useApi";
import { useToast } from "../context/ToastContext";
import { dayOfWeek, HARI, num, tgl } from "../utils/format";
import { ErrorBox, Field, Loading, PageHeader, Panel, Pill, statusTone } from "../components/ui";
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

/** Tampilan kasir di HP (layar 360 px): angka tutup kasir hari ini + setoran H+1. */
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

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />;
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
    <div className="max-w-xl">
      <PageHeader title="Omzet hari ini" subtitle={`${HARI[dayOfWeek(t.date)]}, ${tgl(t.date)}`} />
      <div className="space-y-4">
        <Panel title="Angka tutup kasir Majoo" hint="Isi saat tutup toko, salin dari laporan tutup kasir di Majoo.">
          {locked && <p className="text-sm text-accent-warning mb-3">Sudah diverifikasi admin — tidak bisa diubah lagi.</p>}
          <form onSubmit={saveToday} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {TODAY_FIELDS.map(([k, label]) => (
                <Field key={k} label={label}>
                  <MoneyInput value={form[k]} disabled={locked} onChange={(v) => setForm((f) => ({ ...f, [k]: v }))} />
                </Field>
              ))}
            </div>
            <Field label="Bon karyawan">
              <BonEditor rows={bons} onChange={setBons} staff={staff.data ?? []} disabled={locked} />
            </Field>
            {!locked && <button className="btn w-full" disabled={busy}>{busy ? "Menyimpan…" : "Simpan omzet hari ini"}</button>}
          </form>
        </Panel>

        <Panel title="Setoran tunai yang belum diisi" hint="Isi uang tunai yang benar-benar disetor per shift (H+1). Settlement EDC diisi admin.">
          {data.pendingDeposits.length ? (
            <div className="space-y-3">
              {data.pendingDeposits.map((d) => (
                <DepositRow key={d.date} day={d} onSaved={reload} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-parang-subtle">Semua setoran sudah diisi.</p>
          )}
        </Panel>
      </div>
    </div>
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
    <form onSubmit={save} className="border border-parang-divider rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <b className="text-sm">{tgl(day.date)}</b>
        <span className="text-xs text-parang-subtle">POS tunai {num(day.cashPos)} <Pill tone={statusTone(day.calc.status)}>{day.calc.status}</Pill></span>
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <Field label="Shift 1"><MoneyInput value={s1} onChange={setS1} /></Field>
        <Field label="Shift 2"><MoneyInput value={s2} onChange={setS2} /></Field>
        <button className="btn" disabled={busy}>Simpan</button>
      </div>
    </form>
  );
}
