import { Plus, Trash2 } from "lucide-react";
import MoneyInput from "./MoneyInput";
import Select from "./Select";

export interface BonRow {
  partyId: number | "";
  amount: number | null;
}

/** Bon karyawan per orang (spesifikasi: daily_staff_bons). Nama dari tabel Pihak (karyawan). */
export default function BonEditor({
  rows, onChange, staff, disabled, onCreateStaff, onRemoveStaff,
}: {
  rows: BonRow[];
  onChange: (rows: BonRow[]) => void;
  staff: { id: number; name: string }[];
  disabled?: boolean;
  /** owner/admin: tambah karyawan baru langsung dari dropdown (kasir tidak punya akses ke data Pihak) */
  onCreateStaff?: (name: string) => Promise<number>;
  /** owner/admin: hapus karyawan dari dropdown (yang sudah punya bon hanya dinonaktifkan); kembalikan pesan hasil */
  onRemoveStaff?: (id: number) => Promise<string>;
}) {
  const set = (i: number, patch: Partial<BonRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="fld wide bon-list">
      {rows.map((r, i) => (
        <div key={i} className="bon-row">
          <Select
            value={r.partyId}
            options={staff.map((s) => ({ value: s.id, label: s.name }))}
            onChange={(v) => set(i, { partyId: v })}
            placeholder="Pilih karyawan…"
            disabled={disabled}
            ariaLabel="Nama karyawan"
            create={onCreateStaff ? {
              noun: "karyawan",
              onCreate: onCreateStaff,
              onRemove: onRemoveStaff,
              // karyawan yang sedang dipilih di baris bon lain tidak bisa dihapus dari sini
              canRemove: (id) => !rows.some((x, j) => j !== i && x.partyId === id),
            } : undefined}
          />
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
