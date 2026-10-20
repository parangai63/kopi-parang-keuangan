import { FormEvent, useState } from "react";
import { masterApi } from "../api";
import { useApi } from "../utils/useApi";
import { useToast } from "../context/ToastContext";
import { ErrorBox, Field, Loading, PageHeader, Panel, Pill } from "../components/ui";
import type { Party, PartyType } from "../types";

const TYPES: [PartyType, string][] = [
  ["KARYAWAN", "Karyawan"], ["SUPPLIER", "Supplier"], ["PEMBERI_PINJAMAN", "Pemberi pinjaman"], ["OWNER", "Owner"], ["LAINNYA", "Lainnya"],
];
const typeLabel = (t: PartyType) => TYPES.find(([k]) => k === t)?.[1] ?? t;

/** Karyawan & supplier. Ejaan nama HARUS sama dengan master Staff/Suppliers di Parang-ops
 * (tidak ada ID bersama — yang disamakan hanya nama). */
export default function PartiesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => masterApi.parties(), []);
  const [name, setName] = useState("");
  const [type, setType] = useState<PartyType>("KARYAWAN");
  const [filter, setFilter] = useState<PartyType | "">("");

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await masterApi.createParty({ name, type });
      toast(`"${name}" ditambahkan.`);
      setName("");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  async function update(p: Party, patch: Partial<Party>) {
    try {
      await masterApi.updateParty(p.id, patch);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  return (
    <>
      <PageHeader title="Pihak" subtitle="Karyawan dan supplier, dipakai untuk bon karyawan, utang/piutang, dan pihak di jurnal." />
      <Panel title="Tambah pihak" hint="Salin ejaan nama persis dari master Staff / Suppliers di Parang-ops." className="mb-4">
        <form onSubmit={add} className="flex flex-wrap gap-3 items-end">
          <Field label="Nama" className="flex-1 min-w-[200px]"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Jenis">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as PartyType)}>
              {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <button className="btn" disabled={!name.trim()}>Tambah</button>
        </form>
      </Panel>
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {[["", "Semua"] as const, ...TYPES].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${filter === k ? "bg-parang-text text-white" : "bg-white border border-parang-divider"}`}>{l}</button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />
      ) : (
        <div className="bg-white rounded-xl border border-parang-divider overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-parang-subtle bg-parang-bg text-left">
              <tr><th className="px-3 py-2">Nama</th><th className="px-3">Jenis</th><th className="px-3">Status</th><th /></tr>
            </thead>
            <tbody>
              {data.filter((p) => !filter || p.type === filter).map((p) => (
                <tr key={p.id} className="border-t border-parang-divider/60">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3">
                    <select className="input py-1 w-44" value={p.type} onChange={(e) => update(p, { type: e.target.value as PartyType })} aria-label={`Jenis ${p.name}`}>
                      {TYPES.map(([k]) => <option key={k} value={k}>{typeLabel(k)}</option>)}
                    </select>
                  </td>
                  <td className="px-3">{p.isActive ? <Pill tone="ok">aktif</Pill> : <Pill>nonaktif</Pill>}</td>
                  <td className="px-3 text-right">
                    <button className="text-sm text-accent-primary" onClick={() => update(p, { isActive: !p.isActive })}>{p.isActive ? "Nonaktifkan" : "Aktifkan"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
