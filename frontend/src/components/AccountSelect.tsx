import type { Account } from "../types";

/** Dropdown akun dikelompokkan per kelompok (ASET, LIABILITAS, …). Nilai = id, atau nama jika `byName`. */
export default function AccountSelect({
  accounts, value, onChange, blank, byName, id,
}: {
  accounts: Account[];
  value: number | string | "";
  onChange: (v: number | string) => void;
  blank?: string;
  byName?: boolean;
  id?: string;
}) {
  const groups = new Map<string, Account[]>();
  for (const a of accounts.filter((x) => x.isActive)) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
  return (
    <select
      id={id}
      className="input"
      value={value}
      onChange={(e) => onChange(byName ? e.target.value : Number(e.target.value) || "")}
    >
      {blank !== undefined && <option value="">{blank}</option>}
      {[...groups].map(([g, list]) => (
        <optgroup key={g} label={g}>
          {list.map((a) => (
            <option key={a.id} value={byName ? a.name : a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
