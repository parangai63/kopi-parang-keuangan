import { Plus, Trash2 } from "lucide-react";
import MoneyInput from "./MoneyInput";

export interface BonRow {
  partyId: number | "";
  amount: number | null;
}

/** Bon karyawan per orang (spesifikasi: daily_staff_bons). Nama dari tabel Pihak (karyawan). */
export default function BonEditor({
  rows, onChange, staff, disabled,
}: {
  rows: BonRow[];
  onChange: (rows: BonRow[]) => void;
  staff: { id: number; name: string }[];
  disabled?: boolean;
}) {
  const set = (i: number, patch: Partial<BonRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="fld wide bon-list">
      {rows.map((r, i) => (
        <div key={i} className="bon-row">
          <select value={r.partyId} disabled={disabled} onChange={(e) => set(i, { partyId: Number(e.target.value) || "" })} aria-label="Nama karyawan">
            <option value="">Pilih karyawan…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <MoneyInput value={r.amount} disabled={disabled} onChange={(v) => set(i, { amount: v })} />
          <button type="button" disabled={disabled} className="iconbtn" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Hapus bon">
            <Trash2 />
          </button>
        </div>
      ))}
      {!rows.length && disabled && <span className="note">Tidak ada bon.</span>}
      {!disabled && (
        <div>
          <button type="button" className="linkbtn" onClick={() => onChange([...rows, { partyId: "", amount: null }])}>
            <Plus /> Tambah bon karyawan
          </button>
        </div>
      )}
    </div>
  );
}

export const bonsToPayload = (rows: BonRow[]) =>
  rows.filter((r) => r.partyId && r.amount).map((r) => ({ partyId: r.partyId as number, amount: r.amount }));
