import { masterApi } from "../api";
import { nextExpenseCode } from "../utils/options";
import Select from "./Select";
import type { Account } from "../types";

/**
 * Dropdown akun dikelompokkan per kelompok (ASET, LIABILITAS, …), bisa dicari per kode atau nama.
 * Nilai = id, atau nama jika `byName`. Dengan `onCreated` (khusus owner), akun beban 61xx baru bisa
 * ditambah langsung dari dropdown; kodenya dibuat otomatis. Akun beban tambahan (6112 dst.) juga bisa dihapus
 * dari dropdown (yang sudah dipakai hanya dinonaktifkan); akun bawaan tidak.
 */
export default function AccountSelect({
  accounts, value, onChange, blank, byName, id, onCreated, ariaLabel,
}: {
  accounts: Account[];
  value: number | string | "";
  onChange: (v: number | string) => void;
  blank?: string;
  byName?: boolean;
  id?: string;
  /** dipanggil setelah akun baru dibuat, supaya pemanggil memuat ulang daftar akun */
  onCreated?: () => void;
  ariaLabel?: string;
}) {
  // Satu judul per kelompok (mis. 7101 Pendapatan Lainnya ikut di bawah PENDAPATAN, bukan setelah BEBAN).
  const groups = new Map<string, Account[]>();
  for (const a of accounts.filter((x) => x.isActive)) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
  const options = [...groups.values()].flat().map((a) => ({ value: byName ? a.name : a.id, label: a.name, hint: a.code, group: a.group }));

  return (
    <Select<number | string>
      id={id}
      value={value}
      options={options}
      onChange={(v) => onChange(v === "" ? "" : v)}
      placeholder={blank ?? "Pilih akun…"}
      allowEmpty={blank !== undefined}
      searchable
      ariaLabel={ariaLabel}
      create={
        onCreated
          ? {
              noun: "akun beban",
              onCreate: async (name) => {
                const code = nextExpenseCode(accounts.map((a) => a.code));
                const r = await masterApi.createAccount({
                  code, name, description: null, group: "BEBAN", normalSide: "D", cashCategory: "OPERASI", cashFlowLine: "OP6",
                });
                onCreated();
                return byName ? name : r.id;
              },
              canRemove: (v) => !!accounts.find((a) => (byName ? a.name : a.id) === v)?.isCustom,
              onRemove: async (v) => {
                const acc = accounts.find((a) => (byName ? a.name : a.id) === v);
                if (!acc) return;
                const r = await masterApi.removeAccount(acc.id);
                onCreated();
                return r.message;
              },
            }
          : undefined
      }
    />
  );
}
