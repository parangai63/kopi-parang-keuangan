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
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_130px_32px] gap-2">
          <select className="input" value={r.partyId} disabled={disabled} onChange={(e) => set(i, { partyId: Number(e.target.value) || "" })} aria-label="Nama karyawan">
            <option value="">Pilih karyawan…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <MoneyInput value={r.amount} disabled={disabled} onChange={(v) => set(i, { amount: v })} />
          <button type="button" disabled={disabled} className="text-parang-subtle hover:text-accent-danger disabled:opacity-40" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Hapus bon">
            <Trash2 className="w-4 h-4 mx-auto" />
          </button>
        </div>
      ))}
      {!disabled && (
        <button type="button" className="text-sm text-accent-primary font-medium flex items-center gap-1" onClick={() => onChange([...rows, { partyId: "", amount: null }])}>
          <Plus className="w-4 h-4" /> Tambah bon karyawan
        </button>
      )}
    </div>
  );
}

export const bonsToPayload = (rows: BonRow[]) =>
  rows.filter((r) => r.partyId && r.amount).map((r) => ({ partyId: r.partyId as number, amount: r.amount }));
