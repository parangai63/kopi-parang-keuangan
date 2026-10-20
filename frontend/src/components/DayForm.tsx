import { FormEvent, useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import { dailyApi } from "../api";
import { useToast } from "../context/ToastContext";
import { acct, BULAN, dayOfWeek, HARI, num, tgl } from "../utils/format";
import { calcDay } from "../utils/calcDay";
import { Field, LockNote, Pill, statusTone } from "./ui";
import MoneyInput from "./MoneyInput";
import BonEditor, { BonRow, bonsToPayload } from "./BonEditor";
import type { DailyDay } from "../types";

const GROUPS = [
  ["Angka tutup kasir Majoo", [["cashPos", "Tunai (POS)"], ["edcPos", "EDC / QRIS (POS)"]]],
  ["Realisasi masuk kas", [["cashShift1", "Setoran tunai shift 1"], ["cashShift2", "Setoran tunai shift 2"], ["edcSettled", "Settlement EDC"]]],
  ["Penjelasan selisih tunai", [["compliment", "Compliment"], ["ownerBill", "Bill owner"]]],
  ["Operasional", [["itemsSold", "Produk terjual"], ["transactions", "Jumlah transaksi"]]],
] as const;
type Key = "cashPos" | "edcPos" | "cashShift1" | "cashShift2" | "edcSettled" | "compliment" | "ownerBill" | "itemsSold" | "transactions";

interface Props {
  day: DailyDay;
  locked: boolean;
  threshold: number;
  staff: { id: number; name: string }[];
  canVerify: boolean;
  onSaved: () => void;
  onClose: () => void;
}

/** Form satu tanggal untuk admin/owner, dengan pratinjau hitungan langsung (rumus sama dengan server). */
export default function DayForm({ day, locked, threshold, staff, canVerify, onSaved, onClose }: Props) {
  const toast = useToast();
  const [v, setV] = useState<Record<Key, number | null>>({
    cashPos: day.cashPos, edcPos: day.edcPos, cashShift1: day.cashShift1, cashShift2: day.cashShift2,
    edcSettled: day.edcSettled, compliment: day.compliment, ownerBill: day.ownerBill,
    itemsSold: day.itemsSold, transactions: day.transactions,
  });
  const [bons, setBons] = useState<BonRow[]>(day.bons.map((b) => ({ partyId: b.partyId, amount: b.amount })));
  const [busy, setBusy] = useState(false);
  const x = useMemo(() => calcDay({ ...v, bonTotal: bons.reduce((s, b) => s + (b.amount ?? 0), 0) }, threshold), [v, bons, threshold]);
  const month = Number(day.date.slice(5, 7));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await dailyApi.save(day.date, { ...v, bons: bonsToPayload(bons) });
      toast(`Omzet ${tgl(day.date)} tersimpan. Status: ${r.calc.status || "kosong"}.`);
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    try {
      await dailyApi.verify(day.date);
      toast(`Realisasi ${tgl(day.date)} diverifikasi. Kasir tidak bisa mengubahnya lagi.`);
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal verifikasi.", "error");
    }
  }

  const rows: [string, string, boolean?][] = [
    ["Total tercatat", num(x.totalPos)],
    ["Total realisasi", num(x.totalRealized)],
    ["Selisih tunai", acct(x.cashDiff)],
    ["Selisih tunai tak terjelaskan", acct(x.unexplainedCash), Math.abs(x.unexplainedCash) > threshold],
    ["Selisih EDC", acct(x.edcDiff)],
    ["Rata-rata / transaksi", x.avgTicket ? num(x.avgTicket) : "–"],
  ];

  return (
    <form onSubmit={save}>
      <h2 className="font-semibold flex flex-wrap items-center gap-2">
        {HARI[dayOfWeek(day.date)]}, {tgl(day.date)}
        {x.status && <Pill tone={statusTone(x.status)}>{x.status}</Pill>}
        {day.verifiedAt && <Pill tone="info">diverifikasi</Pill>}
      </h2>
      <p className="text-xs text-parang-subtle mt-1 mb-3">Kosong berarti belum diisi. Setoran yang masih kosong tidak dihitung sebagai selisih.</p>
      {locked && <LockNote>Bulan {BULAN[month - 1]} sudah ditutup (atau tanggal belum terjadi). Owner harus membuka kembali bulan ini untuk mengubah data.</LockNote>}
      <div className="space-y-4">
        {GROUPS.map(([legend, fields]) => (
          <fieldset key={legend}>
            <legend className="text-xs font-semibold text-parang-text mb-2">{legend}</legend>
            <div className="grid grid-cols-2 gap-3">
              {fields.map(([k, label]) => (
                <Field key={k} label={label}>
                  <MoneyInput value={v[k]} disabled={locked} onChange={(val) => setV((s) => ({ ...s, [k]: val }))} />
                </Field>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend className="text-xs font-semibold text-parang-text mb-2">Bon karyawan (per orang)</legend>
          <BonEditor rows={bons} onChange={setBons} staff={staff} disabled={locked} />
        </fieldset>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm bg-parang-bg rounded-lg p-3 mt-4 tnum">
        {rows.map(([l, val, bad]) => (
          <div key={l} className="contents">
            <dt className="text-parang-neutral">{l}</dt>
            <dd className={`text-right ${bad ? "text-accent-danger font-semibold" : ""}`}>{val}</dd>
          </div>
        ))}
        <dt className="font-bold">Omzet bersih</dt>
        <dd className="text-right font-bold">{num(x.netRevenue)}</dd>
      </dl>
      {!locked && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
          {canVerify && day.calc.totalPos > 0 && !day.verifiedAt && (
            <button type="button" className="btn-ghost" onClick={verify}>
              <CheckCheck className="w-4 h-4" /> Verifikasi realisasi
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
        </div>
      )}
    </form>
  );
}
